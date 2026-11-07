import { Container } from '@mrd/ui';
import Link from 'next/link';
import { FOOTER_NAV, getBusinessConfig } from '@/lib/site';

export function SiteFooter() {
  const config = getBusinessConfig();
  return (
    <footer className="mt-20 border-t border-sand-200 bg-sand-100">
      <Container className="grid gap-8 py-10 sm:grid-cols-2">
        <div className="space-y-3">
          <p className="font-serif text-lg font-bold text-teal-900">{config.tradingName}</p>
          <p className="text-sm text-ink-700">
            Private pharmacist-led medication reviews for adults in England. We do not diagnose,
            prescribe, change medicines or provide emergency or urgent care.
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
          {config.tradingNameProvisional
            ? `${config.tradingName} is a provisional trading name, pending name and trade mark clearance. `
            : null}
          Legal and clinical policies are placeholders awaiting professional review.
        </p>
      </Container>
    </footer>
  );
}
