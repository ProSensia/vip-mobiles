const API_URL = process.env.API_INTERNAL_URL || "http://localhost:4000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@vip/shared"],
  // Produces a self-contained .next/standalone folder (server.js + only the
  // node_modules actually used) — deployable on its own without the monorepo
  // or a workspace-aware `npm install`, e.g. as a cPanel "Setup Node.js App".
  output: "standalone",
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
