import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { ForgotPasswordForm } from '@/components/forms/password-forms';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      lead="Enter the email address you used to create your account and we will send you a link to choose a new password."
      aside={<Link href="/sign-in">Back to sign in</Link>}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
