import type { Metadata } from "next";
import AuthCard from "../AuthCard";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

const NOTICES: Record<string, string> = {
  link: "ลิงก์หมดอายุหรือถูกใช้ไปแล้ว หากเป็นลิงก์ยืนยันอีเมล ให้ลองเข้าสู่ระบบได้เลย หากเป็นลิงก์ตั้งรหัสผ่าน กรุณาขอใหม่ที่เมนูลืมรหัสผ่าน",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <AuthCard title="เข้าสู่ระบบ">
      <LoginForm next={next ?? "/dashboard"} notice={error ? NOTICES[error] ?? error : undefined} />
    </AuthCard>
  );
}
