import type { MetadataRoute } from 'next';

// Pre-launch: keep the site out of search engines.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}
