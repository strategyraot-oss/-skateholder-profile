"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/origin";

export type AuthState = { error?: string; ok?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const safeNext = (n: unknown) => {
  const s = typeof n === "string" ? n : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/login") ? s : "/dashboard";
};

/** แปลข้อความ error ของ Supabase Auth เป็นภาษาไทย */
function th(e: { code?: string; message?: string; status?: number }): string {
  switch (e.code) {
    case "invalid_credentials": return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    case "email_not_confirmed": return "ยังไม่ได้ยืนยันอีเมล กรุณากดลิงก์ยืนยันในอีเมลที่ได้รับก่อน";
    case "user_already_exists":
    case "email_exists": return "อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ หรือใช้เมนูลืมรหัสผ่าน";
    case "weak_password": return "รหัสผ่านคาดเดาง่ายเกินไป กรุณาตั้งให้ยาวขึ้นหรือผสมตัวเลข/ตัวอักษร";
    case "same_password": return "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit": return "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่";
    case "signup_disabled": return "ระบบปิดการสมัครด้วยตนเอง กรุณาติดต่อผู้ดูแลระบบ";
    case "user_banned": return "บัญชีนี้ถูกระงับ กรุณาติดต่อผู้ดูแลระบบ";
  }
  if (e.status === 0 || /fetch failed|ENOTFOUND|network/i.test(e.message ?? ""))
    return "เชื่อมต่อฐานข้อมูล Supabase ไม่ได้ กรุณาตรวจสอบ Project URL";
  if (/invalid api key|no api key/i.test(e.message ?? "")) return "Anon Key ไม่ถูกต้อง กรุณาตรวจสอบการตั้งค่า";
  return e.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่";
}

export async function login(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!EMAIL.test(email) || !password) return { error: "กรุณากรอกอีเมลและรหัสผ่าน" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: th(error) };
  redirect(safeNext(fd.get("next")));
}

export async function register(_: AuthState, fd: FormData): Promise<AuthState> {
  const full_name = String(fd.get("full_name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (!full_name) return { error: "กรุณากรอกชื่อ-สกุล" };
  if (!EMAIL.test(email)) return { error: "รูปแบบอีเมลไม่ถูกต้อง" };
  if (password.length < 8) return { error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
  if (password !== confirm) return { error: "ยืนยันรหัสผ่านไม่ตรงกัน" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name }, emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/dashboard` },
  });
  if (error) return { error: th(error) };
  // Supabase คืน user ที่ไม่มี identities เมื่ออีเมลนี้สมัครไว้แล้ว
  if (data.user && data.user.identities?.length === 0) return { error: th({ code: "user_already_exists" }) };
  if (data.session) redirect("/dashboard"); // ปิดการยืนยันอีเมลไว้: เข้าสู่ระบบทันที (รอผู้ดูแลระบบเปิดใช้งาน)
  return { ok: "สมัครสำเร็จ กรุณาเปิดอีเมลแล้วกดลิงก์ยืนยัน จากนั้นรอผู้ดูแลระบบเปิดใช้งานบัญชีและกำหนดส่วนงาน" };
}

export async function forgotPassword(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { error: "รูปแบบอีเมลไม่ถูกต้อง" };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/reset-password`,
  });
  if (error && /rate_limit/.test(error.code ?? "")) return { error: th(error) };
  // ไม่บอกว่าอีเมลมีในระบบหรือไม่ (ป้องกันการสุ่มหาบัญชี)
  return { ok: "หากอีเมลนี้มีบัญชีอยู่ ระบบได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว กรุณาตรวจสอบกล่องจดหมาย (รวมถึงจดหมายขยะ)" };
}

export async function updatePassword(_: AuthState, fd: FormData): Promise<AuthState> {
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (password.length < 8) return { error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
  if (password !== confirm) return { error: "ยืนยันรหัสผ่านไม่ตรงกัน" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "ลิงก์หมดอายุ กรุณาขอลิงก์ตั้งรหัสผ่านใหม่อีกครั้ง" };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: th(error) };
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
