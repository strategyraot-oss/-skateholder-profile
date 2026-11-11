import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";
import { supabaseEnv } from "./supabase/env";
import type { Profile, UserRole } from "./types";

/** ผู้ใช้ปัจจุบัน + profile (cache ต่อ 1 request) */
export const getSession = cache(async () => {
  if (!supabaseEnv()) redirect("/setup");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, profileError: null };

  // แยกเป็น 2 คำสั่งง่าย ๆ (ไม่ใช้ embed) เพื่อลดจุดที่อาจผิดพลาด
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, department_id, active")
    .eq("id", user.id)
    .maybeSingle<Profile>();
  if (error) return { user, profile: null, profileError: `${error.code ?? ""} ${error.message}`.trim() };
  if (!profile) return { user, profile: null, profileError: null };

  if (profile.department_id) {
    const { data: dept } = await supabase
      .from("departments")
      .select("id, code, name")
      .eq("id", profile.department_id)
      .maybeSingle<{ id: string; code: string; name: string }>();
    profile.department = dept ?? null;
  }
  return { user, profile, profileError: null };
});

/** ใช้ใน page ที่จำกัดสิทธิ์: ไม่มีสิทธิ์จะถูกพาไป Dashboard */
export async function requireRole(...roles: UserRole[]) {
  const { profile } = await getSession();
  if (!profile?.active) redirect("/login");
  if (roles.length && !roles.includes(profile.role)) redirect("/dashboard");
  return profile;
}
