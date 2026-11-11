import { cache } from "react";
import { createClient } from "./supabase/server";
import type { Department, FiscalYear, StakeholderGroup, StakeholderSubgroup } from "./types";

/** ข้อมูลอ้างอิงที่ใช้แทบทุกหน้า (cache ต่อ 1 request) */
export const getReference = cache(async () => {
  const supabase = await createClient();
  const [g, sg, d, fy] = await Promise.all([
    supabase.from("stakeholder_groups").select("id, code, name, sort, is_other").order("sort"),
    supabase.from("stakeholder_subgroups").select("id, group_id, code, name, sort, is_other").order("sort"),
    supabase.from("departments").select("id, code, name, active").order("code"),
    supabase.from("fiscal_years").select("id, year_be, start_date, end_date, is_open, is_current").order("year_be", { ascending: false }),
  ]);
  const fiscalYears = (fy.data ?? []) as FiscalYear[];
  return {
    groups: (g.data ?? []) as StakeholderGroup[],
    subgroups: (sg.data ?? []) as StakeholderSubgroup[],
    departments: (d.data ?? []) as Department[],
    fiscalYears,
    currentFy: fiscalYears.find((f) => f.is_current) ?? fiscalYears[0] ?? null,
  };
});

export type Reference = Awaited<ReturnType<typeof getReference>>;

/** อ่านตัวกรองมาตรฐานจาก searchParams */
export function readFilters(
  sp: Record<string, string | string[] | undefined>,
  ref: Reference,
): { fy: string | null; dept: string | null; group: string | null; subgroup: string | null } {
  const one = (k: string) => {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s && s !== "all" ? s : null;
  };
  const fyParam = sp.fy === "all" ? null : one("fy") ?? ref.currentFy?.id ?? null;
  return { fy: fyParam, dept: one("dept"), group: one("group"), subgroup: one("subgroup") };
}

export function isWritableFy(fy: FiscalYear | null | undefined, today = new Date()): boolean {
  if (!fy?.is_open) return false;
  const d = today.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
  return (!fy.start_date || d >= fy.start_date) && (!fy.end_date || d <= fy.end_date);
}
