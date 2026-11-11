import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileUp } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getReference, readFilters } from "@/lib/data";
import { getStats } from "@/lib/stats";
import { ENGAGEMENT_LEVELS } from "@/lib/domain/reference";
import { fmtNum, pct } from "@/lib/format";
import { FilterBar, PageHeader, qs } from "@/components/common";

export const metadata: Metadata = { title: "รายงานและวิเคราะห์ข้อมูล" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { profile } = await getSession();
  const ref = await getReference();
  const f = readFilters(sp, ref);
  const s = await getStats(f);
  const k = s.kpi;
  const exportQs = qs({ fy: sp.fy === "all" ? "all" : f.fy, dept: f.dept, group: f.group, subgroup: f.subgroup });
  const engTotal = s.by_engagement.reduce((a, b) => a + b.issues, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="รายงานและวิเคราะห์ข้อมูล"
        desc="สรุปตามโครงสร้างแท็บ “สรุป” ของแบบกรอกข้อมูลต้นฉบับ ใช้ประกอบการจัดทำรายงาน SE-AM"
        actions={
          <>
            <a href={`/api/export${exportQs}`} className="btn-primary"><Download className="h-4 w-4" /> ส่งออก Excel (รูปแบบต้นฉบับ)</a>
            {profile?.role !== "reviewer" && <Link href="/stakeholders/import" className="btn-secondary"><FileUp className="h-4 w-4" /> นำเข้า Excel</Link>}
          </>
        }
      />
      <FilterBar action="/reports" reference={ref} values={f} role={profile!.role} />

      <section className="card overflow-hidden">
        <h2 className="border-b border-gray-100 px-5 py-4 font-semibold">สรุปจำนวนผู้มีส่วนได้ส่วนเสียตามกลุ่มและกลุ่มย่อย</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">กลุ่มผู้มีส่วนได้ส่วนเสีย</th>
                <th className="px-4 py-3 font-medium">กลุ่มย่อย</th>
                <th className="px-4 py-3 text-right font-medium">จำนวนรายการ</th>
                <th className="px-4 py-3 text-right font-medium">จำนวนราย</th>
                <th className="px-4 py-3 text-right font-medium">คะแนนลำดับความสำคัญเฉลี่ย</th>
                <th className="px-4 py-3 text-right font-medium">ยังไม่ครบถ้วน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 tabular-nums">
              {s.by_subgroup.map((x) => (
                <tr key={x.id}>
                  <td className="px-4 py-2.5">{x.group_name}</td>
                  <td className="px-4 py-2.5">{x.name}</td>
                  <td className="px-4 py-2.5 text-right">{x.rows}</td>
                  <td className="px-4 py-2.5 text-right">{x.stakeholders}</td>
                  <td className="px-4 py-2.5 text-right">{x.avg_priority ?? "-"}</td>
                  <td className={`px-4 py-2.5 text-right ${x.incomplete ? "text-orange-700" : ""}`}>{x.incomplete}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold tabular-nums">
              <tr>
                <td className="px-4 py-3" colSpan={2}>รวมทั้งหมด</td>
                <td className="px-4 py-3 text-right">{k.rows}</td>
                <td className="px-4 py-3 text-right">{k.stakeholders}</td>
                <td className="px-4 py-3 text-right">{k.avg_priority ?? "-"}</td>
                <td className="px-4 py-3 text-right">{k.incomplete_rows}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <h2 className="border-b border-gray-100 px-5 py-4 font-semibold">สรุปตามกลุ่ม</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">กลุ่ม</th>
                <th className="px-4 py-3 text-right font-medium">จำนวนรายการ</th>
                <th className="px-4 py-3 text-right font-medium">จำนวนส่วนงานที่กรอก</th>
                <th className="px-4 py-3 text-right font-medium">คะแนนประเด็นเฉลี่ย</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 tabular-nums">
              {s.by_group.map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-2.5">{g.name}</td>
                  <td className="px-4 py-2.5 text-right">{g.rows}</td>
                  <td className="px-4 py-2.5 text-right">{g.departments}</td>
                  <td className="px-4 py-2.5 text-right">{g.avg_issue_score ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card overflow-hidden">
          <h2 className="border-b border-gray-100 px-5 py-4 font-semibold">สรุประดับการสร้างความสัมพันธ์</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">ระดับ</th>
                <th className="px-4 py-3 font-medium">ความหมาย</th>
                <th className="px-4 py-3 text-right font-medium">จำนวนประเด็น</th>
                <th className="px-4 py-3 text-right font-medium">ร้อยละ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 tabular-nums">
              {ENGAGEMENT_LEVELS.map((e) => {
                const n = s.by_engagement.find((x) => x.level === e.key)?.issues ?? 0;
                return (
                  <tr key={e.key}>
                    <td className="px-4 py-2.5 font-medium">{e.excelText}</td>
                    <td className="px-4 py-2.5 text-gray-600">{e.description}</td>
                    <td className="px-4 py-2.5 text-right">{n}</td>
                    <td className="px-4 py-2.5 text-right">{pct(n, engTotal)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>

      <section className="card p-5 text-sm text-gray-700">
        <h2 className="mb-2 font-semibold text-gray-900">ภาพรวม</h2>
        ผู้มีส่วนได้ส่วนเสีย {fmtNum(k.stakeholders)} ราย · {fmtNum(k.issues)} ประเด็น · จาก {fmtNum(k.departments)} ส่วนงาน ·
        ครบถ้วน {pct(k.complete_rows, k.rows)}% · อนุมัติแล้ว {fmtNum(k.approved)} ราย ·
        คะแนนลำดับความสำคัญเฉลี่ย {fmtNum(k.avg_priority)} / 25 · คะแนนความสำคัญของประเด็นเฉลี่ย {fmtNum(k.avg_issue_score)} / 16
      </section>
    </div>
  );
}
