import ExcelJS from "exceljs";
import { COLUMNS, SECTIONS, SHEET_NAME, TITLE, normHeader, type ColKey, type SheetRow } from "./layout";

const GREEN = "FF168151";
const GRAY = "FFE5E7EB";

/** สร้างไฟล์ Excel ตามโครงสร้างต้นฉบับ (แท็บ แบบกรอกข้อมูล + สรุป) */
export async function buildWorkbook(rows: SheetRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Stakeholder Profile Management System – กยท.";
  wb.created = new Date();

  const ws = wb.addWorksheet(SHEET_NAME, { views: [{ state: "frozen", xSplit: 6, ySplit: 3 }] });
  ws.columns = COLUMNS.map((c) => ({ key: c.col, width: c.width }));

  ws.mergeCells("A1:AB1");
  ws.getCell("A1").value = TITLE;
  ws.getCell("A1").font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };

  for (const s of SECTIONS) {
    if (s.from !== s.to) ws.mergeCells(`${s.from}2:${s.to}2`);
    const c = ws.getCell(`${s.from}2`);
    c.value = s.label;
    c.font = { bold: true };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6F5E1" } };
  }

  const head = ws.getRow(3);
  COLUMNS.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true };
    cell.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.computed ? GRAY : "FFF0FDF4" } };
    cell.border = { bottom: { style: "thin" } };
  });
  head.height = 58;

  rows.forEach((r, idx) => {
    const n = idx + 4;
    const row = ws.getRow(n);
    COLUMNS.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      if (c.key === "seq") cell.value = idx + 1;
      else if (c.key === "priority")
        cell.value = { formula: `IF(OR(P${n}="",Q${n}=""),"",P${n}*Q${n})`, result: (r.priority as number) ?? "" };
      else if (c.key === "issueScore")
        cell.value = { formula: `IF(OR(S${n}="",T${n}=""),"",S${n}*T${n})`, result: (r.issueScore as number) ?? "" };
      else {
        const v = r[c.key as Exclude<ColKey, "seq">];
        cell.value = v === "" || v == null ? null : v;
      }
      cell.alignment = { wrapText: true, vertical: "top" };
      if (c.computed) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    });
    const st = row.getCell(COLUMNS.length);
    st.font = { color: { argb: r.status === "ครบถ้วน" ? "FF125237" : "FFC2410C" }, bold: true };
  });

  addSummarySheet(wb, rows);
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

function addSummarySheet(wb: ExcelJS.Workbook, rows: SheetRow[]) {
  const ws = wb.addWorksheet("สรุป");
  ws.columns = [{ width: 40 }, { width: 55 }, { width: 14 }, { width: 22 }, { width: 18 }];
  ws.getCell("A1").value = "สรุปจำนวนผู้มีส่วนได้ส่วนเสียตามกลุ่มและกลุ่มย่อย (จากข้อมูลที่ส่งออก)";
  ws.getCell("A1").font = { bold: true, size: 12 };
  const h = ws.getRow(3);
  ["กลุ่มผู้มีส่วนได้ส่วนเสีย", "กลุ่มย่อย", "จำนวนรายการ", "คะแนนลำดับความสำคัญเฉลี่ย\n(ความสนใจ × อิทธิพล)", "จำนวนรายการที่ยังไม่ครบถ้วน"].forEach((t, i) => {
    const c = h.getCell(i + 1);
    c.value = t;
    c.font = { bold: true };
    c.alignment = { wrapText: true };
  });

  const map = new Map<string, { g: string; s: string; n: number; sum: number; cnt: number; bad: number }>();
  for (const r of rows) {
    const key = `${r.group}||${r.subgroup ?? ""}`;
    const m = map.get(key) ?? { g: String(r.group ?? ""), s: String(r.subgroup ?? ""), n: 0, sum: 0, cnt: 0, bad: 0 };
    m.n++;
    if (typeof r.priority === "number") { m.sum += r.priority; m.cnt++; }
    if (r.status !== "ครบถ้วน") m.bad++;
    map.set(key, m);
  }
  let i = 4;
  for (const m of map.values()) {
    ws.getRow(i++).values = [m.g, m.s, m.n, m.cnt ? Math.round((m.sum / m.cnt) * 100) / 100 : "-", m.bad];
  }
  const total = ws.getRow(i);
  total.values = ["รวมทั้งหมด", "", rows.length, "", rows.filter((r) => r.status !== "ครบถ้วน").length];
  total.font = { bold: true };
}

export type ParsedRow = SheetRow & { rowNumber: number };
export type ParseResult = { headerOk: boolean; headerRow: number; missingHeaders: string[]; rows: ParsedRow[] };

/** อ่านไฟล์ตามรูปแบบต้นฉบับ: หาแถวหัวตาราง (คอลัมน์ F = ชื่อผู้มีส่วนได้ส่วนเสีย) แล้วอ่านแถวถัดไป */
export async function parseWorkbook(buf: Buffer | ArrayBuffer): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buf as any);
  const ws = wb.getWorksheet(SHEET_NAME) ?? wb.worksheets.find((w) => w.state !== "hidden") ?? wb.worksheets[0];
  if (!ws) return { headerOk: false, headerRow: 0, missingHeaders: ["ไม่พบแผ่นงาน"], rows: [] };

  let headerRow = 0;
  for (let r = 1; r <= 10; r++) {
    if (normHeader(ws.getCell(`F${r}`).text ?? "").startsWith(normHeader("ชื่อผู้มีส่วนได้ส่วนเสีย"))) { headerRow = r; break; }
  }
  if (!headerRow) return { headerOk: false, headerRow: 0, missingHeaders: ["ชื่อผู้มีส่วนได้ส่วนเสีย (คอลัมน์ F)"], rows: [] };

  const missingHeaders = COLUMNS.filter((c) => {
    const t = normHeader(ws.getCell(`${c.col}${headerRow}`).text ?? "");
    return normHeader(c.header) !== t;
  }).map((c) => `${c.col}: ${c.header.replace(/\n/g, " ")}`);

  const rows: ParsedRow[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const get = (col: string) => {
      const t = (ws.getCell(`${col}${r}`).text ?? "").trim();
      return t === "" ? null : t;
    };
    const name = get("F");
    if (!name) continue; // แถวว่าง (เหมือน Excel ที่ไม่นับแถวที่ไม่มีชื่อ)
    const row: ParsedRow = { rowNumber: r };
    for (const c of COLUMNS) {
      if (c.key === "seq") continue;
      const v = get(c.col);
      if (["interest", "influence", "impactOrg", "impactSh", "priority", "issueScore"].includes(c.key)) {
        const n = v == null ? null : Number(v);
        row[c.key as "interest"] = n != null && Number.isFinite(n) ? n : v;
      } else row[c.key as "name"] = v;
    }
    rows.push(row);
  }
  // หัวตารางที่ต่างได้เล็กน้อยยอมรับ แต่คอลัมน์หลักต้องตรง
  const essential = ["B", "C", "D", "F", "O", "P", "Q", "S", "T", "V", "Y"];
  const headerOk = !missingHeaders.some((m) => essential.includes(m.split(":")[0]));
  return { headerOk, headerRow, missingHeaders, rows };
}
