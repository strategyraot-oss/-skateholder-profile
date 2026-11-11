import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getReference, readFilters } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime, pct } from "@/lib/format";
import { PageHeader, Sel } from "@/components/common";
import { DepartmentsAdmin } from "../settings/SettingsClient";

export const metadata: Metadata = { title: "จัดการข้อมูลส่วนงาน" };

type Progress = {
  id: string; code: string; name: string; active: boolean; total: number; complete: number;
  draft: number; submitted: number; returned: number; approved: number; last_update: string | null;
};

export default async function DepartmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireRole("admin", "reviewer");
  const sp = await searchParams;
  const ref = await getReference();
  const f = readFilters(sp, ref);
  const supabase = await createClient();
  const { data } = await supabase.rpc("department_progress", { p_fiscal_year: f.fy });
  const rows = (data ?? []) as Progress[];
  const fyParam = f.fy ?? "all";

  return (
    <div className="space-y-6">
      <PageHeader title="จัดการข้อมูลส่วนงาน" desc="ติดตามการส่งข้อมูลของแต่ละส่วนงาน และตรวจสอบรายการที่รอการอนุมัติ" />

      <form method="get" className="card flex flex-wrap items-end gap-3 p-4">
        <Sel label="ปีงบประมาณ" name="fy" value={fyParam}>
          <option value="all">ทุกปี</option>
          {ref.fiscalYears.map((y) => <option key={y.id} value={y.id}>{y.year_be}</option>)}
        </Sel>
        <button className="btn-primary">แสดง</button>
      </form>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">ส่วนงาน</th>
                <th className="px-4 py-3 text-right font-medium">รายการ</th>
                <th className="px-4 py-3 text-right font-medium">ครบถ้วน</th>
                <th className="px-4 py-3 text-right font-medium">รอตรวจสอบ</th>
                <th className="px-4 py-3 text-right font-medium">ส่งกลับ</th>
                <th className="px-4 py-3 text-right font-medium">อนุมัติ</th>
                <th className="px-4 py-3 font-medium">อัปเดตล่าสุด</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 tabular-nums">
              {rows.map((r) => (
                <tr key={r.id} className={r.active ? "" : "text-gray-400"}>
                  <td className="px-4 py-3"><b>{r.code}</b> {r.name}{!r.active && " (ปิดใช้งาน)"}</td>
                  <td className="px-4 py-3 text-right">{r.total}</td>
                  <td className="px-4 py-3 text-right">{r.complete} <span className="text-xs text-gray-500">({pct(r.complete, r.total)}%)</span></td>
                  <td className="px-4 py-3 text-right">{r.submitted > 0 ? <b className="text-blue-700">{r.submitted}</b> : 0}</td>
                  <td className="px-4 py-3 text-right">{r.returned}</td>
                  <td className="px-4 py-3 text-right">{r.approved}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDateTime(r.last_update)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link className="text-brand-700 hover:underline" href={`/stakeholders?fy=${fyParam}&dept=${r.id}${r.submitted ? "&status=submitted" : ""}`}>
                      {r.submitted ? "ตรวจสอบรายการ" : "ดูรายการ"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {profile.role === "admin" && (
        <section className="space-y-3">
          <h2 className="font-semibold">รายชื่อส่วนงาน (ผู้ดูแลระบบ)</h2>
          <DepartmentsAdmin departments={ref.departments} />
        </section>
      )}
    </div>
  );
}
