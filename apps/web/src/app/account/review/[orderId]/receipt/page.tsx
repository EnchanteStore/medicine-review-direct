import { formatGBP } from '@mrd/domain';
import { Badge, Card } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireOwnOrder } from '@/lib/intake';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Receipt' };

export default async function ReceiptPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await requireOwnOrder(orderId);
  const supabase = await createSupabaseServerClient();
  const { data: payment } = await supabase
    .from('payments')
    .select('id, receipt_number, amount_pence, currency, status, source, created_at')
    .eq('order_id', order.id)
    .maybeSingle();
  const { data: refunds } = payment
    ? await supabase
        .from('refunds')
        .select('id, amount_pence, status, recorded_at')
        .eq('payment_id', payment.id)
    : { data: [] };

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl sm:text-4xl">Receipt</h1>
      {!payment ? (
        <p>There is no payment for this review.</p>
      ) : (
        <Card className="space-y-3" data-testid="receipt">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">
            Receipt {payment.receipt_number}
          </p>
          <p className="font-serif text-4xl font-bold">{formatGBP(payment.amount_pence)}</p>
          <p>Pharmacist medication review. Currency {payment.currency}. VAT is not added.</p>
          <p>
            Status:{' '}
            <Badge tone={payment.status === 'succeeded' ? 'teal' : 'warning'}>
              {payment.status === 'succeeded' ? 'Paid' : 'Refund recorded'}
            </Badge>
          </p>
          <p className="text-ink-700">
            {payment.source === 'manual_audited'
              ? 'Recorded by the team. This was not sent to a card provider from this screen.'
              : 'Confirmed from a signed test payment notice. This was not a live card charge.'}
          </p>
          {(refunds ?? []).length > 0 ? (
            <ul>
              {(refunds ?? []).map((refund) => (
                <li key={refund.id}>
                  Refund recorded: {formatGBP(refund.amount_pence)}. Not sent to a card provider.
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      )}
      <Link href={`/account/review/${order.id}`}>Back to your review</Link>
    </div>
  );
}
