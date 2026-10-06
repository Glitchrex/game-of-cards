import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Don't let `next dev` append agent rules to CLAUDE.md on a fresh clone.
  agentRules: false,
  serverExternalPackages: ['@libsql/client', 'libsql', 'postgres'],
  experimental: {
    // Most visitors arrive cold on a phone: merge client JS into fewer, larger chunks so a
    // first load makes ~8 script requests instead of ~14 (each costs a round trip on slow
    // mobile connections). Sizes are in bytes of unminified code; see the turbopackChunking docs.
    turbopackChunking: {
      minChunkSize: 200000,
      requestCost: 600000,
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
