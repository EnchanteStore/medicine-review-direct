import { Container } from '@mrd/ui';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/account', label: 'Overview' },
  { href: '/account/profile', label: 'Your details' },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUser('/account');
  return (
    <Container className="py-10">
      <div className="grid gap-8 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Account">
          <ul className="flex gap-2 lg:flex-col">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-md px-3 py-2.5 font-semibold text-ink-900 no-underline hover:bg-teal-50"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>{children}</div>
      </div>
    </Container>
  );
}
