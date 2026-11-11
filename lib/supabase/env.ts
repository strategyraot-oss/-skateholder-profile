// ค่าที่ใช้เชื่อม Supabase มีเพียง 2 ค่า: Project URL และ Anon Key
// (อ้างถึง process.env แบบตรงตัว เพื่อให้ Next.js ฝังค่าลงฝั่ง browser ได้)

export type SupabaseEnv = { url: string; key: string };

export function supabaseEnv(): SupabaseEnv | null {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!rawUrl || !key) return null;
  try {
    // รองรับกรณีวาง URL มาพร้อม / หรือ /rest/v1 ต่อท้าย
    return { url: new URL(rawUrl).origin, key };
  } catch {
    return null;
  }
}

export function requireSupabaseEnv(): SupabaseEnv {
  const env = supabaseEnv();
  if (!env) throw new Error("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return env;
}

export function envStatus() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  let urlValid = false;
  try { urlValid = !!url && /^https?:$/.test(new URL(url).protocol); } catch {}
  return { hasUrl: !!url, urlValid, hasKey: !!key, keyLooksValid: key.split(".").length === 3 || key.startsWith("sb_publishable_") };
}
