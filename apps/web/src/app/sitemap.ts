import type { MetadataRoute } from 'next';
import { CANONICAL_ORIGIN } from '@mrd/domain';

const PATHS = [
  '/',
  '/how-it-works',
  '/pricing',
  '/about',
  '/faq',
  '/clinical-safety',
  '/privacy',
  '/terms',
  '/refunds',
  '/complaints',
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((path) => ({
    url: `${CANONICAL_ORIGIN}${path}`,
    changeFrequency: 'monthly',
    priority: path === '/' ? 1 : 0.6,
  }));
}
