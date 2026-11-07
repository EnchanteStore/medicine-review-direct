import { hasClinicalAccess } from '@mrd/domain';
import { Alert, Card } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getStaffGrants } from '@/lib/auth';

export const metadata: Metadata = { title: 'Staff area' };

const ROLE_LABELS = {
  pharmacist: 'Pharmacist',
  clinical_admin: 'Clinical administrator',
  ops_admin: 'Operations administrator',
} as const;

export default async function StaffHomePage() {
  const grants = await getStaffGrants();
  const clinical = hasClinicalAccess(grants);

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl">Staff area</h1>
      <p>
        <Link href="/staff/launch-readiness">Launch readiness checklist</Link>
      </p>
      <Card>
        <h2 className="text-xl">Your roles</h2>
        <ul className="mt-3 space-y-1">
          {grants.map((g) => (
            <li key={g.role}>
              {ROLE_LABELS[g.role]}: <strong>{g.verificationStatus}</strong>
            </li>
          ))}
        </ul>
      </Card>
      {clinical ? (
        <Alert tone="info">
          <p>
            The pharmacist workspace (assigned reviews, reports and messaging) arrives in Phase 4.
          </p>
        </Alert>
      ) : (
        <Alert tone="info">
          <p>
            Your role does not include access to clinical records. Operations tools (queues, billing
            and service configuration) arrive in Phases 3 and 4.
          </p>
        </Alert>
      )}
    </div>
  );
}
