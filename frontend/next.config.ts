// frontend/next.config.ts - Simplified networking for Docker

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',
  
  // Basic configuration
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Image configuration
  images: {
    domains: ['cdn.jsdelivr.net', 'placehold.co'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname: '/gh/JimJafar/SWU-images@main/cards/**',
      },
    ],
  },

  // Experimental features
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  // Headers for security and performance
  async headers() {
    // CSP baseline. 'unsafe-inline' is required for Next.js inline scripts and Tailwind.
    // For a stricter policy with nonces, move this to Nginx Proxy Manager's custom config.
    // img-src includes cdn.jsdelivr.net (SWU card images) and data: (placeholders/SVGs).
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https://cdn.jsdelivr.net data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-XSS-Protection',          value: '1; mode=block' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',         value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy',    value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;