import type { Metadata } from "next";
import AuthCard from "../AuthCard";
import { ForgotForm } from "../forms";

export const metadata: Metadata = { title: "ลืมรหัสผ่าน" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="ลืมรหัสผ่าน">
      <ForgotForm />
    </AuthCard>
  );
}
