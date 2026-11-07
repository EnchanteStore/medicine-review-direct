import { SkipLink } from '@mrd/ui';
import type { Metadata, Viewport } from 'next';
import { EmergencyBanner } from '@/components/emergency-banner';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { SITE_NAME } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME}: private pharmacist medication reviews`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    'A private telephone medication review with a UK-registered pharmacist, followed by a clear written report. For adults in England.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0f5e63',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="flex min-h-screen flex-col">
        <SkipLink />
        <EmergencyBanner />
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
