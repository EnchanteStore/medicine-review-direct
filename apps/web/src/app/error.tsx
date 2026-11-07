'use client';

import { Button, Container } from '@mrd/ui';

// Deliberately generic: error details are never shown to users.
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Container className="py-16">
      <h1 className="font-serif text-3xl">Sorry, there is a problem</h1>
      <p className="mt-4 text-lg text-ink-700">
        Please try again. If the problem continues, try again later.
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </Container>
  );
}
