import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.lead360.app', // Allow all lead360.app subdomains (tenant subdomains + app)
        port: '',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'lead360.app', // Allow root domain
        port: '',
        pathname: '/uploads/**',
      },
    ],
  },
};

export default nextConfig;
