import { formatLondon } from '@mrd/domain';
import { Alert, Button, Card, Input, Label } from '@mrd/ui';
import type { Metadata } from 'next';
import { addAvailabilityAction } from './actions';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Availability' };

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from('pharmacist_availability')
    .select('id, starts_at, ends_at')
    .order('starts_at');

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl">Your available times</h1>
      <p className="text-lg text-ink-700">
        Enter times in UK time. Patients only see these times, in 30-minute appointments.
      </p>
      {query.notice === 'saved' ? (
        <Alert tone="success">
          <p>Those times are now open for booking.</p>
        </Alert>
      ) : null}
      {typeof query.error === 'string' ? (
        <Alert tone="danger">
          <p>{query.error}</p>
        </Alert>
      ) : null}
      <Card>
        <form action={addAvailabilityAction} className="grid gap-4 sm:grid-cols-4 sm:items-end">
          <div>
            <Label htmlFor="date">Date</Label>
            <Input id="date" name="date" type="date" required />
          </div>
          <div>
            <Label htmlFor="start">From</Label>
            <Input id="start" name="start" type="time" required />
          </div>
          <div>
            <Label htmlFor="end">Until</Label>
            <Input id="end" name="end" type="time" required />
          </div>
          <Button type="submit">Open these times</Button>
        </form>
      </Card>
      <ul className="space-y-2">
        {(rows ?? []).map((row) => (
          <li key={row.id} className="rounded-md border border-sand-200 bg-white px-4 py-3">
            {formatLondon(new Date(row.starts_at))} to {formatLondon(new Date(row.ends_at))}
          </li>
        ))}
      </ul>
    </div>
  );
}
