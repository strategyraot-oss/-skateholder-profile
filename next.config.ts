import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  serverExternalPackages: ["exceljs"],
  // build บน Vercel โดยตรง (ไม่มีเครื่อง dev สำหรับ lint) — unit test รันก่อน build ใน npm run build
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
