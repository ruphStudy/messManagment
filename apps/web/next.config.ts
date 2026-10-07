import path from 'node:path';
import type { NextConfig } from 'next';

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4100';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // Proxy the API through the web origin so the refresh-token cookie stays first-party and httpOnly.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiOrigin}/api/v1/:path*` }];
  },
};

export default nextConfig;
