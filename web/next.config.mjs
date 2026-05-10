/** @type {import('next').NextConfig} */

// Security headers — applied to every response from Next.js.
// CSP intentionally allows 'unsafe-inline' for styles (we use inline style props
// extensively in components) and Google Fonts. Tighten if you remove inline styles.
const securityHeaders = [
  // Prevent the page from being embedded in <iframe> on other origins (clickjacking)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Block content-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Force HTTPS for 2 years, including subdomains. Vercel-friendly.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Don't send the full URL as Referer to other origins
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable powerful features by default
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  // Cross-origin policies (modern, helps isolate the page)
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // remove "X-Powered-By: Next.js" header
  async headers() {
    return [
      {
        // All routes
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // The PWA manifest needs the right content type and caching
        source: "/manifest.webmanifest",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
      {
        // Service worker must NOT be cached aggressively or updates won't propagate
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // .well-known should be discoverable + crawlable
        source: "/.well-known/(.*)",
        headers: [
          { key: "Content-Type", value: "text/plain; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
