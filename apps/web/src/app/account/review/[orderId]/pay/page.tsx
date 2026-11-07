import { formatGBP } from '@mrd/domain';
import { Alert, Button, Card } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { startCheckoutAction } from './actions';
import { requireOwnOrder } from '@/lib/intake';
import { getServiceStatus } from '@/lib/service-status';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Checkout' };

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orderId } = await params;
  const { error } = await searchParams;
  const order = await requireOwnOrder(orderId);
  const status = await getServiceStatus();
  const supabase = await createSupabaseServerClient();
  const { data: product } = await supabase
    .from('products')
    .select('name, price_pence, standard_price_pence')
    .eq('code', 'standard_review')
    .maybeSingle();
  const { data: payment } = await supabase
    .from('payments')
    .select('receipt_number, amount_pence, status')
    .eq('order_id', order.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl sm:text-4xl">Checkout</h1>
      {status.payments_mode === 'test' ? (
        <Alert tone="warning">
          <p data-testid="checkout-test-banner">
            Test checkout only. This does not take a live card payment, and Stripe live mode is not
            connected.
          </p>
        </Alert>
      ) : (
        <Alert tone="info">
          <p>Payments are switched off until the service is approved to open.</p>
        </Alert>
      )}
      {typeof error === 'string' ? (
        <Alert tone="danger">
          <p>{error}</p>
        </Alert>
      ) : null}
      <Card className="space-y-3">
        <h2 className="text-2xl">{product?.name ?? 'Pharmacist medication review'}</h2>
        {product ? (
          <p className="font-serif text-4xl font-bold text-teal-900" data-testid="checkout-price">
            {formatGBP(product.price_pence)}
          </p>
        ) : (
          <p>The price could not be loaded. Checkout is unavailable.</p>
        )}
        <p className="text-ink-700">The price is read from our records. VAT is not added.</p>
        {payment ? (
          <p data-testid="payment-confirmed">
            Payment recorded. Receipt {payment.receipt_number}. Status:{' '}
            {payment.status === 'succeeded' ? 'Paid' : 'Refund recorded'}.
          </p>
        ) : order.status === 'questionnaire_submitted' || order.status === 'awaiting_payment' ? (
          <form action={startCheckoutAction}>
            <input type="hidden" name="orderId" value={order.id} />
            <Button type="submit" disabled={status.payments_mode === 'closed' || !product}>
              Continue to test checkout
            </Button>
          </form>
        ) : (
          <p>Checkout is not available for this review.</p>
        )}
        {payment ? (
          <p>
            <Link href={`/account/review/${order.id}/receipt`}>View receipt</Link>
          </p>
        ) : null}
      </Card>
    </div>
  );
}
