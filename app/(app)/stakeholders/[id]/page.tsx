import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Copy, Pencil } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getReference } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { ISSUE_COLUMNS, STAKEHOLDER_COLUMNS } from "@/lib/wizard";
import { ENGAGEMENT_LEVELS } from "@/lib/domain/reference";
import { fmtDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/common";
import { ScorePill } from "@/components/ui";
import { Notice } from "@/components/wizard/Wizard";
import ReviewPanel from "./ReviewPanel";
import type { Stakeholder, StakeholderIssue } from "@/lib/types";

export const metadata: Metadata = { title: "รายละเอียดผู้มีส่วนได้ส่วนเสีย" };

const ACTION_LABEL = { submit: "ส่งตรวจสอบ", return: "ส่งกลับแก้ไข", approve: "อนุมัติ", comment: "แสดงความคิดเห็น" } as const;

type ReviewRow = { id: string; action: keyof typeof ACTION_LABEL; comment: string | null; actor_name: string | null; created_at: string };

export default async function StakeholderDetail({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ submitted?: string }> }) {
  const { id } = await params;
  const { submitted } = await searchParams;
  const { profile } = await getSession();
  const ref = await getReference();
  const supabase = await createClient();

  const { data: s } = await supabase.from("stakeholders").select(STAKEHOLDER_COLUMNS).eq("id", id).maybeSingle<Stakeholder>();
  if (!s || !profile) notFound();

  const [{ data: issues }, { data: history }] = await Promise.all([
    supabase.from("stakeholder_issues").select(ISSUE_COLUMNS).eq("stakeholder_id", id).order("sort"),
    supabase.from("review_actions").select("id, action, comment, actor_name, created_at").eq("stakeholder_id", id).order("created_at", { ascending: false }),
  ]);

  const group = ref.groups.find((g) => g.id === s.group_id);
  const sub = ref.subgroups.find((x) => x.id === s.subgroup_id);
  const dept = ref.departments.find((d) => d.id === s.department_id);
  const fy = ref.fiscalYears.find((f) => f.id === s.fiscal_year_id);
  const canEdit =
    (s.status === "draft" || s.status === "returned") &&
    (profile.role === "admin" || (profile.role === "dept_user" && s.department_id === profile.department_id));
  const canReview = profile.role === "admin" || profile.role === "reviewer";
  const list = (issues ?? []) as StakeholderIssue[];

  const info: [string, string | null][] = [
    ["ส่วนงานผู้กรอก", dept ? `${dept.code} ${dept.name}` : null],
    ["ปีงบประมาณ", fy ? String(fy.year_be) : null],
    ["กลุ่ม", group?.name ?? null],
    ["กลุ่มย่อย", sub?.name ?? null],
    ["ระบุอื่น ๆ", s.other_text],
    ["ประเภท/สถานะ", s.type_status],
    ["ที่อยู่/สถานที่ติดต่อ", s.address],
    ["รูปแบบความสัมพันธ์ทางธุรกิจ", s.business_relation],
    ["ผู้ประสานงาน", s.coordinator],
    ["ช่องทางติดต่อผู้ประสานงาน", s.coordinator_contact],
    ["ผู้มีอำนาจตัดสินใจ", s.decision_maker],
    ["ช่องทางติดต่อผู้มีอำนาจตัดสินใจ", s.decision_maker_contact],
    ["วัตถุประสงค์ในการสร้างความสัมพันธ์", s.objective],
  ];

  return (
    <div className="space-y-5">
      <Link href="/stakeholders" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> กลับไปฐานข้อมูล
      </Link>

      {submitted && <Notice tone="green">ส่งข้อมูลให้ผู้ตรวจสอบเรียบร้อยแล้ว ท่านสามารถติดตามสถานะได้ที่หน้านี้</Notice>}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900">{s.name || "(ยังไม่ระบุชื่อ)"}</h1>
            <StatusBadge status={s.status} />
          </div>
          <p className="text-sm text-gray-600">แก้ไขล่าสุด {fmtDateTime(s.updated_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <Link href={`/stakeholders/${id}/edit`} className="btn-primary"><Pencil className="h-4 w-4" /> แก้ไขข้อมูล</Link>}
          {profile.role !== "reviewer" && (
            <Link href={`/stakeholders/new?copy=${id}`} className="btn-secondary"><Copy className="h-4 w-4" /> คัดลอกเป็นรายการใหม่</Link>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">ข้อมูลผู้มีส่วนได้ส่วนเสีย</h2>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {info.filter(([k, v]) => v || k !== "ระบุอื่น ๆ").map(([k, v]) => (
                <div key={k}>
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="whitespace-pre-line text-gray-900">{v || <span className="text-gray-400">–</span>}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card">
            <h2 className="border-b border-gray-100 px-5 py-4 font-semibold">ประเด็นความต้องการ ({list.length})</h2>
            {list.length === 0 && <p className="p-5 text-sm text-gray-500">ยังไม่มีประเด็นความต้องการ</p>}
            <div className="divide-y divide-gray-100">
              {list.map((i, idx) => {
                const lvl = ENGAGEMENT_LEVELS.find((e) => e.key === i.engagement_level);
                return (
                  <article key={i.id} className="space-y-3 p-5 text-sm">
                    <div>
                      <div className="text-xs font-medium text-brand-700">ประเด็นที่ {idx + 1}</div>
                      <p className="whitespace-pre-line text-gray-900">{i.issue_text || "–"}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-gray-50 p-3">
                        <div className="text-gray-500">ความสำคัญของผู้มีส่วนได้ส่วนเสีย</div>
                        <div>ความสนใจ {i.interest ?? "–"} × อิทธิพล {i.influence ?? "–"} = <ScorePill score={i.priority_score} max={25} /></div>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-3">
                        <div className="text-gray-500">ความสำคัญของประเด็น</div>
                        <div>ผลกระทบองค์กร {i.impact_org ?? "–"} × ผลกระทบ SH {i.impact_sh ?? "–"} = <ScorePill score={i.issue_score} max={16} /></div>
                      </div>
                    </div>
                    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                      <Item k="ระดับการสร้างความสัมพันธ์" v={lvl?.excelText} />
                      <Item k="หน่วยงานภายในที่รับผิดชอบ" v={i.responsible_unit} />
                      <Item k="ช่องทาง/วิธีการสื่อสาร" v={i.channel} />
                      <Item k="ความถี่ในการสื่อสาร" v={i.frequency} />
                      <Item k="ข้อจำกัด/ความสามารถเฉพาะ" v={i.constraints} />
                      <Item k="หมายเหตุ" v={i.remark} />
                    </dl>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <ReviewPanel
            id={id}
            status={s.status}
            canReview={canReview}
            canSubmit={canEdit}
            canDelete={s.status === "draft" && (profile.role === "admin" || (profile.role === "dept_user" && s.department_id === profile.department_id))}
          />
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">ประวัติการดำเนินการ</h2>
            {(history ?? []).length === 0 && <p className="text-sm text-gray-500">ยังไม่มีประวัติ</p>}
            <ol className="space-y-3">
              {((history ?? []) as ReviewRow[]).map((h) => (
                <li key={h.id} className="border-l-2 border-brand-200 pl-3 text-sm">
                  <div className="font-medium">{ACTION_LABEL[h.action]}</div>
                  <div className="text-xs text-gray-500">{h.actor_name ?? "–"} · {fmtDateTime(h.created_at)}</div>
                  {h.comment && <p className="mt-1 whitespace-pre-line text-gray-700">{h.comment}</p>}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Item({ k, v }: { k: string; v?: string | null }) {
  return (
    <div>
      <dt className="text-gray-500">{k}</dt>
      <dd className="text-gray-900">{v || <span className="text-gray-400">–</span>}</dd>
    </div>
  );
}
