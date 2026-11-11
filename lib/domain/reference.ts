// ข้อมูลอ้างอิงจากไฟล์ต้นฉบับ (แท็บ "รายการ" และ "คำชี้แจง") — ต้องตรงกับ supabase/seed.sql

export const OTHER = "อื่น ๆ (โปรดระบุ)";

export const GROUPS: { code: string; name: string; subgroups: string[] }[] = [
  { code: "1", name: "1. ภาครัฐผู้กำกับนโยบายหรือประเมินผล", subgroups: ["1.1 ภาครัฐผู้กำกับนโยบายหรือประเมินผล", OTHER] },
  { code: "2", name: "2. คณะกรรมการ", subgroups: ["2.1 คณะกรรมการ กยท.", "2.2 คณะอนุกรรมการฯ ชุดต่าง ๆ ของ กยท.", OTHER] },
  { code: "3", name: "3. พันธมิตร", subgroups: ["3.1 ผู้ส่งมอบ/คู่ค้า", "3.2 คู่ความร่วมมือ", OTHER] },
  {
    code: "4",
    name: "4. ลูกค้า",
    subgroups: [
      "4.1.1 ลูกค้าส่งเสริม: เกษตรกรชาวสวนยาง",
      "4.1.2 ลูกค้าส่งเสริม: สถาบันเกษตรกรชาวสวนยาง",
      "4.1.3 ลูกค้าส่งเสริม: ผู้ประกอบกิจการยาง/โรงงานแปรรูปยางพารา",
      "4.1.4 ลูกค้าส่งเสริม: สมาคม สภาอุตสาหกรรม นักวิชาการ นักศึกษา",
      "4.2.1 ลูกค้าเชิงพาณิชย์: ผู้ประกอบการผลิตผลิตภัณฑ์ยาง",
      "4.2.2 ลูกค้าเชิงพาณิชย์: สถาบันเกษตรกรแปรรูปผลิตภัณฑ์ยาง",
      "4.2.3 ลูกค้าเชิงพาณิชย์: หน่วยงานภาครัฐ (กรมทางหลวง กรมชลประทาน)",
      "4.2.4 ลูกค้าเชิงพาณิชย์: บริษัทต่างประเทศ",
      "4.2.5 ลูกค้าเชิงพาณิชย์: ผู้ส่งออกยางพารา",
      OTHER,
    ],
  },
  { code: "5", name: "5. ชุมชน", subgroups: ["5.1 ชุมชนรอบพื้นที่ปฏิบัติงาน กยท.", OTHER] },
  { code: "6", name: "6. พนักงาน", subgroups: ["6.1 ผู้บริหาร พนักงาน พนักงานสัญญาจ้าง สหภาพแรงงาน", "6.2 หน่วยงาน/คณะทำงานภายใน กยท.", OTHER] },
  { code: "7", name: "7. สื่อมวลชน", subgroups: ["7.1 สื่อสิ่งพิมพ์/วิทยุและโทรทัศน์", "7.2 สื่อออนไลน์", OTHER] },
  { code: "8", name: "8. คู่เทียบ", subgroups: ["8.1 คู่เทียบ", OTHER] },
  { code: "9", name: OTHER, subgroups: [OTHER] },
];

export function subgroupBelongsTo(group: string, subgroup: string): boolean {
  return GROUPS.some((g) => g.name === group && g.subgroups.includes(subgroup));
}

// เกณฑ์การให้คะแนน (แท็บ "คำชี้แจง")
export const LEVEL_5 = [
  { value: 1, label: "น้อยที่สุด" },
  { value: 2, label: "น้อย" },
  { value: 3, label: "ปานกลาง" },
  { value: 4, label: "มาก" },
  { value: 5, label: "มากที่สุด" },
] as const;

export const LEVEL_4 = [
  { value: 1, label: "ต่ำ" },
  { value: 2, label: "ปานกลาง" },
  { value: 3, label: "สูง" },
  { value: 4, label: "สูงมาก" },
] as const;

export type EngagementKey = "inform" | "consult" | "involve" | "collaborate" | "empower";

export const ENGAGEMENT_LEVELS: {
  key: EngagementKey;
  en: string;
  th: string;
  excelText: string;
  description: string;
  example: string;
}[] = [
  {
    key: "inform", en: "Inform", th: "แจ้งให้ทราบ", excelText: "Inform (แจ้งให้ทราบ)",
    description: "ให้ข้อมูลข่าวสารแก่ผู้มีส่วนได้ส่วนเสียทางเดียว",
    example: "เผยแพร่ข่าวสาร ประกาศ จดหมายข่าว เว็บไซต์ สื่อสังคมออนไลน์",
  },
  {
    key: "consult", en: "Consult", th: "ปรึกษาหารือ", excelText: "Consult (ปรึกษาหารือ)",
    description: "รับฟังความคิดเห็นและข้อเสนอแนะเพื่อประกอบการตัดสินใจ",
    example: "สำรวจความคิดเห็น ประชุมรับฟังความคิดเห็น สัมภาษณ์ กล่องรับข้อเสนอแนะ",
  },
  {
    key: "involve", en: "Involve", th: "มีส่วนร่วม", excelText: "Involve (มีส่วนร่วม)",
    description: "ให้ผู้มีส่วนได้ส่วนเสียเข้ามามีส่วนร่วมในกระบวนการทำงาน",
    example: "เชิญร่วมเป็นคณะทำงาน ร่วมจัดกิจกรรม ร่วมให้ข้อมูลในการวางแผน",
  },
  {
    key: "collaborate", en: "Collaborate", th: "ร่วมมือ", excelText: "Collaborate (ร่วมมือ)",
    description: "ร่วมดำเนินงานและร่วมตัดสินใจในแต่ละขั้นตอน",
    example: "ทำบันทึกความร่วมมือ (MOU) ร่วมดำเนินโครงการ ร่วมตัดสินใจเชิงนโยบาย",
  },
  {
    key: "empower", en: "Empower", th: "เสริมอำนาจ", excelText: "Empower (เสริมอำนาจ)",
    description: "มอบอำนาจการตัดสินใจให้ผู้มีส่วนได้ส่วนเสีย",
    example: "ให้คณะกรรมการ/เครือข่ายตัดสินใจและบริหารจัดการเอง โดย กยท. สนับสนุน",
  },
];

export function engagementFromExcel(text: string | null | undefined): EngagementKey | null {
  if (!text) return null;
  const t = text.trim().toLowerCase();
  return ENGAGEMENT_LEVELS.find((e) => e.excelText.toLowerCase() === t || t.startsWith(e.key))?.key ?? null;
}

export function engagementToExcel(key: EngagementKey | null | undefined): string {
  return ENGAGEMENT_LEVELS.find((e) => e.key === key)?.excelText ?? "";
}

export const STATUS_LABELS = {
  draft: { label: "ฉบับร่าง", tone: "gray" },
  submitted: { label: "รอตรวจสอบ", tone: "blue" },
  returned: { label: "ส่งกลับแก้ไข", tone: "orange" },
  approved: { label: "อนุมัติแล้ว", tone: "green" },
} as const;

export const ROLE_LABELS = {
  admin: "ผู้ดูแลระบบ",
  reviewer: "ผู้บริหาร / ผู้ตรวจสอบ",
  dept_user: "ผู้ใช้งานส่วนงาน",
} as const;
