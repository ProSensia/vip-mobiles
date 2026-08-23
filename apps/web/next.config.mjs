const API_URL = process.env.API_INTERNAL_URL || "http://localhost:4000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@vip/shared"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "http", hostname: "localhost" }],
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
      { source: "/uploads/:path*", destination: `${API_URL}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
