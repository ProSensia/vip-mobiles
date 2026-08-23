import path from "node:path";

const API_URL = process.env.API_INTERNAL_URL || "http://localhost:4000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Without this, Next auto-detects the "workspace root" by walking up for
  // any ancestor lockfile — and finds one at the repo root (packages/db and
  // packages/shared still have their own package-lock.json there). That
  // misdetection breaks the "@/*" tsconfig path alias and produces "Module
  // not found" errors for every "@/..." import. Pinning it here forces Next
  // to treat this folder as self-contained, which it is.
  outputFileTracingRoot: path.resolve(import.meta.dirname),
  images: {
    // The API's upload pipeline already produces properly sized WebP/AVIF
    // renditions (large/medium/thumb) server-side, so Next's own on-demand
    // image re-optimization is redundant here — and skipping it avoids its
    // CPU/memory cost on constrained shared hosting, its unbounded on-disk
    // cache, and known CVEs in the image-optimizer's bundled dependencies.
    unoptimized: true,
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
      { source: "/uploads/:path*", destination: `${API_URL}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
