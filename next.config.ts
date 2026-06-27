import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb", // allow meter photo upload (base64 ~1.3× raw size)
    },
  },
}

export default nextConfig
