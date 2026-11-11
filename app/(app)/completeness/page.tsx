import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getReference, readFilters } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime, pct } from "@/lib/format";
import { Empty, PageHeader, StatusBadge } from "@/components/common";
import type { RecordStatus } from "@/lib/types";

export const metadata: Metadata = { title: "ตรวจสอบความครบถ้วน" };

type Progress = {
  id: string; code: string; name: string; active: boolean; total: number; complete: number;
  draft: number; submitted: number; returned: number; approved: number; last_update: string | null;
};
type Row = { id: string; name: string; status: RecordStatus; department_code: string; subgroup_name: string | null; first_problem: string | null; incomplete_rows: number; issue_count: number; updated_at: string };

export default async function CompletenessPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { profile } = await getSession();
  const ref = await getReference();
  const f = readFilters(sp, ref);
  const supabase = await createClient();

  const listQuery = (complete: boolean) => {
    let q = supabase
      .from("v_stakeholder_list")
      .select("id, name, status, department_code, subgroup_name, first_problem, incomplete_rows, issue_count, updated_at")
      .eq("is_complete", complete);
    if (f.fy) q = q.eq("fiscal_year_id", f.fy);
    if (!complete) return q.order("updated_at", { ascending: false }).limit(100);
    return q.in("status", ["draft", "returned"]).order("updated_at", { ascending: false }).limit(50);
  };

  const [{ data: prog }, { data: incomplete }, { data: ready }] = await Promise.all([
    supabase.rpc("department_progress", { p_fiscal_year: f.fy }),
    listQuery(false),
    listQuery(true),
  ]);
  const progress = ((prog ?? []) as Progress[]).filter((p) => p.active || p.total > 0);
  const totals = progress.reduce((a, p) => ({ total: a.total + p.total, complete: a.complete + p.complete, approved: a.approved + p.approved }), { total: 0, complete: 0, approved: 0 });
  const fy = ref.fiscalYears.find((x) => x.id === f.fy);
  const canEdit = profile?.role !== "reviewer";

  return (
    <div className="space-y-6">
      <PageHeader
        title="ตรวจสอบความครบถ้วน"
        desc={`${fy ? `ปีงบประมาณ ${fy.year_be}` : "ทุกปีงบประมาณ"} · ทุกรายการต้องขึ้นสถานะ “ครบถ้วน” ก่อนส่งให้กองประเมินผล`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="รายการทั้งหมด" value={totals.total} />
        <Stat label="ครบถ้วน" value={totals.complete} sub={`${pct(totals.complete, totals.total)}%`} bar={pct(totals.complete, totals.total)} />
        <Stat label="อนุมัติแล้ว" value={totals.approved} sub={`${pct(totals.approved, totals.total)}%`} bar={pct(totals.approved, totals.total)} />
      </div>

      <section className="card overflow-hidden">
        <h2 className="border-b border-gray-100 px-5 py-4 font-semibold">ความคืบหน้ารายส่วนงาน</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">ส่วนงาน</th>
                <th className="px-4 py-3 text-right font-medium">ทั้งหมด</th>
                <th className="w-56 px-4 py-3 font-medium">ครบถ้วน</th>
                <th className="px-4 py-3 text-right font-medium">ร่าง</th>
                <th className="px-4 py-3 text-right font-medium">รอตรวจ</th>
                <th className="px-4 py-3 text-right font-medium">ส่งกลับ</th>
                <th className="px-4 py-3 text-right font-medium">อนุมัติ</th>
                <th className="px-4 py-3 font-medium">อัปเดตล่าสุด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 tabular-nums">
              {progress.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3"><b>{p.code}</b> <span className="text-gray-600">{p.name}</span></td>
                  <td className="px-4 py-3 text-right">{p.total}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct(p.complete, p.total)}%` }} />
                      </div>
                      <span className="w-20 text-right text-xs">{p.complete} ({pct(p.complete, p.total)}%)</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">{p.draft}</td>
                  <td className="px-4 py-3 text-right">{p.submitted}</td>
                  <td className="px-4 py-3 text-right">{p.returned}</td>
                  <td className="px-4 py-3 text-right">{p.approved}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDateTime(p.last_update)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">รายการที่ยังไม่ครบถ้วน ({(incomplete ?? []).length}{(incomplete ?? []).length === 100 ? "+" : ""})</h2>
        {(incomplete ?? []).length === 0 ? (
          <Empty>ไม่มีรายการที่ยังไม่ครบถ้วน</Empty>
        ) : (
          <div className="card divide-y divide-gray-100">
            {((incomplete ?? []) as Row[]).map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <Link href={`/stakeholders/${r.id}`} className="font-medium hover:text-brand-700">{r.name || "(ยังไม่ระบุชื่อ)"}</Link>
                  <div className="text-xs text-gray-500">{r.department_code} · {r.subgroup_name ?? "ยังไม่เลือกกลุ่มย่อย"} · {r.issue_count} ประเด็น</div>
                  <div className="mt-1 text-orange-700">{r.first_problem}{r.incomplete_rows > 1 ? ` (ไม่ครบ ${r.incomplete_rows} ประเด็น)` : ""}</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  {canEdit && (r.status === "draft" || r.status === "returned") && (
                    <Link href={`/stakeholders/${r.id}/edit`} className="btn-primary py-1.5">แก้ไขให้ครบ</Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {(ready ?? []).length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">ครบถ้วนแล้ว แต่ยังไม่ได้ส่งตรวจสอบ ({(ready ?? []).length})</h2>
          <div className="card divide-y divide-gray-100">
            {((ready ?? []) as Row[]).map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <Link href={`/stakeholders/${r.id}`} className="font-medium hover:text-brand-700">{r.name}</Link>
                  <div className="text-xs text-gray-500">{r.department_code} · {r.subgroup_name}</div>
                </div>
                <Link href={`/stakeholders/${r.id}`} className="btn-secondary py-1.5">ไปส่งข้อมูล</Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub, bar }: { label: string; value: number; sub?: string; bar?: number }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value.toLocaleString("th-TH")} {sub && <span className="text-sm font-normal text-gray-500">{sub}</span>}</div>
      {bar != null && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-brand-600" style={{ width: `${bar}%` }} />
        </div>
      )}
    </div>
  );
}
