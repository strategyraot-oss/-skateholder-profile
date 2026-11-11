import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { requireRole } from "@/lib/auth";
import { getReference } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/common";
import { UsersAdmin, YearsAdmin, type UserRow } from "./SettingsClient";

export const metadata: Metadata = { title: "ตั้งค่าระบบ" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await requireRole("admin");
  const { tab = "users" } = await searchParams;
  const ref = await getReference();
  const supabase = await createClient();

  let users: UserRow[] = [];
  if (tab === "users") {
    const [{ data: p }, { data: rd }] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name, role, department_id, active, created_at").order("created_at"),
      supabase.from("reviewer_departments").select("reviewer_id, department_id"),
    ]);
    users = ((p ?? []) as Omit<UserRow, "reviewer_departments">[]).map((u) => ({
      ...u,
      reviewer_departments: (rd ?? []).filter((r) => r.reviewer_id === u.id).map((r) => r.department_id as string),
    }));
  }

  const tabs = [
    { key: "users", label: "ผู้ใช้งานและสิทธิ์" },
    { key: "years", label: "รอบปีงบประมาณ / เปิด–ปิดระบบ" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="ตั้งค่าระบบ" desc="สำหรับผู้ดูแลระบบ" />
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <Link key={t.key} href={`/settings?tab=${t.key}`}
            className={clsx("-mb-px border-b-2 px-4 py-2.5 text-sm font-medium", tab === t.key ? "border-brand-600 text-brand-800" : "border-transparent text-gray-600 hover:text-gray-900")}>
            {t.label}
          </Link>
        ))}
      </div>
      {tab === "users" && <UsersAdmin users={users} departments={ref.departments} meId={me.id} />}
      {tab === "years" && <YearsAdmin years={ref.fiscalYears} />}
    </div>
  );
}
