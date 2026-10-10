import path from 'node:path';
import type { NextConfig } from 'next';

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4100';
if (process.env.NODE_ENV === 'production' && !process.env.API_ORIGIN) {
  console.warn('[web] API_ORIGIN is not set — /api/v1 will be proxied to http://localhost:4100. Set it for production.');
}

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Camera is used only by the QR scanner on this origin.
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../..'),
  poweredByHeader: false,
  // Proxy the API through the web origin so the refresh-token cookie stays first-party and httpOnly.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiOrigin}/api/v1/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
