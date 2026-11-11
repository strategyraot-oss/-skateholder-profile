// ตรวจความครบถ้วนตามคอลัมน์ AB ของไฟล์ต้นฉบับ (ลำดับเดียวกับ view v_stakeholder_rows)
import { OTHER, subgroupBelongsTo } from "./reference";

export type RowInput = {
  department?: string | null;
  group?: string | null;
  subgroup?: string | null;
  otherText?: string | null;
  name?: string | null;
  issueText?: string | null;
  engagementLevel?: string | null;
  responsibleUnit?: string | null;
  interest?: number | null;
  influence?: number | null;
  impactOrg?: number | null;
  impactSh?: number | null;
};

export type FieldKey = keyof RowInput;

export type Problem = { field: FieldKey; step: 1 | 2 | 3 | 4 | 5; message: string; excelText: string };

export const COMPLETE = "ครบถ้วน";

const blank = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "");

/** รายการปัญหาทั้งหมดของ 1 แถว (1 ราย × 1 ประเด็น) เรียงตามลำดับการตรวจของ Excel */
export function listProblems(r: RowInput): Problem[] {
  const p: Problem[] = [];
  if (blank(r.department))
    p.push({ field: "department", step: 1, message: "โปรดระบุส่วนงานผู้กรอก", excelText: "โปรดระบุส่วนงานผู้กรอก" });
  if (blank(r.group))
    p.push({ field: "group", step: 1, message: "โปรดเลือกกลุ่มผู้มีส่วนได้ส่วนเสีย", excelText: "โปรดเลือกกลุ่ม" });
  if (blank(r.subgroup))
    p.push({ field: "subgroup", step: 1, message: "โปรดเลือกกลุ่มย่อย", excelText: "โปรดเลือกกลุ่มย่อย" });
  else if (!blank(r.group) && !subgroupBelongsTo(r.group!, r.subgroup!))
    p.push({ field: "subgroup", step: 1, message: "กลุ่มย่อยที่เลือกไม่ได้อยู่ในกลุ่มนี้ กรุณาเลือกใหม่", excelText: "กลุ่มย่อยไม่ตรงกับกลุ่ม" });
  if ((r.group === OTHER || r.subgroup === OTHER) && blank(r.otherText))
    p.push({ field: "otherText", step: 1, message: "เลือก “อื่น ๆ” แล้ว กรุณาระบุชื่อกลุ่ม/กลุ่มย่อย", excelText: "โปรดระบุกลุ่มอื่น ๆ ในคอลัมน์ E" });
  if (blank(r.name))
    p.push({ field: "name", step: 2, message: "โปรดระบุชื่อผู้มีส่วนได้ส่วนเสีย", excelText: "" });

  const REQ = "กรอกข้อมูลบังคับยังไม่ครบ";
  if (blank(r.issueText))
    p.push({ field: "issueText", step: 3, message: "โปรดระบุประเด็น/ความต้องการ/ความคาดหวัง", excelText: REQ });
  if (blank(r.engagementLevel))
    p.push({ field: "engagementLevel", step: 5, message: "โปรดเลือกระดับการสร้างความสัมพันธ์", excelText: REQ });
  if (blank(r.responsibleUnit))
    p.push({ field: "responsibleUnit", step: 5, message: "โปรดระบุหน่วยงานภายในที่รับผิดชอบ", excelText: REQ });

  const SCORE = "ยังให้คะแนนไม่ครบ";
  if (blank(r.interest)) p.push({ field: "interest", step: 4, message: "โปรดเลือกระดับความสนใจ (Interest)", excelText: SCORE });
  if (blank(r.influence)) p.push({ field: "influence", step: 4, message: "โปรดเลือกระดับอิทธิพล (Influence)", excelText: SCORE });
  if (blank(r.impactOrg)) p.push({ field: "impactOrg", step: 4, message: "โปรดเลือกระดับผลกระทบต่อองค์กร", excelText: SCORE });
  if (blank(r.impactSh)) p.push({ field: "impactSh", step: 4, message: "โปรดเลือกระดับผลกระทบต่อผู้มีส่วนได้ส่วนเสีย", excelText: SCORE });
  return p;
}

/**
 * ข้อความสถานะเหมือนคอลัมน์ AB:
 * - ไม่มีชื่อ (F ว่าง) → "" (Excel ถือเป็นแถวว่าง)
 * - มีปัญหา → ข้อความแรกตามลำดับ
 * - ไม่มีปัญหา → "ครบถ้วน"
 */
export function excelStatus(r: RowInput): string {
  if (blank(r.name)) return "";
  const first = listProblems(r)[0];
  return first ? first.excelText : COMPLETE;
}

export function isComplete(r: RowInput): boolean {
  return listProblems(r).length === 0;
}
