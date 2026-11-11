import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold">ไม่พบหน้าหรือข้อมูลที่ต้องการ</h1>
        <p className="mt-2 text-sm text-gray-600">ข้อมูลอาจถูกลบ หรือท่านไม่มีสิทธิ์เข้าถึงข้อมูลนี้</p>
        <Link href="/dashboard" className="btn-primary mt-5">กลับหน้า Dashboard</Link>
      </div>
    </main>
  );
}
