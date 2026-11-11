"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/domain/reference";
import { fmtDate } from "@/lib/format";
import type { Department, FiscalYear, UserRole } from "@/lib/types";
import { createUser, resetPassword, saveDepartment, saveFiscalYear, setCurrentFiscalYear, updateUser, type Result } from "./actions";

export type UserRow = {
  id: string; email: string | null; full_name: string | null; role: UserRole; department_id: string | null;
  active: boolean; created_at: string; reviewer_departments: string[];
};

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message ?? "บันทึกแล้ว" } : { ok: false, text: r.error });
      if (r.ok) { after?.(); router.refresh(); }
    });
  const Msg = () => (msg ? <p className={msg.ok ? "text-sm text-brand-700" : "text-sm text-red-700"}>{msg.text}</p> : null);
  return { pending, run, Msg };
}

const roleOptions = (Object.keys(ROLE_LABELS) as UserRole[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>);

/* ================= Users ================= */
export function UsersAdmin({ users, departments, meId }: { users: UserRow[]; departments: Department[]; meId: string }) {
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const shown = users.filter((u) => `${u.email} ${u.full_name}`.toLowerCase().includes(q.toLowerCase()));
  const pendingCount = users.filter((u) => !u.active).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input className="input max-w-xs" placeholder="ค้นหาชื่อหรืออีเมล…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex items-center gap-3">
          {pendingCount > 0 && <Badge tone="orange">รอเปิดใช้งาน {pendingCount} บัญชี</Badge>}
          <button className="btn-primary" onClick={() => setAdding((v) => !v)}><Plus className="h-4 w-4" /> เพิ่มผู้ใช้งาน</button>
        </div>
      </div>
      {adding && <NewUser departments={departments} onDone={() => setAdding(false)} />}
      <div className="card divide-y divide-gray-100">
        {shown.map((u) => <UserItem key={u.id} u={u} departments={departments} isMe={u.id === meId} />)}
        {shown.length === 0 && <p className="p-5 text-sm text-gray-500">ไม่พบผู้ใช้งาน</p>}
      </div>
    </div>
  );
}

function NewUser({ departments, onDone }: { departments: Department[]; onDone: () => void }) {
  const { pending, run, Msg } = useRun();
  const [f, setF] = useState({ email: "", password: "", full_name: "", role: "dept_user" as UserRole, department_id: "" });
  return (
    <div className="card space-y-3 p-5">
      <h3 className="font-semibold">เพิ่มผู้ใช้งานใหม่</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <L label="ชื่อ-สกุล"><input className="input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></L>
        <L label="อีเมล (ใช้เข้าสู่ระบบ)"><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></L>
        <L label="รหัสผ่านเริ่มต้น (อย่างน้อย 8 ตัว)"><input className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></L>
        <L label="บทบาท"><select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as UserRole })}>{roleOptions}</select></L>
        <L label="ส่วนงาน">
          <select className="input" value={f.department_id} onChange={(e) => setF({ ...f, department_id: e.target.value })}>
            <option value="">– ไม่ระบุ –</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.code} {d.name}</option>)}
          </select>
        </L>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending} onClick={() => run(() => createUser({ ...f, department_id: f.department_id || null }), onDone)}>สร้างบัญชี</button>
        <Msg />
      </div>
    </div>
  );
}

function UserItem({ u, departments, isMe }: { u: UserRow; departments: Department[]; isMe: boolean }) {
  const { pending, run, Msg } = useRun();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ full_name: u.full_name ?? "", role: u.role, department_id: u.department_id ?? "", active: u.active, rd: u.reviewer_departments });
  const [pw, setPw] = useState("");
  const dept = departments.find((d) => d.id === u.department_id);
  return (
    <div className="p-4">
      <button className="flex w-full flex-wrap items-center justify-between gap-2 text-left" onClick={() => setOpen((v) => !v)}>
        <div>
          <div className="font-medium">{u.full_name || u.email} {isMe && <span className="text-xs text-gray-500">(ท่าน)</span>}</div>
          <div className="text-xs text-gray-500">{u.email} · สร้างเมื่อ {fmtDate(u.created_at)}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="blue">{ROLE_LABELS[u.role]}</Badge>
          {dept && <Badge>{dept.code}</Badge>}
          {u.active ? <Badge tone="green">ใช้งาน</Badge> : <Badge tone="orange">ยังไม่เปิดใช้งาน</Badge>}
        </div>
      </button>
      {open && (
        <div className="mt-4 space-y-3 rounded-xl bg-gray-50 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <L label="ชื่อ-สกุล"><input className="input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></L>
            <L label="บทบาท"><select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as UserRole })}>{roleOptions}</select></L>
            <L label="ส่วนงาน">
              <select className="input" value={f.department_id} onChange={(e) => setF({ ...f, department_id: e.target.value })}>
                <option value="">– ไม่ระบุ –</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.code} {d.name}</option>)}
              </select>
            </L>
          </div>
          {f.role === "reviewer" && (
            <div>
              <div className="label">ส่วนงานที่ผู้ตรวจสอบเห็นข้อมูลได้ (ไม่เลือก = ทุกส่วนงาน)</div>
              <div className="flex flex-wrap gap-2">
                {departments.map((d) => (
                  <label key={d.id} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-sm">
                    <input type="checkbox" checked={f.rd.includes(d.id)}
                      onChange={(e) => setF({ ...f, rd: e.target.checked ? [...f.rd, d.id] : f.rd.filter((x) => x !== d.id) })} />
                    {d.code}
                  </label>
                ))}
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> เปิดใช้งานบัญชี
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary" disabled={pending}
              onClick={() => run(() => updateUser({ id: u.id, full_name: f.full_name, role: f.role, department_id: f.department_id || null, active: f.active, reviewer_departments: f.rd }))}>
              บันทึกสิทธิ์
            </button>
            <input className="input max-w-52" placeholder="รหัสผ่านใหม่" value={pw} onChange={(e) => setPw(e.target.value)} />
            <button className="btn-secondary" disabled={pending || !pw} onClick={() => run(() => resetPassword(u.id, pw), () => setPw(""))}>ตั้งรหัสผ่านใหม่</button>
            <Msg />
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Fiscal years ================= */
export function YearsAdmin({ years }: { years: FiscalYear[] }) {
  const thisYear = new Date().getFullYear() + 543 + (new Date().getMonth() >= 9 ? 1 : 0);
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        ปีงบประมาณที่ “ปัจจุบัน” จะเป็นค่าเริ่มต้นของการกรอกข้อมูลและ Dashboard · ผู้ใช้งานส่วนงานบันทึก/ส่งข้อมูลได้เฉพาะเมื่อ “เปิดรับข้อมูล” และวันนี้อยู่ในช่วงวันที่กำหนด
      </p>
      <YearForm y={{ year_be: years.length ? Math.max(...years.map((x) => x.year_be)) + 1 : thisYear, start_date: null, end_date: null, is_open: false }} isNew />
      {years.map((y) => <YearForm key={y.id} y={y} />)}
    </div>
  );
}

function YearForm({ y, isNew }: { y: Partial<FiscalYear> & { year_be: number }; isNew?: boolean }) {
  const { pending, run, Msg } = useRun();
  const [f, setF] = useState({ year_be: y.year_be, start_date: y.start_date ?? "", end_date: y.end_date ?? "", is_open: !!y.is_open });
  return (
    <div className={`card flex flex-wrap items-end gap-3 p-4 ${y.is_current ? "border-brand-300 ring-2 ring-brand-100" : ""}`}>
      <div className="w-full text-sm font-semibold">
        {isNew ? "เพิ่มรอบปีงบประมาณใหม่" : <>ปีงบประมาณ {y.year_be} {y.is_current && <Badge tone="green">ปัจจุบัน</Badge>} {y.is_open ? <Badge tone="blue">เปิดรับข้อมูล</Badge> : <Badge>ปิดรับข้อมูล</Badge>}</>}
      </div>
      <L label="ปี พ.ศ."><input type="number" className="input w-28" value={f.year_be} onChange={(e) => setF({ ...f, year_be: Number(e.target.value) })} /></L>
      <L label="วันเริ่มกรอกข้อมูล"><input type="date" className="input" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></L>
      <L label="วันสิ้นสุดการกรอก"><input type="date" className="input" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></L>
      <label className="flex items-center gap-2 pb-3 text-sm">
        <input type="checkbox" checked={f.is_open} onChange={(e) => setF({ ...f, is_open: e.target.checked })} /> เปิดรับข้อมูล
      </label>
      <button className="btn-primary" disabled={pending}
        onClick={() => run(() => saveFiscalYear({ id: y.id, year_be: f.year_be, start_date: f.start_date || null, end_date: f.end_date || null, is_open: f.is_open }))}>
        {isNew ? "เพิ่ม" : "บันทึก"}
      </button>
      {!isNew && !y.is_current && (
        <button className="btn-secondary" disabled={pending} onClick={() => run(() => setCurrentFiscalYear(y.id!))}>ตั้งเป็นปีปัจจุบัน</button>
      )}
      <Msg />
    </div>
  );
}

/* ================= Departments ================= */
export function DepartmentsAdmin({ departments }: { departments: Department[] }) {
  return (
    <div className="space-y-2">
      <DeptForm d={{ code: "", name: "", active: true }} isNew />
      {departments.map((d) => <DeptForm key={d.id} d={d} />)}
    </div>
  );
}

function DeptForm({ d, isNew }: { d: Partial<Department> & { code: string; name: string; active: boolean }; isNew?: boolean }) {
  const { pending, run, Msg } = useRun();
  const [f, setF] = useState({ code: d.code, name: d.name, active: d.active });
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-3">
      <L label={isNew ? "อักษรย่อ (ส่วนงานใหม่)" : "อักษรย่อ"}><input className="input w-32" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="เช่น ฝยศ." /></L>
      <div className="min-w-56 flex-1"><L label="ชื่อส่วนงาน"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></L></div>
      <label className="flex items-center gap-2 pb-3 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> ใช้งาน</label>
      <button className={isNew ? "btn-primary" : "btn-secondary"} disabled={pending}
        onClick={() => run(() => saveDepartment({ id: d.id, ...f }), isNew ? () => setF({ code: "", name: "", active: true }) : undefined)}>
        {isNew ? "เพิ่มส่วนงาน" : "บันทึก"}
      </button>
      <Msg />
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}
