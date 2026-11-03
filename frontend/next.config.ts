import type { NextConfig } from "next";

/**
 * The browser only ever calls same-origin `/api/backend/*`. Next rewrites that
 * prefix to the FastAPI service so demo mode needs no CORS configuration and no
 * NEXT_PUBLIC_ secret. Point BACKEND_ORIGIN at a deployed API in production.
 */
const backendOrigin =
  process.env.BACKEND_ORIGIN?.replace(/\/$/, "") ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendOrigin}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
