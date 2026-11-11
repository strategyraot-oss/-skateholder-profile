"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** รับ token แบบ #access_token=...&refresh_token=... (implicit flow) แล้วสร้าง session */
export default function AuthCompletePage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    let next = query.get("next") ?? "/dashboard";
    if (!next.startsWith("/") || next.startsWith("//")) next = "/dashboard";

    if (hash.get("error_description")) {
      setError("ลิงก์หมดอายุหรือถูกใช้ไปแล้ว");
      return;
    }
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    if (!access_token || !refresh_token) {
      setError("ไม่พบข้อมูลยืนยันในลิงก์");
      return;
    }
    if (hash.get("type") === "recovery") next = "/reset-password";
    createClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error: e }) => (e ? setError("ลิงก์หมดอายุหรือถูกใช้ไปแล้ว") : window.location.replace(next)));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card max-w-md p-8 text-center">
        {error ? (
          <>
            <h1 className="text-lg font-semibold">{error}</h1>
            <p className="mt-2 text-sm text-gray-600">หากเป็นลิงก์ยืนยันอีเมล ให้ลองเข้าสู่ระบบได้เลย หากเป็นลิงก์ตั้งรหัสผ่าน กรุณาขอลิงก์ใหม่</p>
            <div className="mt-5 flex justify-center gap-2">
              <Link href="/login" className="btn-primary">เข้าสู่ระบบ</Link>
              <Link href="/forgot-password" className="btn-secondary">ขอลิงก์ใหม่</Link>
            </div>
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm text-gray-700"><Loader2 className="h-4 w-4 animate-spin" /> กำลังยืนยันตัวตน…</p>
        )}
      </div>
    </main>
  );
}
