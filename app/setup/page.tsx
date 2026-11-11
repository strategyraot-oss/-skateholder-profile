import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { envStatus } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "ตั้งค่าการเชื่อมต่อ Supabase" };
export const dynamic = "force-dynamic";

export default function SetupPage() {
  const s = envStatus();
  const ready = s.hasUrl && s.urlValid && s.hasKey;
  const rows = [
    { name: "NEXT_PUBLIC_SUPABASE_URL", ok: s.hasUrl && s.urlValid, note: !s.hasUrl ? "ยังไม่ได้ตั้งค่า" : !s.urlValid ? "รูปแบบไม่ถูกต้อง (ต้องขึ้นต้นด้วย https://)" : "ตั้งค่าแล้ว" },
    { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", ok: s.hasKey, note: !s.hasKey ? "ยังไม่ได้ตั้งค่า" : s.keyLooksValid ? "ตั้งค่าแล้ว" : "ตั้งค่าแล้ว แต่รูปแบบดูไม่ใช่ Anon Key" },
  ];
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card w-full max-w-xl space-y-5 p-6 sm:p-8">
        <h1 className="text-lg font-semibold">ตั้งค่าการเชื่อมต่อฐานข้อมูล Supabase</h1>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.name} className="flex items-start gap-2 rounded-xl border border-gray-200 p-3 text-sm">
              {r.ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-600" /> : <XCircle className="h-5 w-5 shrink-0 text-red-600" />}
              <div><code className="font-mono text-xs">{r.name}</code><div className="text-gray-600">{r.note}</div></div>
            </li>
          ))}
        </ul>
        {ready ? (
          <Link href="/login" className="btn-primary">ไปหน้าเข้าสู่ระบบ</Link>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
            <li>Supabase → Project Settings → API คัดลอก <b>Project URL</b> และ <b>anon public key</b></li>
            <li>Vercel → โปรเจกต์ → Settings → Environment Variables เพิ่ม 2 ค่าด้านบน (เลือกทุก Environment)</li>
            <li>Vercel → Deployments → ⋯ → <b>Redeploy</b> (ต้อง deploy ใหม่ทุกครั้งที่แก้ค่า)</li>
          </ol>
        )}
      </div>
    </main>
  );
}
