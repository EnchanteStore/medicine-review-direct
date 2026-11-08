import { NextResponse } from 'next/server';
import { classifyStripeSecret } from '@/lib/stripe-mode';
import {
  LOCAL_TEST_WEBHOOK_SECRET,
  payloadHash,
  verifyStripeSignature,
} from '@/lib/stripe-signature';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface CheckoutEvent {
  id?: string;
  type?: string;
  data?: {
    object?: {
      id?: string;
      amount_total?: number;
      currency?: string;
      metadata?: { checkout_mode?: string; order_id?: string };
    };
  };
}

/**
 * Confirms a payment only after the signature check. The local harness is not
 * Stripe. A live Stripe key is refused. The database, not this payload, owns
 * the price.
 */
export async function POST(request: Request) {
  const payload = await request.text();
  const header = request.headers.get('stripe-signature');
  const stripeKey = classifyStripeSecret(process.env.STRIPE_SECRET_KEY);
  if (stripeKey === 'live_refused') {
    return NextResponse.json({ error: 'Live Stripe keys are not allowed' }, { status: 400 });
  }
  let event: CheckoutEvent;
  try {
    event = JSON.parse(payload) as CheckoutEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const mode = event.data?.object?.metadata?.checkout_mode;
  const secret =
    mode === 'local_test_harness' ? LOCAL_TEST_WEBHOOK_SECRET : process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !verifyStripeSignature(secret, payload, header)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
  if (mode !== 'local_test_harness' && mode !== 'stripe_test') {
    return NextResponse.json({ error: 'Unsupported checkout mode' }, { status: 400 });
  }
  if (mode === 'stripe_test' && stripeKey !== 'test') {
    return NextResponse.json({ error: 'Stripe test key is not configured' }, { status: 400 });
  }

  const sessionId = event.data?.object?.id;
  const amount = event.data?.object?.amount_total;
  const currency = event.data?.object?.currency;
  if (!event.id || !event.type || !sessionId || amount == null || !currency) {
    return NextResponse.json({ error: 'Incomplete event' }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.rpc('apply_provider_event', {
      p_event_id: event.id,
      p_event_type: event.type,
      p_session_id: sessionId,
      p_amount_pence: amount,
      p_currency: currency,
      p_payload_hash: payloadHash(payload),
    });
    if (error) {
      console.error('[payment] event rejected', { code: error.code ?? 'unknown' });
      return NextResponse.json({ error: 'Not applied' }, { status: 422 });
    }
    return NextResponse.json(data ?? { outcome: 'ok' });
  } catch (error) {
    console.error('[payment] webhook failed', {
      reason: error instanceof Error ? error.name : 'error',
    });
    return NextResponse.json({ error: 'Not applied' }, { status: 500 });
  }
}
