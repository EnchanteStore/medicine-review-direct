import type { MetadataRoute } from 'next';
import { CANONICAL_ORIGIN } from '@mrd/domain';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/account',
        '/portal',
        '/staff',
        '/mfa',
        '/sign-in',
        '/sign-up',
        '/forgot-password',
        '/reset-password',
        '/dev',
      ],
    },
    sitemap: `${CANONICAL_ORIGIN}/sitemap.xml`,
    host: CANONICAL_ORIGIN,
  };
}
