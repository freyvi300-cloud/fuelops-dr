import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Prisma client runs in Node.js runtime, not the Edge runtime
  serverExternalPackages: ["@prisma/client", "prisma"],
}

export default nextConfig
