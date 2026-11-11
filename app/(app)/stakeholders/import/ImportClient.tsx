"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Badge } from "@/components/ui";
import type { UserRole } from "@/lib/types";
import { importExcel, type ImportResult } from "./actions";

export default function ImportClient({
  role, fiscalYears,
}: { role: UserRole; fiscalYears: { id: string; label: string; current: boolean }[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [fy, setFy] = useState(fiscalYears.find((f) => f.current)?.id ?? fiscalYears[0]?.id ?? "");
  const [res, setRes] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  const send = (mode: "preview" | "commit") => {
    if (!file) return;
    if (mode === "commit" && !window.confirm(`ยืนยันนำเข้า ${res?.summary?.stakeholders ?? 0} ราย (${res?.summary?.issues ?? 0} ประเด็น) เป็นฉบับร่าง?`)) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("mode", mode);
    fd.set("fy", fy);
    start(async () => setRes(await importExcel(fd)));
  };

  return (
    <div className="space-y-5">
      <section className="card space-y-4 p-5">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
          <li>กรอกข้อมูลในแบบฟอร์ม Excel ต้นฉบับ (1 แถว = 1 ราย × 1 ประเด็น) โดยไม่เปลี่ยนหัวตาราง</li>
          <li>เลือกไฟล์แล้วกด “ตรวจสอบไฟล์” เพื่อดูตัวอย่างและข้อผิดพลาดรายแถว</li>
          <li>กด “ยืนยันนำเข้า” ระบบจะรวมแถวที่เป็นผู้มีส่วนได้ส่วนเสียรายเดียวกันเป็นหลายประเด็น และบันทึกเป็นฉบับร่าง</li>
          {role === "dept_user" && <li>ข้อมูลทั้งหมดจะถูกบันทึกเป็นของส่วนงานท่าน</li>}
        </ol>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1">
            <span className="label">ไฟล์ Excel (.xlsx)</span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="input py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-brand-800"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRes(null); }}
            />
          </label>
          <label className="w-40">
            <span className="label">ปีงบประมาณ</span>
            <select className="input py-2" value={fy} onChange={(e) => { setFy(e.target.value); setRes(null); }}>
              {fiscalYears.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </label>
          <button type="button" className="btn-secondary" disabled={!file || pending} onClick={() => send("preview")}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} ตรวจสอบไฟล์
          </button>
        </div>
      </section>

      {res?.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {res.error}
          {res.missingHeaders && res.missingHeaders.length > 0 && (
            <ul className="mt-2 list-disc pl-5">{res.missingHeaders.map((m) => <li key={m}>หัวตารางไม่ตรง: {m}</li>)}</ul>
          )}
        </div>
      )}

      {res?.committed && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
          <span className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> นำเข้าสำเร็จ {res.committed.stakeholders} ราย ({res.committed.issues} ประเด็น) เป็นฉบับร่าง</span>
          <Link href="/completeness" className="btn-primary py-1.5">ไปตรวจสอบความครบถ้วน</Link>
        </div>
      )}

      {res?.summary && !res.committed && (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div className="text-sm">
              พบ <b>{res.summary.rows}</b> แถว · นำเข้าได้ <b>{res.summary.importable}</b> แถว →
              <b> {res.summary.stakeholders}</b> ราย <b>{res.summary.issues}</b> ประเด็น · ครบถ้วน <b>{res.summary.complete}</b> แถว
            </div>
            <button type="button" className="btn-primary" disabled={pending || !res.summary.stakeholders} onClick={() => send("commit")}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} ยืนยันนำเข้า
            </button>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-2 font-medium">แถว</th>
                  <th className="px-4 py-2 font-medium">ชื่อ</th>
                  <th className="px-4 py-2 font-medium">ส่วนงาน</th>
                  <th className="px-4 py-2 font-medium">กลุ่มย่อย</th>
                  <th className="px-4 py-2 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {res.preview?.map((p) => (
                  <tr key={p.row} className={p.errors.length ? "bg-red-50/50" : ""}>
                    <td className="px-4 py-2 tabular-nums">{p.row}</td>
                    <td className="px-4 py-2">{p.name}</td>
                    <td className="px-4 py-2">{p.department}</td>
                    <td className="px-4 py-2">{p.subgroup || "–"}</td>
                    <td className="px-4 py-2">
                      <Badge tone={p.errors.length ? "red" : p.status === "ครบถ้วน" ? "green" : "orange"}>{p.status}</Badge>
                      {[...p.errors, ...p.warnings].map((m) => <div key={m} className="mt-1 text-xs text-gray-600">• {m}</div>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
