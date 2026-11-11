import { describe, expect, it } from "vitest";
import { excelStatus, isComplete, listProblems, type RowInput } from "@/lib/domain/completeness";
import { GROUPS, OTHER } from "@/lib/domain/reference";

const full: RowInput = {
  department: "ฝยศ.",
  group: "1. ภาครัฐผู้กำกับนโยบายหรือประเมินผล",
  subgroup: "1.1 ภาครัฐผู้กำกับนโยบายหรือประเมินผล",
  name: "กระทรวงเกษตรและสหกรณ์",
  issueText: "คาดหวังให้ กยท. ดำเนินงานบรรลุเป้าหมายยุทธศาสตร์ชาติ",
  engagementLevel: "collaborate",
  responsibleUnit: "ฝยศ.",
  interest: 5,
  influence: 5,
  impactOrg: 4,
  impactSh: 4,
};

describe("สถานะความครบถ้วน (คอลัมน์ AB)", () => {
  it("ตัวอย่างในแท็บคำชี้แจง → ครบถ้วน", () => {
    expect(excelStatus(full)).toBe("ครบถ้วน");
    expect(isComplete(full)).toBe(true);
  });

  it("ไม่มีชื่อ → แถวว่าง ('')", () => {
    expect(excelStatus({ ...full, name: "  " })).toBe("");
  });

  it.each<[Partial<RowInput>, string]>([
    [{ department: "" }, "โปรดระบุส่วนงานผู้กรอก"],
    [{ group: null }, "โปรดเลือกกลุ่ม"],
    [{ subgroup: "" }, "โปรดเลือกกลุ่มย่อย"],
    [{ subgroup: "8.1 คู่เทียบ" }, "กลุ่มย่อยไม่ตรงกับกลุ่ม"],
    [{ subgroup: OTHER }, "โปรดระบุกลุ่มอื่น ๆ ในคอลัมน์ E"],
    [{ issueText: "" }, "กรอกข้อมูลบังคับยังไม่ครบ"],
    [{ engagementLevel: null }, "กรอกข้อมูลบังคับยังไม่ครบ"],
    [{ responsibleUnit: " " }, "กรอกข้อมูลบังคับยังไม่ครบ"],
    [{ interest: null }, "ยังให้คะแนนไม่ครบ"],
    [{ impactSh: undefined }, "ยังให้คะแนนไม่ครบ"],
  ])("%o → %s", (patch, expected) => {
    expect(excelStatus({ ...full, ...patch })).toBe(expected);
  });

  it("ลำดับความสำคัญตาม Excel: ส่วนงานมาก่อนคะแนน", () => {
    expect(excelStatus({ ...full, department: "", interest: null })).toBe("โปรดระบุส่วนงานผู้กรอก");
  });

  it("เลือกอื่น ๆ และระบุแล้ว → ครบถ้วน", () => {
    expect(excelStatus({ ...full, group: OTHER, subgroup: OTHER, otherText: "องค์กรระหว่างประเทศ" })).toBe("ครบถ้วน");
  });

  it("listProblems คืนครบทุกปัญหาพร้อมขั้นตอน", () => {
    const p = listProblems({ ...full, issueText: "", interest: null, impactOrg: null });
    expect(p.map((x) => x.field)).toEqual(["issueText", "interest", "impactOrg"]);
    expect(p.map((x) => x.step)).toEqual([3, 4, 4]);
  });
});

describe("ข้อมูลอ้างอิงตรงกับไฟล์ต้นฉบับ", () => {
  it("9 กลุ่ม 29 กลุ่มย่อย และทุกกลุ่มมี อื่น ๆ", () => {
    expect(GROUPS).toHaveLength(9);
    expect(GROUPS.reduce((n, g) => n + g.subgroups.length, 0)).toBe(29);
    expect(GROUPS.every((g) => g.subgroups.includes(OTHER))).toBe(true);
  });
});
