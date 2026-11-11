import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getReference, readFilters } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { buildWorkbook } from "@/lib/excel/workbook";
import { viewRowToSheet, type ViewRow } from "@/lib/excel/mapping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE = 1000;

export async function GET(req: NextRequest) {
  const { profile } = await getSession();
  if (!profile?.active) return new Response("กรุณาเข้าสู่ระบบ", { status: 401 });

  const ref = await getReference();
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const f = readFilters(sp, ref);
  const supabase = await createClient();

  const rows: ViewRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from("v_stakeholder_rows").select("*");
    if (f.fy) q = q.eq("fiscal_year_id", f.fy);
    if (f.dept) q = q.eq("department_id", f.dept);
    if (f.group) q = q.eq("group_id", f.group);
    if (f.subgroup) q = q.eq("subgroup_id", f.subgroup);
    if (sp.status) q = q.eq("status", sp.status);
    const { data, error } = await q
      .order("department_code").order("group_sort").order("subgroup_sort", { nullsFirst: false })
      .order("name").order("stakeholder_id").order("issue_sort", { nullsFirst: false })
      .range(from, from + PAGE - 1);
    if (error) return new Response(`ส่งออกไม่สำเร็จ: ${error.message}`, { status: 500 });
    rows.push(...((data ?? []) as ViewRow[]));
    if (!data || data.length < PAGE) break;
  }

  const buf = await buildWorkbook(rows.map(viewRowToSheet));
  const fy = ref.fiscalYears.find((x) => x.id === f.fy);
  const dept = profile.role === "dept_user" ? profile.department?.code : ref.departments.find((d) => d.id === f.dept)?.code;
  const filename = `Stakeholder Profile กยท.${fy ? ` ${fy.year_be}` : ""}${dept ? ` ${dept}` : ""}.xlsx`;

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="stakeholder-profile.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
