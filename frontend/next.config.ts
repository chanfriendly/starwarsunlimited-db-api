import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* other existing config options here */

  // Add the rewrites function for proxying
  async rewrites() {
    return [
      {
        // Source path: Match any request starting with /api/
        source: '/api/:path*',
        // Destination URL: Forward to your FastAPI backend running on port 8000
        // Ensure the port (8000) matches where your backend is actually running.
        destination: 'http://localhost:8000/api/:path*',
      },
      // You can add other rewrite rules here if needed
    ];
  },
};

export default nextConfig;