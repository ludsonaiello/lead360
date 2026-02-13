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

  // Proxy Twilio webhook routes to backend API (development only)
  // In production, Nginx handles this routing
  // NOTE: Webhooks bypass Next.js entirely - this rewrite may not be needed
  // as Twilio calls the backend directly via Nginx routing
};

export default nextConfig;
