import { canRequestCancellation, canReschedule, formatLondon } from '@mrd/domain';
import { Alert, Button, Card } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { requestCancellationAction } from '../book/actions';
import { requireOwnOrder } from '@/lib/intake';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Your appointment' };

const METHOD: Record<string, string> = {
  telephone: 'Telephone',
  secure_video: 'Secure video',
};

export default async function AppointmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orderId } = await params;
  const query = await searchParams;
  const order = await requireOwnOrder(orderId);
  const supabase = await createSupabaseServerClient();
  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, starts_at, method, status, reschedule_count, created_at')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false });
  const current = (appointments ?? []).find((row) => row.status === 'booked') ?? appointments?.[0];
  const starts = current?.starts_at ? new Date(current.starts_at) : null;

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl sm:text-4xl">Your appointment</h1>
      {query.notice === 'moved' ? (
        <Alert tone="success">
          <p>Your appointment has been moved.</p>
        </Alert>
      ) : null}
      {query.notice === 'cancellation' ? (
        <Alert tone="success">
          <p>
            Your cancellation request is recorded. The time is no longer held, and you can choose
            another.
          </p>
        </Alert>
      ) : null}
      {typeof query.error === 'string' ? (
        <Alert tone="danger">
          <p>{query.error}</p>
        </Alert>
      ) : null}
      {!current || !starts ? (
        <p>You do not have an appointment yet.</p>
      ) : (
        <Card className="space-y-3" data-testid="appointment-card">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">
            {current.status === 'booked'
              ? 'Booked'
              : current.status === 'cancellation_requested'
                ? 'Cancellation requested'
                : current.status}
          </p>
          <p className="text-xl font-semibold">{formatLondon(starts)}</p>
          <p>Consultation: {METHOD[current.method] ?? current.method}</p>
          <p className="text-ink-700">
            Moved {current.reschedule_count} of 2 times. A move has to be more than 24 hours before
            the start.
          </p>
          {canReschedule(
            { startsAt: starts, rescheduleCount: current.reschedule_count, status: current.status },
            new Date(),
          ) ? (
            <p>
              <Link href={`/account/review/${order.id}/book?reschedule=${current.id}`}>
                Choose a new time
              </Link>
            </p>
          ) : null}
          {canRequestCancellation(current) ? (
            <form action={requestCancellationAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="appointmentId" value={current.id} />
              <Button type="submit" variant="secondary">
                Request cancellation
              </Button>
            </form>
          ) : null}
        </Card>
      )}
      {(appointments ?? []).length > 1 ? (
        <section>
          <h2 className="text-xl">Earlier appointments</h2>
          <ul className="mt-2 list-disc pl-5">
            {(appointments ?? []).slice(1).map((row) => (
              <li key={row.id}>{row.status}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
