"use client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <h1 className="text-lg font-semibold">เกิดข้อผิดพลาดในการแสดงหน้านี้</h1>
      <p className="mt-2 text-sm text-gray-600">กรุณาลองใหม่อีกครั้ง หากยังพบปัญหา โปรดแจ้งผู้ดูแลระบบพร้อมรหัสอ้างอิง</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-gray-500">รหัสอ้างอิง: {error.digest}</p>}
      <button onClick={reset} className="btn-primary mt-5">ลองใหม่</button>
    </div>
  );
}
