"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getReference, isWritableFy } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { parseWorkbook } from "@/lib/excel/workbook";
import { resolveImport, type PreviewRow } from "@/lib/excel/mapping";

export type ImportResult = {
  ok: boolean;
  error?: string;
  missingHeaders?: string[];
  preview?: PreviewRow[];
  summary?: { rows: number; importable: number; stakeholders: number; issues: number; complete: number };
  committed?: { stakeholders: number; issues: number };
};

const MAX = 10 * 1024 * 1024;

export async function importExcel(formData: FormData): Promise<ImportResult> {
  const { user, profile } = await getSession();
  if (!user || !profile?.active || profile.role === "reviewer") return { ok: false, error: "ท่านไม่มีสิทธิ์นำเข้าข้อมูล" };

  const file = formData.get("file");
  const mode = formData.get("mode") === "commit" ? "commit" : "preview";
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "กรุณาเลือกไฟล์ Excel" };
  if (!/\.xlsx$/i.test(file.name)) return { ok: false, error: "รองรับเฉพาะไฟล์ .xlsx" };
  if (file.size > MAX) return { ok: false, error: "ไฟล์มีขนาดเกิน 10 MB" };

  const ref = await getReference();
  const fy = ref.fiscalYears.find((f) => f.id === formData.get("fy")) ?? ref.currentFy;
  if (!fy) return { ok: false, error: "ยังไม่ได้กำหนดรอบปีงบประมาณ" };
  if (profile.role !== "admin" && !isWritableFy(fy)) return { ok: false, error: "ระบบปิดรับข้อมูลของรอบปีงบประมาณนี้แล้ว" };

  const buf = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = await parseWorkbook(buf);
  } catch {
    return { ok: false, error: "อ่านไฟล์ไม่ได้ กรุณาตรวจสอบว่าเป็นไฟล์ Excel (.xlsx) ที่ถูกต้อง" };
  }
  if (!parsed.headerOk)
    return { ok: false, error: "รูปแบบไฟล์ไม่ตรงกับแบบกรอกข้อมูลต้นฉบับ กรุณาใช้ไฟล์แบบฟอร์มของ กยท.", missingHeaders: parsed.missingHeaders };

  const forced = profile.role === "dept_user" ? ref.departments.find((d) => d.id === profile.department_id) ?? null : null;
  const { preview, stakeholders } = resolveImport(parsed.rows, {
    departments: ref.departments, groups: ref.groups, subgroups: ref.subgroups, forcedDepartment: forced,
  });
  const summary = {
    rows: preview.length,
    importable: preview.filter((p) => !p.errors.length).length,
    stakeholders: stakeholders.length,
    issues: stakeholders.reduce((a, s) => a + s.issues.length, 0),
    complete: preview.filter((p) => p.status === "ครบถ้วน").length,
  };
  if (mode === "preview") return { ok: true, preview, summary, missingHeaders: parsed.missingHeaders };
  if (!stakeholders.length) return { ok: false, error: "ไม่มีแถวที่นำเข้าได้", preview, summary };

  const supabase = await createClient();
  // เก็บไฟล์ต้นฉบับไว้ใน Storage (ไม่บล็อกการนำเข้าหากล้มเหลว)
  await supabase.storage
    .from("imports")
    .upload(`${user.id}/${Date.now()}-import.xlsx`, buf, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    .catch(() => null);

  const shRows = stakeholders.map((s) => {
    const { issues: _i, rows: _r, ...rest } = s;
    return { id: crypto.randomUUID(), fiscal_year_id: fy.id, status: "draft", ...rest };
  });
  const issueRows = stakeholders.flatMap((s, idx) =>
    s.issues.map((i, sort) => ({ id: crypto.randomUUID(), stakeholder_id: shRows[idx].id, sort, ...i })),
  );

  const inserted: string[] = [];
  const rollback = async () => {
    for (let i = 0; i < inserted.length; i += 200) await supabase.from("stakeholders").delete().in("id", inserted.slice(i, i + 200));
  };

  for (let i = 0; i < shRows.length; i += 500) {
    const chunk = shRows.slice(i, i + 500);
    const { error } = await supabase.from("stakeholders").insert(chunk);
    if (error) {
      await rollback();
      return { ok: false, error: `นำเข้าไม่สำเร็จ (ยกเลิกทั้งหมดแล้ว): ${error.message}`, preview, summary };
    }
    inserted.push(...chunk.map((c) => c.id));
  }
  for (let i = 0; i < issueRows.length; i += 1000) {
    const { error } = await supabase.from("stakeholder_issues").insert(issueRows.slice(i, i + 1000));
    if (error) {
      await rollback();
      return { ok: false, error: `นำเข้าประเด็นไม่สำเร็จ (ยกเลิกทั้งหมดแล้ว): ${error.message}`, preview, summary };
    }
  }

  revalidatePath("/stakeholders");
  revalidatePath("/dashboard");
  return { ok: true, preview, summary, committed: { stakeholders: shRows.length, issues: issueRows.length } };
}
