/** @type {import('next').NextConfig} */
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const production = process.env.NODE_ENV === 'production';
if (production && (!apiBaseUrl || process.env.NEXT_PUBLIC_USE_MOCK === 'true')) {
  throw new Error('Production builds require NEXT_PUBLIC_API_BASE_URL and NEXT_PUBLIC_USE_MOCK=false.');
}

const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
let supabaseKeyRole;
const keyParts = supabaseKey.split('.');
if (keyParts.length === 3) {
  try {
    // Inspect legacy key metadata for accidental exposure; Supabase verifies the key.
    supabaseKeyRole = JSON.parse(Buffer.from(keyParts[1], 'base64url').toString('utf8')).role;
  } catch {
    // Publishable keys and local placeholders do not contain JWT metadata.
  }
}
if (supabaseKey.startsWith('sb_secret_') || (supabaseKeyRole && supabaseKeyRole !== 'anon')) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY must be a Supabase anon or publishable key. Privileged keys belong only on the backend.');
}

let apiOrigin = '';

if (apiBaseUrl && /^https?:\/\//.test(apiBaseUrl)) {
  apiOrigin = new URL(apiBaseUrl).origin;
}

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${production ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https:",
  `connect-src 'self' https://*.supabase.co https://api.mapbox.com wss://*.supabase.co${apiOrigin ? ` ${apiOrigin}` : ''}`,
  "frame-src 'self' https://www.openstreetmap.org",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
];

const nextConfig = {
  reactStrictMode: true,
  turbopack: { root: __dirname },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp.join('; ') },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...(production ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
        ],
      },
      {
        source: '/demo/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp.map(rule => rule === "frame-ancestors 'none'" ? "frame-ancestors 'self'" : rule.startsWith("img-src ") ? rule + " blob:" : rule).join('; ') },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
