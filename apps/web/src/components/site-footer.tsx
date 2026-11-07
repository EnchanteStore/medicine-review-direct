import { Container } from '@mrd/ui';
import Link from 'next/link';
import { FOOTER_NAV, SITE_NAME } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-sand-200 bg-sand-100">
      <Container className="grid gap-8 py-10 sm:grid-cols-2">
        <div className="space-y-3">
          <p className="font-serif text-lg font-bold text-teal-900">{SITE_NAME}</p>
          <p className="text-sm text-ink-700">
            A private medication review service with UK-registered pharmacists, for adults in
            England. We do not diagnose, prescribe or provide emergency care.
          </p>
          <p className="text-sm text-ink-700">
            This service is not connected to or endorsed by the NHS.
          </p>
        </div>
        <nav aria-label="Policies">
          <ul className="space-y-2">
            {FOOTER_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-ink-900">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
      <Container className="border-t border-sand-200 py-6 text-sm text-ink-700">
        <p>
          Working name, subject to branding and legal clearance. Pre-launch preview: website content
          is in draft and the service is not yet accepting patients.
        </p>
      </Container>
    </footer>
  );
}
