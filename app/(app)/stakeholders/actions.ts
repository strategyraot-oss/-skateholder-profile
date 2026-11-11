"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { getReference } from "@/lib/data";
import { BASIC_FIELDS, type WizardState } from "@/lib/wizard";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type SaveResult = { ok: true; id: string; savedAt: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const score = (v: unknown, max: number) => (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= max ? v : null);

function friendly(e: { message?: string; code?: string } | null): string {
  if (!e) return "เกิดข้อผิดพลาด";
  if (e.code === "42501" || /row-level security/i.test(e.message ?? ""))
    return "ไม่สามารถบันทึกได้: ท่านไม่มีสิทธิ์ในรายการนี้ หรือระบบปิดรับข้อมูลแล้ว";
  if (e.code === "23503") return "ข้อมูลอ้างอิงไม่ถูกต้อง (กลุ่ม/กลุ่มย่อย/ส่วนงาน) กรุณาเลือกใหม่";
  return e.message ?? "เกิดข้อผิดพลาด";
}

/** บันทึกฉบับร่าง (ใช้ทั้ง Auto Save และปุ่มบันทึก) */
export async function saveStakeholder(state: WizardState): Promise<SaveResult> {
  const { profile } = await getSession();
  if (!profile?.active) return { ok: false, error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };
  if (!state.group_id) return { ok: false, error: "กรุณาเลือกกลุ่มผู้มีส่วนได้ส่วนเสียก่อน" };
  if (state.id && !UUID.test(state.id)) return { ok: false, error: "รหัสรายการไม่ถูกต้อง" };

  const ref = await getReference();
  const supabase = await createClient();
  const sg = ref.subgroups.find((x) => x.id === state.subgroup_id && x.group_id === state.group_id);

  const row: Record<string, unknown> = {
    group_id: state.group_id,
    subgroup_id: sg?.id ?? null,
    other_text: txt(state.other_text),
    name: (state.name ?? "").trim(),
    objective: txt(state.objective),
  };
  for (const f of BASIC_FIELDS) row[f] = txt(state[f]);
  if (profile.role === "admin" && state.department_id) row.department_id = state.department_id;

  let id = state.id;
  if (id) {
    const { data, error } = await supabase.from("stakeholders").update(row).eq("id", id).select("id");
    if (error) return { ok: false, error: friendly(error) };
    if (!data?.length) return { ok: false, error: "แก้ไขรายการนี้ไม่ได้ (ส่งตรวจสอบแล้ว หรือระบบปิดรับข้อมูล)" };
  } else {
    const fy = ref.fiscalYears.find((f) => f.id === state.fiscal_year_id) ?? ref.currentFy;
    if (!fy) return { ok: false, error: "ยังไม่ได้กำหนดรอบปีงบประมาณ กรุณาติดต่อผู้ดูแลระบบ" };
    const department_id = profile.role === "admin" ? state.department_id : profile.department_id;
    if (!department_id) return { ok: false, error: "กรุณาเลือกส่วนงานผู้กรอกข้อมูล" };
    id = crypto.randomUUID();
    const { error } = await supabase
      .from("stakeholders")
      .insert({ id, ...row, fiscal_year_id: fy.id, department_id, status: "draft" });
    if (error) return { ok: false, error: friendly(error) };
  }

  // ประเด็นความต้องการ: ลบที่ถูกเอาออก แล้ว upsert ที่เหลือ
  const issues = (state.issues ?? []).filter((i) => UUID.test(i.id));
  let del = supabase.from("stakeholder_issues").delete().eq("stakeholder_id", id);
  if (issues.length) del = del.not("id", "in", `(${issues.map((i) => i.id).join(",")})`);
  const { error: delErr } = await del;
  if (delErr) return { ok: false, error: friendly(delErr) };

  if (issues.length) {
    const rows = issues.map((i, idx) => ({
      id: i.id,
      stakeholder_id: id,
      sort: idx,
      issue_text: (i.issue_text ?? "").trim(),
      interest: score(i.interest, 5),
      influence: score(i.influence, 5),
      impact_org: score(i.impact_org, 4),
      impact_sh: score(i.impact_sh, 4),
      engagement_level: i.engagement_level || null,
      channel: txt(i.channel),
      frequency: txt(i.frequency),
      responsible_unit: txt(i.responsible_unit),
      constraints: txt(i.constraints),
      remark: txt(i.remark),
    }));
    const { error } = await supabase.from("stakeholder_issues").upsert(rows, { onConflict: "id" });
    if (error) return { ok: false, error: friendly(error) };
  }

  revalidatePath("/stakeholders");
  return { ok: true, id: id!, savedAt: new Date().toISOString() };
}

async function rpc(fn: string, args: Record<string, unknown>, paths: string[]): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: friendly(error) };
  paths.forEach((p) => revalidatePath(p));
  return { ok: true };
}

export async function submitStakeholder(id: string) {
  return rpc("submit_stakeholder", { p_id: id }, ["/stakeholders", `/stakeholders/${id}`, "/completeness", "/dashboard"]);
}
export async function returnStakeholder(id: string, comment: string) {
  return rpc("return_stakeholder", { p_id: id, p_comment: comment }, ["/stakeholders", `/stakeholders/${id}`]);
}
export async function approveStakeholder(id: string, comment: string) {
  return rpc("approve_stakeholder", { p_id: id, p_comment: comment }, ["/stakeholders", `/stakeholders/${id}`, "/dashboard"]);
}
export async function commentStakeholder(id: string, comment: string) {
  return rpc("comment_stakeholder", { p_id: id, p_comment: comment }, [`/stakeholders/${id}`]);
}

export async function deleteStakeholder(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("stakeholders").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: friendly(error) };
  if (!data?.length) return { ok: false, error: "ลบได้เฉพาะฉบับร่างของส่วนงานตนเอง" };
  revalidatePath("/stakeholders");
  redirect("/stakeholders");
}

export type Duplicate = { id: string; name: string; department_name: string; subgroup_name: string | null; similarity: number };

/** Duplicate Detection: แจ้งเตือนเท่านั้น */
export async function findDuplicates(name: string, fiscalYearId: string | null, excludeId?: string): Promise<Duplicate[]> {
  if (!name || name.trim().length < 3 || !fiscalYearId) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("find_similar_stakeholders", {
    p_name: name,
    p_fiscal_year: fiscalYearId,
    p_exclude: excludeId ?? null,
  });
  return (data ?? []) as Duplicate[];
}

export type CopySource = { id: string; name: string; department_code: string; subgroup_name: string | null; year_be: number };

export async function searchCopySources(q: string): Promise<CopySource[]> {
  const term = q.trim().replace(/[%,()]/g, " ");
  if (term.length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_stakeholder_list")
    .select("id, name, department_code, subgroup_name, year_be")
    .ilike("name", `%${term}%`)
    .order("updated_at", { ascending: false })
    .limit(8);
  return (data ?? []) as CopySource[];
}

/** Copy Previous Data: คืนข้อมูลกลุ่มและข้อมูลพื้นฐาน (ขั้นตอนที่ 1–2) */
export async function getCopySource(id: string): Promise<Partial<WizardState> | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stakeholders")
    .select("group_id, subgroup_id, other_text, name, type_status, address, business_relation, coordinator, coordinator_contact, decision_maker, decision_maker_contact, objective")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) out[k] = v ?? (k.endsWith("_id") ? null : "");
  return out as Partial<WizardState>;
}
