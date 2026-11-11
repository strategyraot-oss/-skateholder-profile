// กราฟแบบ HTML/CSS ล้วน (render ฝั่ง server ไม่ต้องใช้ไลบรารีเพิ่ม)
// หลักการ: ข้อมูลชุดเดียว = สีเดียว (เขียวหลัก), แสดงค่าบนทุกแท่ง, hover แสดงรายละเอียดผ่าน title
import Link from "next/link";

export type BarItem = { key: string; label: string; value: number; detail?: string; href?: string };

export function BarList({ items, unit = "", emptyText = "ยังไม่มีข้อมูล" }: { items: BarItem[]; unit?: string; emptyText?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.some((i) => i.value > 0)) return <p className="py-6 text-center text-sm text-gray-500">{emptyText}</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((i) => {
        const w = (i.value / max) * 100;
        const title = `${i.label}: ${i.value.toLocaleString("th-TH")} ${unit}${i.detail ? ` · ${i.detail}` : ""}`;
        const body = (
          <div className="group" title={title}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-gray-800 group-hover:text-brand-800">{i.label}</span>
              <span className="shrink-0 tabular-nums text-gray-900">
                {i.value.toLocaleString("th-TH")}
                {i.detail && <span className="ml-1.5 text-xs text-gray-500">{i.detail}</span>}
              </span>
            </div>
            <div className="h-2.5 rounded-r bg-gray-100">
              <div className="h-full rounded-r bg-brand-600 transition-colors group-hover:bg-brand-700" style={{ width: `${Math.max(w, i.value > 0 ? 1.5 : 0)}%` }} />
            </div>
          </div>
        );
        return <li key={i.key}>{i.href ? <Link href={i.href}>{body}</Link> : body}</li>;
      })}
    </ul>
  );
}

const STATUS_COLORS = {
  draft: { color: "#9ca3af", label: "ฉบับร่าง" },
  submitted: { color: "#2a78d6", label: "รอตรวจสอบ" },
  returned: { color: "#e5770e", label: "ส่งกลับแก้ไข" },
  approved: { color: "#168151", label: "อนุมัติแล้ว" },
} as const;

export function StatusBar({ counts }: { counts: Record<keyof typeof STATUS_COLORS, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const keys = Object.keys(STATUS_COLORS) as (keyof typeof STATUS_COLORS)[];
  return (
    <div>
      <div className="flex h-4 gap-[2px] overflow-hidden rounded bg-gray-100" role="img" aria-label="สัดส่วนสถานะรายการ">
        {total > 0 &&
          keys.filter((k) => counts[k] > 0).map((k) => (
            <div key={k} title={`${STATUS_COLORS[k].label}: ${counts[k]} ราย`} style={{ width: `${(counts[k] / total) * 100}%`, background: STATUS_COLORS[k].color }} />
          ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {keys.map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLORS[k].color }} />
            <span className="text-gray-700">{STATUS_COLORS[k].label}</span>
            <span className="tabular-nums text-gray-900">{counts[k].toLocaleString("th-TH")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ramp เขียวลำดับเดียว (อ่อน → เข้ม) สำหรับความถี่
const RAMP = ["#eefbf3", "#b0e9c7", "#7cd6a6", "#47bc80", "#23a065", "#168151", "#125237"];

export type MatrixCell = { interest: number; influence: number; issues: number; stakeholders: number };

/** Power–Interest Matrix: แกน X = ความสนใจ, แกน Y = อิทธิพล, ค่าในช่อง = จำนวนประเด็น */
export function PowerInterestMatrix({ cells }: { cells: MatrixCell[] }) {
  const get = (i: number, f: number) => cells.find((c) => c.interest === i && c.influence === f);
  const max = Math.max(1, ...cells.map((c) => c.issues));
  const rows = [5, 4, 3, 2, 1];
  const cols = [1, 2, 3, 4, 5];
  return (
    <div>
      <div className="flex gap-2">
        <div className="flex w-5 items-center justify-center">
          <span className="-rotate-90 whitespace-nowrap text-xs text-gray-600">อิทธิพล (Influence) →</span>
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-[1.5rem_repeat(5,1fr)] gap-[2px]">
            {rows.map((f) => (
              <Row key={f} f={f} cols={cols} get={get} max={max} />
            ))}
            <div />
            {cols.map((i) => <div key={i} className="pt-1 text-center text-xs text-gray-600">{i}</div>)}
          </div>
          <div className="mt-1 text-center text-xs text-gray-600">ความสนใจ (Interest) →</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Quad label="ทำให้พึงพอใจ (Keep Satisfied)" desc="อิทธิพลสูง ความสนใจต่ำ" n={sum(cells, (c) => c.influence >= 3 && c.interest < 3)} />
        <Quad label="บริหารจัดการใกล้ชิด (Manage Closely)" desc="อิทธิพลสูง ความสนใจสูง" n={sum(cells, (c) => c.influence >= 3 && c.interest >= 3)} strong />
        <Quad label="ติดตามสถานการณ์ (Monitor)" desc="อิทธิพลต่ำ ความสนใจต่ำ" n={sum(cells, (c) => c.influence < 3 && c.interest < 3)} />
        <Quad label="แจ้งให้ทราบสม่ำเสมอ (Keep Informed)" desc="อิทธิพลต่ำ ความสนใจสูง" n={sum(cells, (c) => c.influence < 3 && c.interest >= 3)} />
      </div>
      <p className="mt-2 text-xs text-gray-500">ตัวเลขในช่อง = จำนวนประเด็น · สีเข้ม = จำนวนมาก · แบ่งกลุ่มที่ระดับ 3 ขึ้นไป = สูง</p>
    </div>
  );
}

function Row({ f, cols, get, max }: { f: number; cols: number[]; get: (i: number, f: number) => MatrixCell | undefined; max: number }) {
  return (
    <>
      <div className="flex items-center justify-center text-xs text-gray-600">{f}</div>
      {cols.map((i) => {
        const c = get(i, f);
        const n = c?.issues ?? 0;
        const idx = n === 0 ? -1 : Math.min(RAMP.length - 1, Math.ceil((n / max) * (RAMP.length - 1)));
        const bg = idx < 0 ? "#f5f7f6" : RAMP[idx];
        const dark = idx >= 4;
        const hiQuad = i >= 3 && f >= 3;
        return (
          <div
            key={i}
            title={`ความสนใจ ${i} × อิทธิพล ${f} = คะแนน ${i * f}\n${n} ประเด็น · ${c?.stakeholders ?? 0} ราย`}
            className="flex aspect-[4/3] items-center justify-center rounded text-sm font-semibold tabular-nums"
            style={{
              background: bg,
              color: dark ? "#fff" : "#1f2a24",
              outline: hiQuad ? "1px dashed #125237" : undefined,
              outlineOffset: -3,
            }}
          >
            {n > 0 ? n : ""}
          </div>
        );
      })}
    </>
  );
}

function Quad({ label, desc, n, strong }: { label: string; desc: string; n: number; strong?: boolean }) {
  return (
    <div className={`rounded-lg border p-2 ${strong ? "border-brand-300 bg-brand-50" : "border-gray-200"}`}>
      <div className="font-medium text-gray-900">{label}</div>
      <div className="text-gray-500">{desc}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{n.toLocaleString("th-TH")} ประเด็น</div>
    </div>
  );
}

const sum = (cells: MatrixCell[], f: (c: MatrixCell) => boolean) => cells.filter(f).reduce((a, c) => a + c.issues, 0);
