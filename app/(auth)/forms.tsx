"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { forgotPassword, login, register, updatePassword, type AuthState } from "./actions";

function Password({ name, label, autoComplete, hint }: { name: string; label: string; autoComplete: string; hint?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <div className="relative">
        <input id={name} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} required className="input pr-11" />
        <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 hover:text-gray-800">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function Email() {
  return (
    <div>
      <label htmlFor="email" className="label">อีเมล</label>
      <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="name@raot.co.th" />
    </div>
  );
}

function Feedback({ state }: { state: AuthState }) {
  if (state.error) return <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800">{state.ok}</p>;
  return null;
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending && <Loader2 className="h-4 w-4 animate-spin" />} {children}
    </button>
  );
}

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, notice ? { error: notice } : {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Email />
      <Password name="password" label="รหัสผ่าน" autoComplete="current-password" />
      <div className="text-right text-sm">
        <Link href="/forgot-password" className="text-brand-700 hover:underline">ลืมรหัสผ่าน?</Link>
      </div>
      <Feedback state={state} />
      <Submit pending={pending}>{pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}</Submit>
      <p className="text-center text-sm text-gray-600">
        ยังไม่มีบัญชี? <Link href="/register" className="font-medium text-brand-700 hover:underline">สมัครใช้งาน</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(register, {});
  if (state.ok)
    return (
      <div className="space-y-4">
        <Feedback state={state} />
        <Link href="/login" className="btn-secondary w-full">กลับไปหน้าเข้าสู่ระบบ</Link>
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="full_name" className="label">ชื่อ-สกุล</label>
        <input id="full_name" name="full_name" autoComplete="name" required className="input" />
      </div>
      <Email />
      <Password name="password" label="รหัสผ่าน" autoComplete="new-password" hint="อย่างน้อย 8 ตัวอักษร" />
      <Password name="confirm" label="ยืนยันรหัสผ่าน" autoComplete="new-password" />
      <Feedback state={state} />
      <Submit pending={pending}>สมัครใช้งาน</Submit>
      <p className="text-xs text-gray-500">หลังสมัคร ผู้ดูแลระบบ (กองประเมินผล) จะตรวจสอบ กำหนดส่วนงาน และเปิดใช้งานบัญชีให้</p>
      <p className="text-center text-sm text-gray-600">
        มีบัญชีแล้ว? <Link href="/login" className="font-medium text-brand-700 hover:underline">เข้าสู่ระบบ</Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(forgotPassword, {});
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-gray-600">กรอกอีเมลที่ใช้เข้าสู่ระบบ ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้</p>
      <Email />
      <Feedback state={state} />
      <Submit pending={pending}>ส่งลิงก์ตั้งรหัสผ่านใหม่</Submit>
      <p className="text-center text-sm"><Link href="/login" className="text-brand-700 hover:underline">กลับไปหน้าเข้าสู่ระบบ</Link></p>
    </form>
  );
}

export function ResetForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, {});
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-gray-600">ตั้งรหัสผ่านใหม่สำหรับ <b>{email}</b></p>
      <Password name="password" label="รหัสผ่านใหม่" autoComplete="new-password" hint="อย่างน้อย 8 ตัวอักษร" />
      <Password name="confirm" label="ยืนยันรหัสผ่านใหม่" autoComplete="new-password" />
      <Feedback state={state} />
      <Submit pending={pending}>บันทึกรหัสผ่านใหม่</Submit>
    </form>
  );
}
