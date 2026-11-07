import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';

export const metadata: Metadata = { title: 'Check your email' };

export default function CheckEmailPage() {
  return (
    <AuthShell title="Check your email">
      <div className="space-y-4">
        <p>
          We have sent a link to your email address. Select the link to confirm your email and
          finish creating your account.
        </p>
        <p>
          The link expires in 1 hour. If you cannot see the email, check your junk or spam folder.
        </p>
        <p>
          Already confirmed? <Link href="/sign-in">Sign in</Link>
        </p>
      </div>
    </AuthShell>
  );
}
