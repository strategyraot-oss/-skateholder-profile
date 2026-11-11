import { createClient } from "@supabase/supabase-js";

/** Service-role client: ใช้เฉพาะใน server action หลังตรวจว่าผู้เรียกเป็น admin แล้วเท่านั้น */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY ใน Vercel");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
