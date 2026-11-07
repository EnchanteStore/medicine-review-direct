import { SkipLink } from '@mrd/ui';
import type { Metadata, Viewport } from 'next';
import { EmergencyBanner } from '@/components/emergency-banner';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { ServiceNotice } from '@/components/service-notice';
import { brandName } from '@/lib/site';
import './globals.css';

export function generateMetadata(): Metadata {
  const brand = brandName();
  return {
    title: {
      default: `${brand}: private pharmacist medication reviews`,
      template: `%s | ${brand}`,
    },
    description:
      'A private medication review with a GPhC-registered pharmacist by telephone or secure video, followed by a written report. For adults in England.',
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: '#0f5e63',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="flex min-h-screen flex-col">
        <SkipLink />
        <EmergencyBanner />
        <ServiceNotice />
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
