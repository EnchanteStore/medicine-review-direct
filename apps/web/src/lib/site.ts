import 'server-only';
import { resolveBusinessConfig, type BusinessConfig } from '@mrd/domain';
import { cache } from 'react';

/** Trading name and business identity from configuration (never invented). */
export const getBusinessConfig = cache((): BusinessConfig => resolveBusinessConfig(process.env));

export function brandName(): string {
  return getBusinessConfig().tradingName;
}

export const PRIMARY_NAV = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/complaints', label: 'Contact' },
] as const;

export const FOOTER_NAV = [
  { href: '/terms', label: 'Terms of Service' },
  { href: '/privacy', label: 'Privacy Notice' },
  { href: '/clinical-safety', label: 'Clinical Service and Safety Information' },
  { href: '/refunds', label: 'Cancellation and Refund Policy' },
  { href: '/complaints', label: 'Complaints and Contact Information' },
] as const;
