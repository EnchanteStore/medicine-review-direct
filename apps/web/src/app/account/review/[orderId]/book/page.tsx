import { formatLondon } from '@mrd/domain';
import { Alert, Button, Card, Label } from '@mrd/ui';
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
  const { error, reschedule, pharmacist } = await searchParams;
  const rescheduleId = typeof reschedule === 'string' ? reschedule : '';
  const chosenPharmacist = typeof pharmacist === 'string' ? pharmacist : '';
  const order = await requireOwnOrder(orderId);
  const supabase = await createSupabaseServerClient();
  const from = new Date();
  const to = new Date(from.getTime() + 60 * 24 * 60 * 60 * 1000);
  const { data: slots } = await supabase.rpc('bookable_slot_choices', {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  const pharmacists = new Map<string, { name: string; gphc: string }>();
  for (const slot of slots ?? []) {
    if (!pharmacists.has(slot.pharmacist_id)) {
      pharmacists.set(slot.pharmacist_id, {
        name: slot.display_name ?? 'Pharmacist',
        gphc: slot.gphc_number ?? '',
      });
    }
  }
  const visible = (slots ?? []).filter(
    (slot) => !chosenPharmacist || slot.pharmacist_id === chosenPharmacist,
  );
  const next = [...(slots ?? [])].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  )[0];

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl sm:text-4xl">Choose a pharmacist and a time</h1>
      <p className="text-lg text-ink-700">
        Choose a pharmacist, or take the next available time. Times are shown in UK time. The
        pharmacist you book is the one named on the consultation.
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
      <form method="get" className="flex flex-wrap items-end gap-3">
        {rescheduleId ? <input type="hidden" name="reschedule" value={rescheduleId} /> : null}
        <div className="min-w-64 space-y-1">
          <Label htmlFor="pharmacist">Pharmacist</Label>
          <select
            id="pharmacist"
            name="pharmacist"
            defaultValue={chosenPharmacist}
            className="block min-h-12 w-full rounded-md border-2 border-ink-600 bg-white px-3"
          >
            <option value="">Next available</option>
            {[...pharmacists.entries()].map(([id, pharmacist]) => (
              <option key={id} value={id}>
                {pharmacist.name}
                {pharmacist.gphc ? `, GPhC ${pharmacist.gphc}` : ''}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary">
          Show times
        </Button>
      </form>
      {next && !chosenPharmacist ? (
        <Card className="space-y-3" data-testid="next-available">
          <p className="font-semibold">Next available</p>
          <p>
            {pharmacists.get(next.pharmacist_id)?.name ?? 'Pharmacist'},{' '}
            {formatLondon(new Date(next.starts_at))}
          </p>
          <form action={rescheduleId ? rescheduleAction : bookSlotAction}>
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="appointmentId" value={rescheduleId} />
            <input type="hidden" name="pharmacistId" value={next.pharmacist_id} />
            <input type="hidden" name="startsAt" value={next.starts_at} />
            <Button type="submit" disabled={!rescheduleId && order.status !== 'paid'}>
              {rescheduleId ? 'Move to the next available time' : 'Book the next available time'}
            </Button>
          </form>
        </Card>
      ) : null}
      {(visible ?? []).length === 0 ? (
        <p data-testid="no-slots">There are no open times at the moment.</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((slot) => (
            <li key={`${slot.pharmacist_id}-${slot.starts_at}`}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold">
                  {pharmacists.get(slot.pharmacist_id)?.name ?? 'Pharmacist'},{' '}
                  {formatLondon(new Date(slot.starts_at))}
                </p>
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
