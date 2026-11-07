import { Alert } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { SignInForm } from '@/components/forms/sign-in-form';
import { getCurrentUser } from '@/lib/auth';
import { safeNextPath } from '@/lib/safe-redirect';

export const metadata: Metadata = { title: 'Sign in' };

const NOTICES: Record<string, { tone: 'info' | 'warning'; text: string }> = {
  'signed-out': { tone: 'info', text: 'You have signed out.' },
  'link-invalid': {
    tone: 'warning',
    text: 'That link has expired or has already been used. Sign in, or request a new link.',
  },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === 'string' ? params.next : undefined);
  if (await getCurrentUser()) redirect(next);
  const notice = typeof params.notice === 'string' ? NOTICES[params.notice] : undefined;

  return (
    <AuthShell
      title="Sign in"
      aside={
        <p>
          New to Medicine Review Direct? <Link href="/sign-up">Create an account</Link>
        </p>
      }
    >
      {notice ? (
        <Alert tone={notice.tone} className="mb-6">
          <p>{notice.text}</p>
        </Alert>
      ) : null}
      <SignInForm next={next} />
    </AuthShell>
  );
}
