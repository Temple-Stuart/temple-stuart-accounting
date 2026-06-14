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
    ];
  },
};

export default nextConfig;
