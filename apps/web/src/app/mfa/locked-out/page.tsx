import { Card, Container } from '@mrd/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Lost authenticator' };

export default function LockedOutPage() {
  return (
    <Container className="py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="font-serif text-3xl">Lost your authenticator?</h1>
        <Card className="space-y-3">
          <p>An email or text message on its own cannot switch off two-step verification.</p>
          <p>
            Ask another administrator to check who you are in person, on a video call with someone
            who knows you, or with a hardware security key, and then revoke the lost authenticator.
            You cannot approve this for yourself.
          </p>
          <p>
            If there is only one administrator, use the written emergency procedure and the offline
            recovery codes or hardware key kept outside this system. Those codes are never stored in
            the software.
          </p>
          <p>
            <Link href="/sign-in">Back to sign in</Link>
          </p>
        </Card>
      </div>
    </Container>
  );
}
