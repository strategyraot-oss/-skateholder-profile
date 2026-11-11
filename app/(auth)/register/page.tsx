import type { Metadata } from "next";
import AuthCard from "../AuthCard";
import { RegisterForm } from "../forms";

export const metadata: Metadata = { title: "สมัครใช้งาน" };

export default function RegisterPage() {
  return (
    <AuthCard title="สมัครใช้งาน">
      <RegisterForm />
    </AuthCard>
  );
}
