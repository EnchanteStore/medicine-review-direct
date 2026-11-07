import { hasClinicalAccess, hasVerifiedRole } from '@mrd/domain';
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
        {' · '}
        <Link href="/staff/availability">Available times</Link>
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
        <Card className="space-y-3">
          <h2 className="text-xl">Pharmacist workspace</h2>
          <p>Open the reviews assigned to you. A review assigned to someone else stays hidden.</p>
          <p>
            <Link href="/staff/reviews">Open the pharmacist workspace</Link>
            {hasVerifiedRole(grants, 'clinical_admin') ? (
              <>
                {' · '}
                <Link href="/staff/assignments">Assign a pharmacist</Link>
              </>
            ) : null}
          </p>
        </Card>
      ) : (
        <Alert tone="info">
          <p>
            Your role does not include access to clinical records. You cannot assign a pharmacist or
            read a questionnaire, a report or a message.
          </p>
        </Alert>
      )}
    </div>
  );
}
