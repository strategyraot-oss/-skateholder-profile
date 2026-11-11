import Link from "next/link";
import { Badge } from "./ui";
import { STATUS_LABELS } from "@/lib/domain/reference";
import type { Reference } from "@/lib/data";
import type { RecordStatus, UserRole } from "@/lib/types";

export function StatusBadge({ status }: { status: RecordStatus }) {
  const s = STATUS_LABELS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function PageHeader({ title, desc, actions }: { title: string; desc?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {desc && <p className="mt-0.5 text-sm text-gray-600">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

type FilterValues = { fy: string | null; dept: string | null; group: string | null; subgroup: string | null };

/** ตัวกรองมาตรฐาน (ใช้ GET form จึงทำงานได้โดยไม่ต้องพึ่ง JavaScript) */
export function FilterBar({
  action, reference: ref, values, role, extra, keep,
}: {
  action: string;
  reference: Reference;
  values: FilterValues;
  role: UserRole;
  extra?: React.ReactNode;
  keep?: Record<string, string>;
}) {
  return (
    <form method="get" action={action} className="card flex flex-wrap items-end gap-3 p-4">
      {keep && Object.entries(keep).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Sel label="ปีงบประมาณ" name="fy" value={values.fy ?? "all"}>
        <option value="all">ทุกปี</option>
        {ref.fiscalYears.map((f) => <option key={f.id} value={f.id}>{f.year_be}</option>)}
      </Sel>
      {role !== "dept_user" && (
        <Sel label="ส่วนงาน" name="dept" value={values.dept ?? ""}>
          <option value="">ทุกส่วนงาน</option>
          {ref.departments.map((d) => <option key={d.id} value={d.id}>{d.code} {d.name}</option>)}
        </Sel>
      )}
      <Sel label="กลุ่ม" name="group" value={values.group ?? ""}>
        <option value="">ทุกกลุ่ม</option>
        {ref.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </Sel>
      <Sel label="กลุ่มย่อย" name="subgroup" value={values.subgroup ?? ""}>
        <option value="">ทุกกลุ่มย่อย</option>
        {ref.groups.map((g) => (
          <optgroup key={g.id} label={g.name}>
            {ref.subgroups.filter((s) => s.group_id === g.id).map((s) => (
              <option key={s.id} value={s.id}>{s.is_other ? `อื่น ๆ (${g.name})` : s.name}</option>
            ))}
          </optgroup>
        ))}
      </Sel>
      {extra}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary">กรองข้อมูล</button>
        <Link href={action} className="btn-secondary">ล้าง</Link>
      </div>
    </form>
  );
}

export function Sel({ label, name, value, children }: { label: string; name: string; value: string; children: React.ReactNode }) {
  return (
    <label className="min-w-40 flex-1 sm:max-w-64">
      <span className="label">{label}</span>
      <select name={name} defaultValue={value} className="input py-2">{children}</select>
    </label>
  );
}

export function Pagination({ page, total, size, href }: { page: number; total: number; size: number; href: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-between text-sm" aria-label="แบ่งหน้า">
      <span className="text-gray-600">หน้า {page} จาก {pages} ({total.toLocaleString("th-TH")} รายการ)</span>
      <div className="flex gap-2">
        {page > 1 ? <Link className="btn-secondary py-1.5" href={href(page - 1)}>ก่อนหน้า</Link> : <span className="btn-secondary py-1.5 opacity-40">ก่อนหน้า</span>}
        {page < pages ? <Link className="btn-secondary py-1.5" href={href(page + 1)}>ถัดไป</Link> : <span className="btn-secondary py-1.5 opacity-40">ถัดไป</span>}
      </div>
    </nav>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card p-10 text-center text-sm text-gray-500">{children}</div>;
}

export function qs(base: Record<string, string | null | undefined>, patch: Record<string, string | number | null> = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...patch })) if (v != null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}
