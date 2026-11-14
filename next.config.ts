import type { NextConfig } from "next";

// Coolify MinIO public bucket host (from S3_PUBLIC_URL) is allowed for next/image.
const s3 = (() => {
  try {
    return process.env.S3_PUBLIC_URL ? new URL(process.env.S3_PUBLIC_URL) : null;
  } catch {
    return null;
  }
})();

/**
 * Every script on this site is first-party, so script-src can be locked to 'self'.
 * 'unsafe-inline' stays because Next's bootstrap and the pre-paint failsafe are
 * inline and nonces would force every page to render dynamically; it still stops
 * an attacker loading script from another origin or exfiltrating over connect-src.
 * Adding a payment gateway later means adding its script/connect/frame origins here.
 */
const imageHosts = ["https://res.cloudinary.com", "https://*.public.blob.vercel-storage.com", ...(s3 ? [s3.origin] : [])].join(" ");

// Only when the site itself is served over HTTPS. On a plain-HTTP deployment
// (a Coolify instance before its certificate is issued) this directive upgrades
// every stylesheet and script request to https://, which then fails — the page
// renders as unstyled HTML.
const httpsOrigin = (process.env.APP_URL ?? "").startsWith("https://");

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${imageHosts}`,
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  ...(httpsOrigin ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: csp },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

// Coolify MinIO public bucket host (from S3_PUBLIC_URL) is allowed for next/image.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      ...(s3 ? [{ protocol: s3.protocol.replace(":", "") as "https" | "http", hostname: s3.hostname, ...(s3.port ? { port: s3.port } : {}) }] : []),
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Never cache personal pages or admin.
      { source: "/(admin|account|order|checkout)/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};

export default nextConfig;
