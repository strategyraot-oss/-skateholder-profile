import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getSession } from "@/lib/auth";
import { logout } from "@/app/(auth)/actions";

// ทุกหน้าในระบบขึ้นกับผู้ใช้ที่เข้าสู่ระบบ จึงสร้างตอนเปิดใช้งานเสมอ (ไม่ prerender ตอน build)
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, profileError } = await getSession();
  if (!user) redirect("/login");

  if (!profile?.active) {
    const title = profileError ? "อ่านข้อมูลบัญชีไม่สำเร็จ" : !profile ? "ไม่พบข้อมูลบัญชีในระบบ" : "บัญชียังไม่ได้รับการเปิดใช้งาน";
    const detail = profileError
      ? "ระบบเข้าสู่ระบบได้ แต่อ่านข้อมูลสิทธิ์จากฐานข้อมูลไม่ได้ โปรดแจ้งผู้ดูแลระบบพร้อมข้อความด้านล่าง"
      : !profile
        ? `บัญชี ${user.email} ยังไม่มีข้อมูลในตาราง profiles (อาจสร้างบัญชีก่อนติดตั้งฐานข้อมูล) โปรดติดต่อกองประเมินผล`
        : `ผู้ดูแลระบบยังไม่ได้กำหนดสิทธิ์และส่วนงานให้บัญชี ${user.email} โปรดติดต่อกองประเมินผล`;
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="card max-w-md p-8 text-center">
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-gray-600">{detail}</p>
          {profileError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-left font-mono text-xs text-red-800">{profileError}</p>}
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
