import { isStaff } from '@mrd/domain';
import { Card, Container } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getStaffGrants, requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { EnrolMfa, VerifyMfa } from './mfa-forms';

export const metadata: Metadata = { title: 'Two-step verification' };
export const dynamic = 'force-dynamic';

export default async function MfaPage() {
  await requireUser('/staff');
  if (!isStaff(await getStaffGrants())) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === 'aal2') redirect('/staff');
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp.find((f) => f.status === 'verified');

  return (
    <Container className="py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="font-serif text-3xl">Two-step verification</h1>
        <p className="text-lg text-ink-700">
          Staff must use an authenticator app every time they sign in. Without it, staff accounts
          cannot see any patient or clinical information.
        </p>
        <Card>{verified ? <VerifyMfa factorId={verified.id} /> : <EnrolMfa />}</Card>
        <p>
          <Link href="/mfa/locked-out">Lost your authenticator?</Link>
        </p>
      </div>
    </Container>
  );
}
