import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * รับลิงก์จากอีเมลของ Supabase (ยืนยันอีเมล / ตั้งรหัสผ่านใหม่ / เชิญ)
 * รองรับทั้ง 3 รูปแบบ: ?code= (PKCE), ?token_hash=&type= (OTP) และ #access_token= (implicit → ส่งต่อให้หน้า /auth/complete)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const tokenHash = sp.get("token_hash");
  const type = sp.get("type") as EmailOtpType | null;
  let next = sp.get("next") ?? "/dashboard";
  if (!next.startsWith("/") || next.startsWith("//")) next = "/dashboard";
  if (type === "recovery") next = "/reset-password";

  if (sp.get("error_description")) redirect("/login?error=link");

  if (code || (tokenHash && type)) {
    const supabase = await createClient();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ type: type!, token_hash: tokenHash! });
    redirect(error ? "/login?error=link" : next);
  }

  // ไม่มี code ใน query: token อาจอยู่หลัง # ซึ่ง server มองไม่เห็น (browser จะคง # ไว้เมื่อ redirect)
  redirect(`/auth/complete?next=${encodeURIComponent(next)}`);
}
