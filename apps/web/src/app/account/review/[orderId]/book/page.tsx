import { formatLondon } from '@mrd/domain';
import { Alert, Button, Card } from '@mrd/ui';
import type { Metadata } from 'next';
import { bookSlotAction, rescheduleAction } from '../book/actions';
import { requireOwnOrder } from '@/lib/intake';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Choose a time' };

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orderId } = await params;
  const { error, reschedule } = await searchParams;
  const rescheduleId = typeof reschedule === 'string' ? reschedule : '';
  const order = await requireOwnOrder(orderId);
  const supabase = await createSupabaseServerClient();
  const from = new Date();
  const to = new Date(from.getTime() + 60 * 24 * 60 * 60 * 1000);
  const { data: slots } = await supabase.rpc('bookable_slots', {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl sm:text-4xl">Choose a time</h1>
      <p className="text-lg text-ink-700">
        Times are shown in UK time. Only times a pharmacist has opened are listed.
      </p>
      {typeof error === 'string' ? (
        <Alert tone="danger">
          <p>{error}</p>
        </Alert>
      ) : null}
      {order.status !== 'paid' ? (
        <Alert tone="info">
          <p>You can choose a time after your payment is confirmed.</p>
        </Alert>
      ) : null}
      {(slots ?? []).length === 0 ? (
        <p data-testid="no-slots">There are no open times at the moment.</p>
      ) : (
        <ul className="space-y-3">
          {(slots ?? []).map((slot) => (
            <li key={`${slot.pharmacist_id}-${slot.starts_at}`}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold">{formatLondon(new Date(slot.starts_at))}</p>
                <form action={rescheduleId ? rescheduleAction : bookSlotAction}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="appointmentId" value={rescheduleId} />
                  <input type="hidden" name="pharmacistId" value={slot.pharmacist_id} />
                  <input type="hidden" name="startsAt" value={slot.starts_at} />
                  <Button type="submit" disabled={!rescheduleId && order.status !== 'paid'}>
                    {rescheduleId ? 'Move to this time' : 'Book this time'}
                  </Button>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
