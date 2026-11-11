import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getReference } from "@/lib/data";
import { PageHeader } from "@/components/common";
import ImportClient from "./ImportClient";

export const metadata: Metadata = { title: "นำเข้าข้อมูลจาก Excel" };

export default async function ImportPage() {
  const profile = await requireRole("admin", "dept_user");
  const ref = await getReference();
  return (
    <div className="space-y-5">
      <PageHeader
        title="นำเข้าข้อมูลจาก Excel"
        desc="ใช้ไฟล์ “Stakeholder Profile กยท. (แบบกรอกข้อมูลส่วนงาน).xlsx” แท็บ “แบบกรอกข้อมูล” ระบบจะแสดงตัวอย่างให้ตรวจสอบก่อนบันทึก"
      />
      <ImportClient
        role={profile.role}
        fiscalYears={ref.fiscalYears.map((f) => ({ id: f.id, label: String(f.year_be), current: f.is_current }))}
      />
    </div>
  );
}
