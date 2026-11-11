import { headers } from "next/headers";

/** URL ของเว็บไซต์ปัจจุบัน (ใช้สร้างลิงก์ในอีเมลยืนยัน/ตั้งรหัสผ่าน) */
export async function siteOrigin(): Promise<string> {
  const fixed = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fixed) return fixed.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
