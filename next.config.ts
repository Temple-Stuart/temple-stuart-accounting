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
      // DOCUMENTS-01b (Alex, 2026-10-30, ruling A): the receipt download's own policy. The file route
      // (src/app/api/books/documents/[id]/file/route.ts) answers a kept receipt with
      // `Content-Security-Policy: sandbox` (sourceDocuments.ts fileResponseHeaders), but the site-wide
      // rule above set the same key on every path and replaced it on the wire — #1873's finding: the
      // download reached the browser under the app's policy, not its own. Next's documented rule: when
      // two header rules match one path and set the same key, the LAST one wins
      // (nextjs.org/docs/15/app/api-reference/config/next-config-js/headers, "Header Overriding
      // Behavior"), so this rule stands after the site-wide one and `:id` matches one segment — the
      // uuid — and nothing else. The site-wide value does not change by one byte. What it protects:
      // customer-uploaded bytes handed back from this origin as a download; should a copy ever be
      // rendered, under `sandbox` it can run nothing here.
      {
        source: '/api/books/documents/:id/file',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: 'sandbox',
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
      // HOME-03 (Alex, 2026-10-27): the card moved once more — to the home page, /home (dayCard.ts DAY_CARD_PATH),
      // between THE ANSWERS and THE SHEET. The four rules land there now, and a dated /runway?date= or ?step= (a
      // bookmark from HOME-01's days) follows the same way, 307; a bare /runway stays the cockpit's calendar tab.
      { source: '/tasks', has: [{ type: 'query', key: 'date' }], destination: '/home', permanent: false },
      { source: '/tasks', has: [{ type: 'query', key: 'step' }], destination: '/home', permanent: false },
      { source: '/time', has: [{ type: 'query', key: 'date' }], destination: '/home', permanent: false },
      { source: '/time', has: [{ type: 'query', key: 'step' }], destination: '/home', permanent: false },
      { source: '/runway', has: [{ type: 'query', key: 'date' }], destination: '/home', permanent: false },
      { source: '/runway', has: [{ type: 'query', key: 'step' }], destination: '/home', permanent: false },
    ];
  },
};

export default nextConfig;
