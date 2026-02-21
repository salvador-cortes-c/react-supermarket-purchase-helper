import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "a.fsimg.co.nz",
      },
      {
        protocol: "https",
        hostname: "www.newworld.co.nz",
      },
    ],
  },
};

export default nextConfig;
