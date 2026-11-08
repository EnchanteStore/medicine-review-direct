import { BRAND_SEO_DESCRIPTION, BRAND_SEO_TITLE, CANONICAL_ORIGIN } from '@mrd/domain';
import { SkipLink } from '@mrd/ui';
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { EmergencyBanner } from '@/components/emergency-banner';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { ServiceNotice } from '@/components/service-notice';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
});

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(CANONICAL_ORIGIN),
    title: {
      default: BRAND_SEO_TITLE,
      template: '%s | MedsInFocus',
    },
    description: BRAND_SEO_DESCRIPTION,
    alternates: { canonical: '/' },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: '#143E39',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={jakarta.variable}>
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
