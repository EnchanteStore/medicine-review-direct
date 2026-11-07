import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { SignUpForm } from '@/components/forms/sign-up-form';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Create an account' };

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect('/account');
  return (
    <AuthShell
      title="Create an account"
      lead="Your account keeps your information secure and lets you follow your review."
      aside={
        <p>
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </p>
      }
    >
      <SignUpForm />
    </AuthShell>
  );
}
