import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Gauge, ListChecks, Star, Target, Users } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getReference, readFilters } from "@/lib/data";
import { getStats } from "@/lib/stats";
import { ENGAGEMENT_LEVELS } from "@/lib/domain/reference";
import { fmtNum, pct } from "@/lib/format";
import { FilterBar, PageHeader } from "@/components/common";
import { BarList, PowerInterestMatrix, StatusBar } from "@/components/charts";
import { ScorePill } from "@/components/ui";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { profile } = await getSession();
  const ref = await getReference();
  const f = readFilters(sp, ref);
  const s = await getStats(f);
  const k = s.kpi;
  const fy = ref.fiscalYears.find((x) => x.id === f.fy);

  const cards = [
    { label: "ผู้มีส่วนได้ส่วนเสียทั้งหมด", value: fmtNum(k.stakeholders), unit: "ราย", icon: Users },
    { label: "ประเด็นความต้องการ", value: fmtNum(k.issues), unit: "ประเด็น", icon: ListChecks },
    { label: "ข้อมูลครบถ้วน", value: fmtNum(k.complete_rows), unit: `แถว (${pct(k.complete_rows, k.rows)}%)`, icon: CheckCircle2 },
    { label: "ข้อมูลยังไม่ครบถ้วน", value: fmtNum(k.incomplete_rows), unit: "แถว", icon: AlertCircle },
    { label: "คะแนนลำดับความสำคัญเฉลี่ย", value: fmtNum(k.avg_priority), unit: "/ 25", icon: Gauge },
    { label: "คะแนนความสำคัญของประเด็นเฉลี่ย", value: fmtNum(k.avg_issue_score), unit: "/ 16", icon: Target },
    { label: "ความสำคัญสูง (คะแนน ≥ 20)", value: fmtNum(k.high_priority), unit: "ราย", icon: Star },
    { label: "ส่วนงานที่กรอกข้อมูล", value: fmtNum(k.departments), unit: "ส่วนงาน", icon: Users },
  ];

  const link = (key: string, id: string) => `/dashboard?${new URLSearchParams({ ...(f.fy ? { fy: f.fy } : { fy: "all" }), ...(f.dept ? { dept: f.dept } : {}), [key]: id })}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard ภาพรวม"
        desc={`${fy ? `ปีงบประมาณ ${fy.year_be}${fy.is_open ? " · เปิดรับข้อมูล" : " · ปิดรับข้อมูล"}` : "ทุกปีงบประมาณ"}${profile?.role === "dept_user" && profile.department ? ` · ${profile.department.name}` : ""}`}
      />
      <FilterBar action="/dashboard" reference={ref} values={f} role={profile!.role} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ label, value, unit, icon: Icon }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center gap-2 text-sm text-gray-600"><Icon className="h-4 w-4 text-brand-700" /> {label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
              {value}<span className="ml-1 text-sm font-normal text-gray-500">{unit}</span>
            </div>
          </div>
        ))}
      </div>

      <Panel title="สถานะการส่งข้อมูล (จำนวนราย)">
        <StatusBar counts={{ draft: k.draft, submitted: k.submitted, returned: k.returned, approved: k.approved }} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="จำนวนผู้มีส่วนได้ส่วนเสีย แยกตาม 8 กลุ่ม" note="กดที่กลุ่มเพื่อดูรายละเอียดกลุ่มย่อย">
          <BarList unit="ราย" items={s.by_group.map((g) => ({
            key: g.id, label: g.name, value: g.stakeholders, href: link("group", g.id),
            detail: g.avg_priority != null ? `เฉลี่ย ${g.avg_priority}` : undefined,
          }))} />
        </Panel>
        <Panel title="Power–Interest Matrix">
          <PowerInterestMatrix cells={s.matrix} />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="จำนวนรายการ แยกตามกลุ่มย่อย">
          <BarList unit="แถว" items={s.by_subgroup.filter((x) => x.rows > 0 || !x.name.startsWith("อื่น")).map((x) => ({
            key: x.id, label: x.name.startsWith("อื่น") ? `อื่น ๆ (${x.group_name})` : x.name, value: x.rows,
            href: link("subgroup", x.id),
          }))} />
        </Panel>
        <Panel title="จำนวนรายการของแต่ละส่วนงาน">
          <BarList unit="ราย" items={s.by_department.map((d) => ({
            key: d.id, label: `${d.code} ${d.name}`, value: d.stakeholders,
            detail: d.incomplete ? `ไม่ครบ ${d.incomplete}` : undefined,
          }))} />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="สรุประดับการสร้างความสัมพันธ์ (จำนวนประเด็น)">
          <BarList unit="ประเด็น" items={ENGAGEMENT_LEVELS.map((e, i) => ({
            key: e.key, label: `${i + 1}. ${e.excelText}`, value: s.by_engagement.find((x) => x.level === e.key)?.issues ?? 0,
          }))} />
        </Panel>
        <Panel title="ผู้มีส่วนได้ส่วนเสียที่มีความสำคัญสูง (10 อันดับ)">
          {s.top_stakeholders.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">ยังไม่มีข้อมูลคะแนน</p> : (
            <ol className="divide-y divide-gray-100">
              {s.top_stakeholders.map((t, i) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <Link href={`/stakeholders/${t.id}`} className="font-medium hover:text-brand-700">{i + 1}. {t.name}</Link>
                    <div className="truncate text-xs text-gray-500">{t.department_code} · {t.subgroup_name ?? t.group_name}</div>
                  </div>
                  <ScorePill score={t.max_priority} max={25} />
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <Panel title="ประเด็นความต้องการและความคาดหวังที่สำคัญ (คะแนนผลกระทบสูงสุด)">
        {s.top_issues.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">ยังไม่มีข้อมูลคะแนน</p> : (
          <ul className="divide-y divide-gray-100">
            {s.top_issues.map((t) => (
              <li key={t.issue_id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-gray-900">{t.issue_text}</p>
                  <div className="text-xs text-gray-500">
                    <Link href={`/stakeholders/${t.stakeholder_id}`} className="hover:text-brand-700">{t.name}</Link> · {t.department_code}
                    {t.engagement_level && ` · ${ENGAGEMENT_LEVELS.find((e) => e.key === t.engagement_level)?.excelText}`}
                  </div>
                </div>
                <ScorePill score={t.issue_score} max={16} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      {note && <p className="text-xs text-gray-500">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
