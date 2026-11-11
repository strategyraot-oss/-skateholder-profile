import type { Metadata } from "next";
import Wizard from "@/components/wizard/Wizard";
import { requireRole } from "@/lib/auth";
import { getReference, isWritableFy } from "@/lib/data";
import { emptyState } from "@/lib/wizard";
import { getCopySource } from "../actions";

export const metadata: Metadata = { title: "เพิ่มข้อมูลผู้มีส่วนได้ส่วนเสีย" };

export default async function NewStakeholderPage({ searchParams }: { searchParams: Promise<{ copy?: string }> }) {
  const profile = await requireRole("admin", "dept_user");
  const ref = await getReference();
  const { copy } = await searchParams;

  let initial = emptyState(profile.role === "dept_user" ? profile.department_id : null);
  if (copy) {
    const src = await getCopySource(copy);
    if (src) initial = { ...initial, ...src };
  }
  initial.fiscal_year_id = ref.currentFy?.id;

  return (
    <Wizard
      initial={initial}
      groups={ref.groups}
      subgroups={ref.subgroups}
      departments={ref.departments}
      role={profile.role}
      fiscalYear={ref.currentFy}
      writable={profile.role === "admin" ? !!ref.currentFy : isWritableFy(ref.currentFy)}
      allowRestore={!copy}
    />
  );
}
