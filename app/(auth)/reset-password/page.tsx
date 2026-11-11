import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthCard from "../AuthCard";
import { ResetForm } from "../forms";

export const metadata: Metadata = { title: "ตั้งรหัสผ่านใหม่" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password");
  return (
    <AuthCard title="ตั้งรหัสผ่านใหม่">
      <ResetForm email={user.email ?? ""} />
    </AuthCard>
  );
}
