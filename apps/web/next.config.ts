import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

// Strict CSP with nonces is planned for Phase 5; these directives are safe now
// and block framing, plugin content and cross-origin form posts.
const csp = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@mrd/ui', '@mrd/domain', '@mrd/validation'],
  experimental: {
    // Document uploads (10MB limit, checked server-side) go through a server action.
    serverActions: { bodySizeLimit: '11mb' },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async rewrites() {
    return [
      { source: '/portal', destination: '/account' },
      { source: '/portal/:path*', destination: '/account/:path*' },
    ];
  },
};

export default nextConfig;
