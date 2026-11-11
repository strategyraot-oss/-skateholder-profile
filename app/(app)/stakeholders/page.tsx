import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileUp, Plus } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getReference, readFilters } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABELS } from "@/lib/domain/reference";
import { fmtDateTime } from "@/lib/format";
import { Empty, FilterBar, PageHeader, Pagination, Sel, StatusBadge, qs } from "@/components/common";
import { Badge, ScorePill } from "@/components/ui";
import type { RecordStatus } from "@/lib/types";

export const metadata: Metadata = { title: "ฐานข้อมูลผู้มีส่วนได้ส่วนเสีย" };

const SIZE = 25;

type Row = {
  id: string; name: string; status: RecordStatus; updated_at: string; department_code: string;
  group_name: string; subgroup_name: string | null; other_text: string | null; year_be: number;
  issue_count: number; max_priority: number | null; max_issue_score: number | null; is_complete: boolean; first_problem: string | null;
};

export default async function StakeholdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { profile } = await getSession();
  const ref = await getReference();
  const f = readFilters(sp, ref);
  const status = typeof sp.status === "string" ? sp.status : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const complete = typeof sp.complete === "string" ? sp.complete : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("v_stakeholder_list")
    .select("id, name, status, updated_at, department_code, group_name, subgroup_name, other_text, year_be, issue_count, max_priority, max_issue_score, is_complete, first_problem", { count: "exact" });
  if (f.fy) query = query.eq("fiscal_year_id", f.fy);
  if (f.dept) query = query.eq("department_id", f.dept);
  if (f.group) query = query.eq("group_id", f.group);
  if (f.subgroup) query = query.eq("subgroup_id", f.subgroup);
  if (status) query = query.eq("status", status);
  if (complete === "yes") query = query.eq("is_complete", true);
  if (complete === "no") query = query.eq("is_complete", false);
  if (q) query = query.ilike("name", `%${q.replace(/[%,()]/g, " ")}%`);
  const { data, count } = await query.order("updated_at", { ascending: false }).range((page - 1) * SIZE, page * SIZE - 1);
  const rows = (data ?? []) as Row[];

  const base = { fy: sp.fy === "all" ? "all" : f.fy, dept: f.dept, group: f.group, subgroup: f.subgroup, status, q, complete };
  const canAdd = profile?.role === "admin" || profile?.role === "dept_user";

  return (
    <div className="space-y-5">
      <PageHeader
        title="ฐานข้อมูลผู้มีส่วนได้ส่วนเสีย"
        desc={profile?.role === "dept_user" ? "แสดงเฉพาะข้อมูลของส่วนงานท่าน" : "ข้อมูลตามสิทธิ์การเข้าถึงของท่าน"}
        actions={
          <>
            <a href={`/api/export${qs(base)}`} className="btn-secondary"><Download className="h-4 w-4" /> ส่งออก Excel</a>
            {canAdd && <Link href="/stakeholders/import" className="btn-secondary"><FileUp className="h-4 w-4" /> นำเข้า Excel</Link>}
            {canAdd && <Link href="/stakeholders/new" className="btn-primary"><Plus className="h-4 w-4" /> เพิ่มข้อมูล</Link>}
          </>
        }
      />

      <FilterBar
        action="/stakeholders"
        reference={ref}
        values={f}
        role={profile!.role}
        extra={
          <>
            <Sel label="สถานะ" name="status" value={status}>
              <option value="">ทุกสถานะ</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Sel>
            <Sel label="ความครบถ้วน" name="complete" value={complete}>
              <option value="">ทั้งหมด</option>
              <option value="yes">ครบถ้วน</option>
              <option value="no">ยังไม่ครบถ้วน</option>
            </Sel>
            <label className="min-w-40 flex-1 sm:max-w-64">
              <span className="label">ค้นหาชื่อ</span>
              <input name="q" defaultValue={q} className="input py-2" placeholder="พิมพ์ชื่อ…" />
            </label>
          </>
        }
      />

      {rows.length === 0 ? (
        <Empty>
          ไม่พบข้อมูลตามเงื่อนไข{canAdd && <> — <Link href="/stakeholders/new" className="text-brand-700 underline">เพิ่มข้อมูลผู้มีส่วนได้ส่วนเสีย</Link></>}
        </Empty>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">ชื่อผู้มีส่วนได้ส่วนเสีย</th>
                  <th className="px-4 py-3 font-medium">กลุ่ม / กลุ่มย่อย</th>
                  <th className="px-4 py-3 font-medium">ส่วนงาน</th>
                  <th className="px-4 py-3 text-center font-medium">ประเด็น</th>
                  <th className="px-4 py-3 font-medium">คะแนนสูงสุด</th>
                  <th className="px-4 py-3 font-medium">สถานะ</th>
                  <th className="px-4 py-3 font-medium">แก้ไขล่าสุด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className="px-4 py-3">
                      <Link href={`/stakeholders/${r.id}`} className="font-medium text-gray-900 hover:text-brand-700">{r.name || "(ยังไม่ระบุชื่อ)"}</Link>
                      <div className="mt-0.5">
                        {r.is_complete ? <Badge tone="green">ครบถ้วน</Badge> : <Badge tone="orange">{r.first_problem ?? "ยังไม่ครบถ้วน"}</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{r.group_name}</div>
                      <div className="text-xs text-gray-500">{r.subgroup_name ?? "–"}{r.other_text ? ` (${r.other_text})` : ""}</div>
                    </td>
                    <td className="px-4 py-3">{r.department_code}<div className="text-xs text-gray-500">ปี {r.year_be}</div></td>
                    <td className="px-4 py-3 text-center tabular-nums">{r.issue_count}</td>
                    <td className="space-y-1 px-4 py-3">
                      <div><ScorePill score={r.max_priority} max={25} /></div>
                      <div><ScorePill score={r.max_issue_score} max={16} /></div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-gray-600">{fmtDateTime(r.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 px-4 py-3">
            <Pagination page={page} total={count ?? 0} size={SIZE} href={(p) => `/stakeholders${qs(base, { page: p })}`} />
          </div>
        </div>
      )}
    </div>
  );
}
