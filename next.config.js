/** @type {import('next').NextConfig} */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.supabase.co https://api.mapbox.com wss://*.supabase.co",
  "frame-src 'self'",
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [{ key: 'Content-Security-Policy', value: csp.join('; ') }],
      },
    ];
  },
};

module.exports = nextConfig;
