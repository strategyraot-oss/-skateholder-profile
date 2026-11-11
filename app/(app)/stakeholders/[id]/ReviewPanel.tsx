"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageSquare, Send, Trash2, Undo2 } from "lucide-react";
import type { RecordStatus } from "@/lib/types";
import {
  approveStakeholder, commentStakeholder, deleteStakeholder, returnStakeholder, submitStakeholder, type ActionResult,
} from "../actions";

export default function ReviewPanel({
  id, status, canReview, canSubmit, canDelete,
}: { id: string; status: RecordStatus; canReview: boolean; canSubmit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionResult>, okText: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setMsg({ ok: true, text: okText });
        setComment("");
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  };

  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-semibold">การตรวจสอบ</h2>

      {canSubmit && (
        <button className="btn-primary w-full" disabled={pending}
          onClick={() => run(() => submitStakeholder(id), "ส่งข้อมูลเรียบร้อยแล้ว", "ยืนยันส่งข้อมูลให้ผู้ตรวจสอบ?")}>
          <Send className="h-4 w-4" /> ส่งข้อมูลให้ผู้ตรวจสอบ
        </button>
      )}

      {(canReview || status !== "draft") && (
        <>
          <textarea
            className="input min-h-24"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={canReview ? "ข้อเสนอแนะ / เหตุผลที่ส่งกลับแก้ไข" : "พิมพ์ความคิดเห็นหรือคำชี้แจง"}
          />
          <div className="grid gap-2">
            {canReview && status === "submitted" && (
              <>
                <button className="btn-primary" disabled={pending}
                  onClick={() => run(() => approveStakeholder(id, comment), "อนุมัติเรียบร้อยแล้ว", "ยืนยันอนุมัติข้อมูลรายการนี้?")}>
                  <CheckCircle2 className="h-4 w-4" /> อนุมัติ
                </button>
                <button className="btn-secondary border-orange-300 text-orange-800" disabled={pending || !comment.trim()}
                  onClick={() => run(() => returnStakeholder(id, comment), "ส่งกลับให้ส่วนงานแก้ไขแล้ว")}>
                  <Undo2 className="h-4 w-4" /> ส่งกลับแก้ไข
                </button>
              </>
            )}
            {canReview && status === "approved" && (
              <button className="btn-secondary" disabled={pending || !comment.trim()}
                onClick={() => run(() => returnStakeholder(id, comment), "ส่งกลับให้ส่วนงานแก้ไขแล้ว", "ยกเลิกการอนุมัติและส่งกลับแก้ไข?")}>
                <Undo2 className="h-4 w-4" /> ยกเลิกอนุมัติและส่งกลับ (ผู้ดูแลระบบ)
              </button>
            )}
            <button className="btn-secondary" disabled={pending || !comment.trim()}
              onClick={() => run(() => commentStakeholder(id, comment), "บันทึกความคิดเห็นแล้ว")}>
              <MessageSquare className="h-4 w-4" /> บันทึกความคิดเห็น
            </button>
          </div>
          {canReview && status === "submitted" && (
            <p className="text-xs text-gray-500">การส่งกลับแก้ไขต้องระบุข้อเสนอแนะ เพื่อให้ส่วนงานทราบสิ่งที่ต้องแก้ไข</p>
          )}
        </>
      )}

      {canDelete && (
        <button className="flex items-center gap-1 text-sm text-red-700 hover:underline" disabled={pending}
          onClick={() => run(() => deleteStakeholder(id), "ลบแล้ว", "ต้องการลบฉบับร่างนี้ใช่หรือไม่? ลบแล้วกู้คืนไม่ได้")}>
          <Trash2 className="h-4 w-4" /> ลบฉบับร่าง
        </button>
      )}

      {msg && <p className={msg.ok ? "text-sm text-brand-700" : "text-sm text-red-700"}>{msg.text}</p>}
    </section>
  );
}
