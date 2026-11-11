"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, Search, Sparkles } from "lucide-react";

/* ---------- Field wrapper ---------- */
export function Field({
  label, required, hint, error, children, htmlFor,
}: {
  label: string; required?: boolean; hint?: string; error?: string | null; children: React.ReactNode; htmlFor?: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label} {required ? <span className="text-red-600">*</span> : <span className="font-normal text-gray-400">(ไม่บังคับ)</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-orange-700">{error}</p>}
    </div>
  );
}

/* ---------- Suggestion chips ---------- */
export function Chips({ items, onPick, label = "ตัวอย่าง" }: { items: string[]; onPick: (v: string) => void; label?: string }) {
  if (!items.length) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
        <Sparkles className="h-3.5 w-3.5 text-brand-600" /> {label}:
      </span>
      {items.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className="max-w-full truncate rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs text-brand-800 hover:bg-brand-100"
          title={s}
        >
          {s.length > 60 ? s.slice(0, 60) + "…" : s}
        </button>
      ))}
    </div>
  );
}

/* ---------- Rating cards (แทนช่องกรอกตัวเลข) ---------- */
export function RatingCards({
  value, onChange, options, name,
}: {
  value: number | null;
  onChange: (v: number) => void;
  options: readonly { value: number; label: string }[];
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className={clsx("grid gap-2", options.length === 5 ? "grid-cols-5" : "grid-cols-4")}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={clsx(
              "flex flex-col items-center rounded-xl border-2 px-1 py-2.5 text-center transition",
              on ? "border-brand-600 bg-brand-600 text-white shadow" : "border-gray-200 bg-white hover:border-brand-300 hover:bg-brand-50",
            )}
          >
            <span className="text-xl font-semibold leading-none">{o.value}</span>
            <span className={clsx("mt-1 text-[11px] leading-tight sm:text-xs", on ? "text-brand-50" : "text-gray-600")}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Badges ---------- */
const TONES = {
  gray: "bg-gray-100 text-gray-700",
  blue: "bg-blue-50 text-blue-700",
  orange: "bg-orange-50 text-orange-700",
  green: "bg-brand-50 text-brand-700",
  red: "bg-red-50 text-red-700",
} as const;

export function Badge({ tone = "gray", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", TONES[tone])}>{children}</span>;
}

export function ScorePill({ score, max }: { score: number | null; max: 25 | 16 }) {
  if (score == null) return <span className="text-sm text-gray-400">–</span>;
  const r = score / max;
  const cls = r > 0.75 ? "bg-brand-800 text-white" : r > 0.5 ? "bg-brand-600 text-white" : r > 0.25 ? "bg-brand-200 text-brand-900" : "bg-gray-100 text-gray-700";
  const label = r > 0.75 ? "สูงมาก" : r > 0.5 ? "สูง" : r > 0.25 ? "ปานกลาง" : "ต่ำ";
  return (
    <span className={clsx("inline-flex items-baseline gap-1 rounded-lg px-2 py-0.5 text-sm font-semibold tabular-nums", cls)}>
      {score}<span className="text-[11px] font-normal opacity-80">/{max} · {label}</span>
    </span>
  );
}

/* ---------- Searchable select (combobox) ---------- */
export type Option = { value: string; label: string; hint?: string };

export function SearchSelect({
  value, onChange, options, placeholder = "เลือก…", disabled, id,
}: {
  value: string | null; onChange: (v: string) => void; options: Option[]; placeholder?: string; disabled?: boolean; id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => (o.label + " " + (o.hint ?? "")).toLowerCase().includes(t)) : options;
  }, [q, options]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    setTimeout(() => input.current?.focus(), 0);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (o: Option) => {
    onChange(o.value);
    setOpen(false);
    setQ("");
  };

  return (
    <div ref={box} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={clsx("input flex items-center justify-between text-left", !selected && "text-gray-400", disabled && "bg-gray-50")}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-gray-100 px-3">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              ref={input}
              value={q}
              onChange={(e) => { setQ(e.target.value); setHi(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, filtered.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
                else if (e.key === "Enter") { e.preventDefault(); if (filtered[hi]) pick(filtered[hi]); }
                else if (e.key === "Escape") setOpen(false);
              }}
              placeholder="พิมพ์เพื่อค้นหา…"
              className="w-full py-2.5 text-sm outline-none"
              aria-controls={listId}
            />
          </div>
          <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">ไม่พบรายการที่ค้นหา</li>}
            {filtered.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setHi(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                className={clsx("flex cursor-pointer items-start gap-2 px-3 py-2 text-sm", i === hi && "bg-brand-50")}
              >
                <Check className={clsx("mt-0.5 h-4 w-4 shrink-0 text-brand-600", o.value !== value && "invisible")} />
                <span>
                  {o.label}
                  {o.hint && <span className="block text-xs text-gray-500">{o.hint}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
