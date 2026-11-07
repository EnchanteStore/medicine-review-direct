import { Button, Container } from '@mrd/ui';
import Link from 'next/link';
import { signOutAction } from '@/app/(auth)/actions';
import { getCurrentUser } from '@/lib/auth';
import { PRIMARY_NAV, SITE_NAME } from '@/lib/site';

export async function SiteHeader() {
  const user = await getCurrentUser();

  const accountLinks = user ? (
    <>
      <Button asChild variant="secondary" size="sm">
        <Link href="/account">Your account</Link>
      </Button>
      <form action={signOutAction}>
        <Button type="submit" variant="ghost" size="sm">
          Sign out
        </Button>
      </form>
    </>
  ) : (
    <>
      <Button asChild variant="ghost" size="sm">
        <Link href="/sign-in">Sign in</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/sign-up">Create account</Link>
      </Button>
    </>
  );

  return (
    <header className="border-b border-sand-200 bg-white">
      <Container className="flex flex-wrap items-center justify-between gap-4 py-4">
        <Link
          href="/"
          className="font-serif text-xl font-bold text-teal-900 no-underline hover:text-teal-800"
        >
          {SITE_NAME}
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-6">
            {PRIMARY_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="font-semibold text-ink-900 no-underline hover:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">{accountLinks}</div>

        <details className="group w-full lg:hidden">
          <summary className="ml-auto flex min-h-12 w-fit cursor-pointer list-none items-center gap-2 rounded-md border-2 border-ink-900 px-4 font-semibold [&::-webkit-details-marker]:hidden">
            Menu
            <span aria-hidden="true" className="group-open:rotate-180">
              ▾
            </span>
          </summary>
          <nav aria-label="Main (mobile)" className="mt-4 border-t border-sand-200 pt-4">
            <ul className="space-y-1">
              {PRIMARY_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block rounded-md px-2 py-3 text-lg font-semibold text-ink-900 no-underline hover:bg-teal-50"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">{accountLinks}</div>
          </nav>
        </details>
      </Container>
    </header>
  );
}
