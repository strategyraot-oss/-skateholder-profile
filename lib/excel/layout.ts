// โครงสร้างแท็บ "แบบกรอกข้อมูล" ของไฟล์ต้นฉบับ (หัวตารางแถว 3, ข้อมูลเริ่มแถว 4, คอลัมน์ A–AB)

export const SHEET_NAME = "แบบกรอกข้อมูล";
export const TITLE =
  "แบบกรอกข้อมูล Stakeholder Profile การยางแห่งประเทศไทย (1 แถว = ผู้มีส่วนได้ส่วนเสีย 1 ราย ต่อ 1 ประเด็นความต้องการ)  ·  ช่องที่มีเครื่องหมาย * ต้องกรอก  ·  คอลัมน์สีเทาคำนวณอัตโนมัติ ไม่ต้องกรอก";

export type ColKey =
  | "seq" | "department" | "group" | "subgroup" | "otherText" | "name" | "typeStatus" | "address" | "businessRelation"
  | "coordinator" | "coordinatorContact" | "decisionMaker" | "decisionMakerContact" | "objective" | "issueText"
  | "interest" | "influence" | "priority" | "impactOrg" | "impactSh" | "issueScore" | "engagement" | "channel"
  | "frequency" | "responsibleUnit" | "constraints" | "remark" | "status";

export const COLUMNS: { col: string; key: ColKey; header: string; width: number; computed?: boolean }[] = [
  { col: "A", key: "seq", header: "ลำดับ", width: 7, computed: true },
  { col: "B", key: "department", header: "ส่วนงานผู้กรอกข้อมูล *", width: 16 },
  { col: "C", key: "group", header: "กลุ่มผู้มีส่วนได้ส่วนเสีย *", width: 30 },
  { col: "D", key: "subgroup", header: "กลุ่มย่อย *\n(เลือกกลุ่มก่อน)", width: 40 },
  { col: "E", key: "otherText", header: "ระบุกลุ่ม/กลุ่มย่อย\n(กรณีเลือก อื่น ๆ)", width: 20 },
  { col: "F", key: "name", header: "ชื่อผู้มีส่วนได้ส่วนเสีย *\n(หน่วยงาน/องค์กร/บุคคล)", width: 32 },
  { col: "G", key: "typeStatus", header: "ประเภท/สถานะ", width: 18 },
  { col: "H", key: "address", header: "ที่อยู่/สถานที่ติดต่อ", width: 28 },
  { col: "I", key: "businessRelation", header: "รูปแบบความสัมพันธ์\nทางธุรกิจกับ กยท.", width: 22 },
  { col: "J", key: "coordinator", header: "ผู้ประสานงาน\n(ชื่อ-สกุล/ตำแหน่ง)", width: 24 },
  { col: "K", key: "coordinatorContact", header: "ช่องทางติดต่อผู้ประสานงาน\n(โทร/อีเมล/Line)", width: 24 },
  { col: "L", key: "decisionMaker", header: "ผู้มีอำนาจตัดสินใจ\n(ชื่อ-สกุล/ตำแหน่ง)", width: 24 },
  { col: "M", key: "decisionMakerContact", header: "ช่องทางติดต่อผู้มีอำนาจตัดสินใจ\n(โทร/อีเมล/Line)", width: 24 },
  { col: "N", key: "objective", header: "วัตถุประสงค์ในการสร้างความสัมพันธ์", width: 32 },
  { col: "O", key: "issueText", header: "ประเด็น/ความต้องการ/\nความคาดหวังที่สำคัญ *", width: 44 },
  { col: "P", key: "interest", header: "ระดับความสนใจ *\n(Interest 1-5)", width: 12 },
  { col: "Q", key: "influence", header: "ระดับอิทธิพล *\n(Influence 1-5)", width: 12 },
  { col: "R", key: "priority", header: "คะแนนรวม\nลำดับความสำคัญ\n(ความสนใจ × อิทธิพล)", width: 14, computed: true },
  { col: "S", key: "impactOrg", header: "ระดับผลกระทบ\nต่อองค์กร * (1-4)", width: 12 },
  { col: "T", key: "impactSh", header: "ระดับผลกระทบต่อ\nผู้มีส่วนได้ส่วนเสีย * (1-4)", width: 14 },
  { col: "U", key: "issueScore", header: "คะแนนรวม\nความสำคัญของประเด็น\n(ผลกระทบ × ผลกระทบ)", width: 14, computed: true },
  { col: "V", key: "engagement", header: "ระดับ/รูปแบบการสร้างความสัมพันธ์ *", width: 22 },
  { col: "W", key: "channel", header: "ช่องทาง/วิธีการสื่อสาร", width: 22 },
  { col: "X", key: "frequency", header: "ความถี่ในการสื่อสาร", width: 16 },
  { col: "Y", key: "responsibleUnit", header: "หน่วยงานภายในที่รับผิดชอบ *", width: 18 },
  { col: "Z", key: "constraints", header: "ข้อจำกัด/ความสามารถเฉพาะ\n(ภาษา วัฒนธรรม การสื่อสาร ฯลฯ)", width: 24 },
  { col: "AA", key: "remark", header: "หมายเหตุ", width: 18 },
  { col: "AB", key: "status", header: "สถานะความครบถ้วน", width: 24, computed: true },
];

export const SECTIONS: { from: string; to: string; label: string }[] = [
  { from: "C", to: "E", label: "การจำแนกกลุ่มผู้มีส่วนได้ส่วนเสีย" },
  { from: "F", to: "M", label: "ข้อมูลพื้นฐานและผู้ติดต่อ" },
  { from: "N", to: "O", label: "วัตถุประสงค์และความต้องการ" },
  { from: "P", to: "R", label: "ระดับความสำคัญของผู้มีส่วนได้ส่วนเสีย" },
  { from: "S", to: "U", label: "ระดับความสำคัญของประเด็นความต้องการ" },
  { from: "V", to: "Y", label: "การสร้างความสัมพันธ์" },
  { from: "Z", to: "AA", label: "ข้อมูลเพิ่มเติม" },
  { from: "AB", to: "AB", label: "ตรวจสอบ" },
];

export const normHeader = (s: string) => s.replace(/\s+/g, "");

export type SheetRow = Partial<Record<Exclude<ColKey, "seq">, string | number | null>>;
