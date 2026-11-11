import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getSession } from "@/lib/auth";
import { logout } from "@/app/(auth)/login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getSession();
  if (!user) redirect("/login");

  if (!profile?.active) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="card max-w-md p-8 text-center">
          <h1 className="text-lg font-semibold">บัญชียังไม่ได้รับการเปิดใช้งาน</h1>
          <p className="mt-2 text-sm text-gray-600">
            ผู้ดูแลระบบยังไม่ได้กำหนดสิทธิ์และส่วนงานให้บัญชี {user.email} โปรดติดต่อกองประเมินผล
          </p>
          <form action={logout} className="mt-6">
            <button className="btn-secondary">ออกจากระบบ</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar role={profile.role} name={profile.full_name ?? profile.email ?? ""} department={profile.department?.code} />
      <div className="lg:pl-72">
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
