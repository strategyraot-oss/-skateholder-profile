"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

export type Result = { ok: true; message?: string } | { ok: false; error: string };

async function admin() {
  const { profile } = await getSession();
  if (profile?.role !== "admin" || !profile.active) throw new Error("เฉพาะผู้ดูแลระบบเท่านั้น");
  return createClient();
}

function wrap(fn: () => Promise<Result>): Promise<Result> {
  return fn().catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "เกิดข้อผิดพลาด" }));
}

function msg(e: { message: string; code?: string }) {
  if (e.code === "23505") return "ข้อมูลซ้ำกับที่มีอยู่แล้ว";
  if (e.code === "23514" && e.message.includes("active_dept_user_needs_department")) return "ผู้ใช้งานส่วนงานต้องกำหนดส่วนงานก่อนเปิดใช้งาน";
  return e.message;
}

const ROLES: UserRole[] = ["admin", "reviewer", "dept_user"];

/* ---------- ผู้ใช้งาน ---------- */
export async function createUser(input: {
  email: string; password: string; full_name: string; role: UserRole; department_id: string | null;
}): Promise<Result> {
  return wrap(async () => {
    await admin();
    const email = input.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "รูปแบบอีเมลไม่ถูกต้อง" };
    if (input.password.length < 8) return { ok: false, error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
    if (!ROLES.includes(input.role)) return { ok: false, error: "บทบาทไม่ถูกต้อง" };
    if (input.role === "dept_user" && !input.department_id) return { ok: false, error: "กรุณาเลือกส่วนงานของผู้ใช้" };

    const sa = createAdminClient();
    const { data, error } = await sa.auth.admin.createUser({
      email, password: input.password, email_confirm: true, user_metadata: { full_name: input.full_name },
    });
    if (error || !data.user) return { ok: false, error: error?.message ?? "สร้างผู้ใช้ไม่สำเร็จ" };

    const { error: pe } = await sa.from("profiles").upsert({
      id: data.user.id, email, full_name: input.full_name.trim() || email, role: input.role,
      department_id: input.department_id, active: true,
    });
    if (pe) return { ok: false, error: msg(pe) };
    revalidatePath("/settings");
    return { ok: true, message: `สร้างบัญชี ${email} แล้ว` };
  });
}

export async function updateUser(input: {
  id: string; full_name: string; role: UserRole; department_id: string | null; active: boolean; reviewer_departments: string[];
}): Promise<Result> {
  return wrap(async () => {
    const supabase = await admin();
    const { profile } = await getSession();
    if (input.id === profile!.id && (!input.active || input.role !== "admin"))
      return { ok: false, error: "ไม่สามารถลดสิทธิ์หรือปิดบัญชีของตนเองได้" };
    if (!ROLES.includes(input.role)) return { ok: false, error: "บทบาทไม่ถูกต้อง" };

    const { error } = await supabase.from("profiles").update({
      full_name: input.full_name.trim() || null, role: input.role, department_id: input.department_id, active: input.active,
    }).eq("id", input.id);
    if (error) return { ok: false, error: msg(error) };

    await supabase.from("reviewer_departments").delete().eq("reviewer_id", input.id);
    if (input.role === "reviewer" && input.reviewer_departments.length) {
      const { error: re } = await supabase.from("reviewer_departments")
        .insert(input.reviewer_departments.map((d) => ({ reviewer_id: input.id, department_id: d })));
      if (re) return { ok: false, error: msg(re) };
    }
    revalidatePath("/settings");
    return { ok: true, message: "บันทึกแล้ว" };
  });
}

export async function resetPassword(id: string, password: string): Promise<Result> {
  return wrap(async () => {
    await admin();
    if (password.length < 8) return { ok: false, error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
    const { error } = await createAdminClient().auth.admin.updateUserById(id, { password });
    if (error) return { ok: false, error: error.message };
    return { ok: true, message: "ตั้งรหัสผ่านใหม่แล้ว" };
  });
}

/* ---------- รอบปีงบประมาณ ---------- */
export async function saveFiscalYear(input: {
  id?: string; year_be: number; start_date: string | null; end_date: string | null; is_open: boolean;
}): Promise<Result> {
  return wrap(async () => {
    const supabase = await admin();
    if (!Number.isInteger(input.year_be) || input.year_be < 2500 || input.year_be > 2700) return { ok: false, error: "ปีงบประมาณต้องเป็นปี พ.ศ. เช่น 2570" };
    if (input.start_date && input.end_date && input.end_date < input.start_date) return { ok: false, error: "วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น" };
    const row = { year_be: input.year_be, start_date: input.start_date || null, end_date: input.end_date || null, is_open: input.is_open };
    const { error } = input.id
      ? await supabase.from("fiscal_years").update(row).eq("id", input.id)
      : await supabase.from("fiscal_years").insert(row);
    if (error) return { ok: false, error: msg(error) };
    revalidatePath("/", "layout");
    return { ok: true, message: "บันทึกรอบปีงบประมาณแล้ว" };
  });
}

export async function setCurrentFiscalYear(id: string): Promise<Result> {
  return wrap(async () => {
    const supabase = await admin();
    const { error: e1 } = await supabase.from("fiscal_years").update({ is_current: false }).eq("is_current", true);
    if (e1) return { ok: false, error: msg(e1) };
    const { error } = await supabase.from("fiscal_years").update({ is_current: true }).eq("id", id);
    if (error) return { ok: false, error: msg(error) };
    revalidatePath("/", "layout");
    return { ok: true, message: "ตั้งเป็นปีงบประมาณปัจจุบันแล้ว" };
  });
}

/* ---------- ส่วนงาน ---------- */
export async function saveDepartment(input: { id?: string; code: string; name: string; active: boolean }): Promise<Result> {
  return wrap(async () => {
    const supabase = await admin();
    const code = input.code.trim();
    const name = input.name.trim();
    if (!code || !name) return { ok: false, error: "กรุณาระบุอักษรย่อและชื่อส่วนงาน" };
    const row = { code, name, active: input.active };
    const { error } = input.id
      ? await supabase.from("departments").update(row).eq("id", input.id)
      : await supabase.from("departments").insert(row);
    if (error) return { ok: false, error: msg(error) };
    revalidatePath("/departments");
    return { ok: true, message: "บันทึกส่วนงานแล้ว" };
  });
}
