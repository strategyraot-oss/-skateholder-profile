import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Wizard from "@/components/wizard/Wizard";
import { requireRole } from "@/lib/auth";
import { getReference, isWritableFy } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { ISSUE_COLUMNS, STAKEHOLDER_COLUMNS, stateFromDb } from "@/lib/wizard";
import type { Stakeholder, StakeholderIssue } from "@/lib/types";

export const metadata: Metadata = { title: "แก้ไขข้อมูลผู้มีส่วนได้ส่วนเสีย" };

export default async function EditStakeholderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireRole("admin", "dept_user");
  const ref = await getReference();
  const supabase = await createClient();

  const { data: s } = await supabase.from("stakeholders").select(STAKEHOLDER_COLUMNS).eq("id", id).maybeSingle<Stakeholder>();
  if (!s) notFound();

  const editable =
    (s.status === "draft" || s.status === "returned") &&
    (profile.role === "admin" || s.department_id === profile.department_id);
  if (!editable) redirect(`/stakeholders/${id}`);

  const [{ data: issues }, { data: ret }] = await Promise.all([
    supabase.from("stakeholder_issues").select(ISSUE_COLUMNS).eq("stakeholder_id", id).order("sort"),
    s.status === "returned"
      ? supabase.from("review_actions").select("comment").eq("stakeholder_id", id).eq("action", "return")
          .order("created_at", { ascending: false }).limit(1).maybeSingle<{ comment: string | null }>()
      : Promise.resolve({ data: null }),
  ]);

  const fy = ref.fiscalYears.find((f) => f.id === s.fiscal_year_id) ?? null;

  return (
    <Wizard
      initial={stateFromDb(s, (issues ?? []) as StakeholderIssue[])}
      initialSavedAt={s.updated_at}
      groups={ref.groups}
      subgroups={ref.subgroups}
      departments={ref.departments}
      role={profile.role}
      fiscalYear={fy}
      writable={profile.role === "admin" || isWritableFy(fy)}
      returnComment={ret?.comment ?? null}
    />
  );
}
