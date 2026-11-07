import { hasVerifiedRole } from '@mrd/domain';
import { Alert, Button, Card, Label } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { assignPharmacistAction } from '@/app/staff/assignments/actions';
import { getStaffGrants, requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Assign a pharmacist' };
export const dynamic = 'force-dynamic';

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser('/staff/assignments');
  const params = await searchParams;
  const grants = await getStaffGrants();
  const notice = params.notice === 'assigned' ? 'Pharmacist assigned.' : undefined;
  const error = typeof params.error === 'string' ? params.error : undefined;

  if (!hasVerifiedRole(grants, 'clinical_admin')) {
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-3xl">Assign a pharmacist</h1>
        <Alert tone="warning">
          <p>
            Your role does not include access to clinical records. An operations administrator
            cannot assign a pharmacist and cannot read a questionnaire, a report or a message.
          </p>
        </Alert>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: orders }, { data: pharmacists }] = await Promise.all([
    supabase
      .from('review_orders')
      .select('id, status, patient_id, assigned_pharmacist_id, created_at')
      .in('status', [
        'questionnaire_submitted',
        'awaiting_payment',
        'paid',
        'consultation_booked',
        'in_review',
        'safety_urgent_hold',
        'declined',
      ])
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('staff_roles')
      .select('user_id')
      .eq('role', 'pharmacist')
      .eq('verification_status', 'verified'),
  ]);
  const ids = [
    ...new Set([
      ...(orders ?? []).map((order) => order.patient_id),
      ...(pharmacists ?? []).map((role) => role.user_id),
      ...(orders ?? []).flatMap((order) =>
        order.assigned_pharmacist_id ? [order.assigned_pharmacist_id] : [],
      ),
    ]),
  ];
  const { data: profiles } =
    ids.length > 0
      ? await supabase.from('profiles').select('id, given_name, family_name').in('id', ids)
      : { data: [] };
  const nameOf = (id: string | null) => {
    if (!id) return 'Not assigned';
    const profile = (profiles ?? []).find((row) => row.id === id);
    return (
      [profile?.given_name, profile?.family_name].filter(Boolean).join(' ') || 'Named pharmacist'
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl">Assign a pharmacist</h1>
      <p className="text-ink-700">
        Only a verified clinical administrator can assign a verified pharmacist. Assignment does not
        approve or release a report.
      </p>
      <p>
        <Link href="/staff/reviews">Pharmacist workspace</Link>
      </p>
      {notice ? (
        <Alert tone="success">
          <p>{notice}</p>
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="danger">
          <p>{error}</p>
        </Alert>
      ) : null}
      {(orders ?? []).length === 0 ? (
        <Alert tone="info">
          <p>No reviews are waiting.</p>
        </Alert>
      ) : (
        <ul className="space-y-4">
          {(orders ?? []).map((order) => (
            <li key={order.id}>
              <Card className="space-y-3">
                <h2 className="text-xl">{nameOf(order.patient_id)}</h2>
                <p className="text-ink-700">
                  {order.status}. Assigned to {nameOf(order.assigned_pharmacist_id)}.
                </p>
                <form
                  action={assignPharmacistAction}
                  className="flex flex-wrap items-end gap-3"
                  data-testid={`assign-${order.id}`}
                >
                  <input type="hidden" name="orderId" value={order.id} />
                  <div className="min-w-64 space-y-1">
                    <Label htmlFor={`pharmacist-${order.id}`}>Pharmacist</Label>
                    <select
                      id={`pharmacist-${order.id}`}
                      name="pharmacistId"
                      required
                      defaultValue={order.assigned_pharmacist_id ?? ''}
                      className="block min-h-12 w-full rounded-md border-2 border-ink-600 bg-white px-3"
                    >
                      <option value="" disabled>
                        Choose a pharmacist
                      </option>
                      {(pharmacists ?? []).map((role) => (
                        <option key={role.user_id} value={role.user_id}>
                          {nameOf(role.user_id)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button type="submit">Assign pharmacist</Button>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
