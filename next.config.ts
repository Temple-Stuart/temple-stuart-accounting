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
      // A dated /tasks?date= or ?step= — a bookmark, an old reel link — is sent to the card's page with
      // the same query, before any page renders; a plain /tasks stays the Tasks page.
      // HOME-01 (Alex, 2026-10-24): the card moved again — to the dashboard (the cockpit's Runway panel,
      // /runway; dayCard.ts DAY_CARD_PATH). The two /tasks rules land there now, and a dated /time?date=
      // or ?step= (a bookmark from TIME-01's days) follows the same way, 307; a plain /time is the tables.
      // Named in the registry's redirect doors (scripts/assert-tool-registry.ts QUERY_REDIRECTS).
      { source: '/tasks', has: [{ type: 'query', key: 'date' }], destination: '/runway', permanent: false },
      { source: '/tasks', has: [{ type: 'query', key: 'step' }], destination: '/runway', permanent: false },
      { source: '/time', has: [{ type: 'query', key: 'date' }], destination: '/runway', permanent: false },
      { source: '/time', has: [{ type: 'query', key: 'step' }], destination: '/runway', permanent: false },
    ];
  },
};

export default nextConfig;
