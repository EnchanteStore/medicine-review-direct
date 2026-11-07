import { Alert } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { ResetPasswordForm } from '@/components/forms/password-forms';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Choose a new password' };

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <AuthShell title="Choose a new password">
        <Alert tone="warning">
          <p>
            Your password reset link has expired or has already been used.{' '}
            <Link href="/forgot-password">Request a new link</Link>.
          </p>
        </Alert>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Choose a new password">
      <ResetPasswordForm />
    </AuthShell>
  );
}
