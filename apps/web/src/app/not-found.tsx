import { Container } from '@mrd/ui';
import Link from 'next/link';

export default function NotFound() {
  return (
    <Container className="py-16">
      <h1 className="font-serif text-3xl">Page not found</h1>
      <p className="mt-4 text-lg text-ink-700">
        If you typed the web address, check it is correct. If you pasted it, check you copied the
        whole address.
      </p>
      <p className="mt-4">
        <Link href="/">Go to the home page</Link>
      </p>
    </Container>
  );
}
