import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/google1b2f6d63e96002d8.html",
        destination: "/api/google-verify",
      },
    ];
  },
};

export default nextConfig;
