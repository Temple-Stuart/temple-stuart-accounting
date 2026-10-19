import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('pdf-parse', '@napi-rs/canvas', 'pdfjs-dist');
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.plaid.com https://payment-wrapper.liteapi.travel https://js.stripe.com",
              "connect-src 'self' https://production.plaid.com https://cdn.plaid.com https://payment-wrapper.liteapi.travel https://api.stripe.com",
              "img-src 'self' data: https:",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              "frame-src https://cdn.plaid.com https://payment-wrapper.liteapi.travel https://js.stripe.com https://hooks.stripe.com",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/ops', destination: '/compliance', permanent: true },
      { source: '/ops/:path*', destination: '/compliance/:path*', permanent: true },
      // TIME-01 (Alex, 2026-10-19): the day card moved from /tasks to /time (dayCard.ts DAY_CARD_PATH).
      // A dated /tasks?date= or ?step= — a bookmark, an old reel link — is sent to /time with the
      // same query, before any page renders; a plain /tasks stays the Tasks page (projects, routines).
      // Named in the registry's redirect doors (scripts/assert-tool-registry.ts QUERY_REDIRECTS).
      { source: '/tasks', has: [{ type: 'query', key: 'date' }], destination: '/time', permanent: false },
      { source: '/tasks', has: [{ type: 'query', key: 'step' }], destination: '/time', permanent: false },
    ];
  },
};

export default nextConfig;
