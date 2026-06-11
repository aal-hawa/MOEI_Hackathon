import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  transpilePackages: ['socket.io-client'],
  allowedDevOrigins: [
    // Allow sandbox preview panel origins
    '.space-z.ai',
  ],
  // Cloudflare Pages compatibility
  images: {
    unoptimized: true, // Cloudflare Pages doesn't support Next.js image optimization
  },
  // Security headers are handled in middleware.ts
};

export default nextConfig;
