export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white shadow">SP</div>
          <div className="text-xl font-semibold text-gray-900">Stakeholder Profile Management System</div>
          <p className="mt-1 text-sm text-gray-600">ระบบฐานข้อมูลผู้มีส่วนได้ส่วนเสีย การยางแห่งประเทศไทย (กยท.)</p>
        </div>
        {children}
        <p className="mt-6 text-center text-xs text-gray-500">พบปัญหาการเข้าใช้งาน โปรดติดต่อกองประเมินผล</p>
      </div>
    </main>
  );
}
