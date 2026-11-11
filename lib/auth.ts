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
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, department_id, active, department:departments!profiles_department_id_fkey(id, code, name)")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return { user, profile: profile ?? null };
});

/** ใช้ใน page ที่จำกัดสิทธิ์: ไม่มีสิทธิ์จะถูกพาไป Dashboard */
export async function requireRole(...roles: UserRole[]) {
  const { profile } = await getSession();
  if (!profile?.active) redirect("/login");
  if (roles.length && !roles.includes(profile.role)) redirect("/dashboard");
  return profile;
}
