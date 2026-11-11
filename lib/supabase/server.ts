import { createServerClient } from "@supabase/ssr";
import { createClient as createJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { requireSupabaseEnv } from "./env";

/** Client ฝั่ง server ที่ผูกกับ session (cookie) ของผู้ใช้ปัจจุบัน — สิทธิ์ตาม RLS */
export async function createClient() {
  const { url, key } = requireSupabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // เรียกจาก Server Component: middleware จะ refresh session ให้แทน
        }
      },
    },
  });
}

/** Client แยกที่ไม่เก็บ session — ใช้สมัครบัญชีให้ผู้อื่น/ส่งอีเมล โดยไม่กระทบ session ของผู้ดูแลระบบ */
export function createIsolatedClient() {
  const { url, key } = requireSupabaseEnv();
  return createJsClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
