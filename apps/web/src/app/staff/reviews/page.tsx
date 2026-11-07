import { hasVerifiedRole } from '@mrd/domain';
import { Alert, Card } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getStaffGrants, requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Assigned reviews' };
export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  questionnaire_submitted: 'Questionnaire sent',
  awaiting_payment: 'Waiting for payment',
  paid: 'Paid, not booked',
  consultation_booked: 'Appointment booked',
  in_review: 'In review',
  report_released: 'Report released',
  declined: 'Declined',
  safety_urgent_hold: 'Urgent hold',
  safety_emergency_excluded: 'Emergency exclusion',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export default async function AssignedReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser('/staff/reviews');
  const params = await searchParams;
  const error = typeof params.error === 'string' ? params.error : undefined;
  const grants = await getStaffGrants();
  const supabase = await createSupabaseServerClient();
  const { data: orders } = await supabase
    .from('review_orders')
    .select('id, status, patient_id, created_at')
    .eq('assigned_pharmacist_id', user.id)
    .order('created_at', { ascending: false });
  const patientIds = [...new Set((orders ?? []).map((order) => order.patient_id))];
  const { data: profiles } =
    patientIds.length > 0
      ? await supabase.from('profiles').select('id, given_name, family_name').in('id', patientIds)
      : { data: [] };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl">Pharmacist workspace</h1>
      <p className="text-ink-700">
        You can see reviews assigned to you. You cannot open a review assigned to someone else.
      </p>
      {hasVerifiedRole(grants, 'clinical_admin') ? (
        <p>
          <Link href="/staff/assignments">Assign a pharmacist</Link>
        </p>
      ) : null}
      {error ? (
        <Alert tone="danger">
          <p>{error}</p>
        </Alert>
      ) : null}
      {(orders ?? []).length === 0 ? (
        <Alert tone="info">
          <p>No reviews are assigned to you.</p>
        </Alert>
      ) : (
        <ul className="space-y-3">
          {(orders ?? []).map((order) => {
            const profile = names.get(order.patient_id);
            const name =
              [profile?.given_name, profile?.family_name].filter(Boolean).join(' ') || 'Patient';
            return (
              <li key={order.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl">{name}</h2>
                    <p className="text-ink-700">{STATUS_LABEL[order.status] ?? order.status}</p>
                  </div>
                  <Link href={`/staff/reviews/${order.id}`}>Open review</Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
