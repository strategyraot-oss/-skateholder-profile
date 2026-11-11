"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import {
  LayoutDashboard, Database, PlusCircle, ClipboardCheck, BarChart3, Building2, Settings, LogOut, Menu, X,
} from "lucide-react";
import type { UserRole } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/domain/reference";
import { logout } from "@/app/(auth)/actions";

const MENU: { href: string; label: string; icon: typeof Database; roles: UserRole[] }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "reviewer", "dept_user"] },
  { href: "/stakeholders", label: "ฐานข้อมูลผู้มีส่วนได้ส่วนเสีย", icon: Database, roles: ["admin", "reviewer", "dept_user"] },
  { href: "/stakeholders/new", label: "เพิ่มข้อมูลผู้มีส่วนได้ส่วนเสีย", icon: PlusCircle, roles: ["admin", "dept_user"] },
  { href: "/completeness", label: "ตรวจสอบความครบถ้วน", icon: ClipboardCheck, roles: ["admin", "reviewer", "dept_user"] },
  { href: "/reports", label: "รายงานและวิเคราะห์ข้อมูล", icon: BarChart3, roles: ["admin", "reviewer", "dept_user"] },
  { href: "/departments", label: "จัดการข้อมูลส่วนงาน", icon: Building2, roles: ["admin", "reviewer"] },
  { href: "/settings", label: "ตั้งค่าระบบ", icon: Settings, roles: ["admin"] },
];

type Props = { role: UserRole; name: string; department?: string | null };

export default function Sidebar({ role, name, department }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = MENU.filter((m) => m.roles.includes(role));
  // เลือกเมนูที่ตรงที่สุด (เช่น /stakeholders/new ไม่ทำให้ /stakeholders active)
  const active = items
    .filter((m) => pathname === m.href || pathname.startsWith(m.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
        <span className="font-semibold text-brand-700">Stakeholder Profile กยท.</span>
        <button type="button" onClick={() => setOpen(true)} aria-label="เปิดเมนู" className="rounded-lg p-2 hover:bg-gray-100">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {open && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-brand-900 text-brand-50 transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div>
            <div className="text-lg font-semibold leading-tight text-white">Stakeholder Profile</div>
            <div className="text-xs text-brand-200">การยางแห่งประเทศไทย (กยท.)</div>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="ปิดเมนู" className="rounded-lg p-1.5 hover:bg-white/10 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition",
                active === href ? "bg-white text-brand-800 font-medium shadow-sm" : "text-brand-100 hover:bg-white/10",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="text-sm font-medium text-white">{name}</div>
          <div className="text-xs text-brand-200">
            {ROLE_LABELS[role]}
            {department ? ` · ${department}` : ""}
          </div>
          <form action={logout} className="mt-3">
            <button type="submit" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-brand-100 hover:bg-white/10">
              <LogOut className="h-4 w-4" /> ออกจากระบบ
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
