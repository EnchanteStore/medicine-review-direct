import { formatGBP } from '@mrd/domain';
import { Alert, Button, Card, Container } from '@mrd/ui';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { confirmLocalCheckoutAction } from './actions';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Test checkout' };

export default async function LocalCheckoutPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await requireUser('/account');
  const { sessionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: session } = await supabase
    .from('checkout_sessions')
    .select('id, amount_pence, currency, provider, status, patient_id, product_code')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session || session.patient_id !== user.id) notFound();
  if (session.provider !== 'local_test_harness') redirect('/account');
  const { data: product } = await supabase
    .from('products')
    .select('name')
    .eq('code', session.product_code)
    .maybeSingle();

  return (
    <Container className="py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="font-serif text-3xl">Test checkout</h1>
        <Alert tone="warning">
          <p data-testid="local-harness-banner">
            Local test harness. This is not Stripe, and no card is charged. Live payments are not
            connected.
          </p>
        </Alert>
        <Card className="space-y-4">
          <h2 className="text-xl">{product?.name ?? 'Pharmacist medication review'}</h2>
          <p className="font-serif text-4xl font-bold" data-testid="harness-amount">
            {formatGBP(session.amount_pence)}
          </p>
          <p>Currency: {session.currency}. VAT is not added.</p>
          {session.status === 'open' ? (
            <form action={confirmLocalCheckoutAction}>
              <input type="hidden" name="sessionId" value={session.id} />
              <Button type="submit">Confirm test payment</Button>
            </form>
          ) : (
            <p>This test checkout is already {session.status}.</p>
          )}
        </Card>
      </div>
    </Container>
  );
}
