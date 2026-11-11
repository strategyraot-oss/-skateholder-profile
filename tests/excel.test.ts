import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildWorkbook, parseWorkbook } from "@/lib/excel/workbook";
import { COLUMNS } from "@/lib/excel/layout";
import { resolveImport } from "@/lib/excel/mapping";
import { GROUPS, OTHER } from "@/lib/domain/reference";
import type { Department, StakeholderGroup, StakeholderSubgroup } from "@/lib/types";

const ORIGINAL = path.resolve(__dirname, "..", "Stakeholder Profile กยท. (แบบกรอกข้อมูลส่วนงาน).xlsx");

// ข้อมูลอ้างอิงจำลองจาก reference.ts (ไม่ต้องต่อฐานข้อมูล)
const groups: StakeholderGroup[] = GROUPS.map((g, i) => ({ id: `g${g.code}`, code: g.code, name: g.name, sort: i, is_other: g.name === OTHER }));
const subgroups: StakeholderSubgroup[] = GROUPS.flatMap((g) =>
  g.subgroups.map((s, i) => ({ id: `g${g.code}-s${i}`, group_id: `g${g.code}`, code: null, name: s, sort: i, is_other: s === OTHER })),
);
const departments: Department[] = [
  { id: "d1", code: "ฝยศ.", name: "ฝ่ายยุทธศาสตร์", active: true },
  { id: "d2", code: "กปผ.", name: "กองประเมินผล", active: true },
];

describe("ไฟล์ต้นฉบับ", () => {
  it.skipIf(!fs.existsSync(ORIGINAL))("หัวตารางทั้ง 28 คอลัมน์ตรงกับต้นฉบับ และแถวตัวอย่างที่ไม่มีชื่อไม่ถูกนับ", async () => {
    const res = await parseWorkbook(fs.readFileSync(ORIGINAL));
    expect(res.headerRow).toBe(3);
    expect(res.missingHeaders).toEqual([]);
    expect(res.headerOk).toBe(true);
    expect(res.rows).toHaveLength(0);
  });
});

describe("ส่งออก → นำเข้า (round-trip)", () => {
  it("คงค่าทุกคอลัมน์และคะแนนรวม", async () => {
    const rows = [
      {
        department: "ฝยศ.", group: "1. ภาครัฐผู้กำกับนโยบายหรือประเมินผล", subgroup: "1.1 ภาครัฐผู้กำกับนโยบายหรือประเมินผล",
        otherText: null, name: "กระทรวงเกษตรและสหกรณ์", typeStatus: "หน่วยงานภาครัฐ", address: "กรุงเทพฯ",
        businessRelation: "กำกับดูแล", coordinator: "ผู้ประสาน", coordinatorContact: "02-000-0000", decisionMaker: "ปลัดกระทรวง",
        decisionMakerContact: "อีเมล", objective: "รายงานผล", issueText: "ประเด็นที่ 1", interest: 5, influence: 5, priority: 25,
        impactOrg: 4, impactSh: 4, issueScore: 16, engagement: "Collaborate (ร่วมมือ)", channel: "หนังสือราชการ",
        frequency: "รายไตรมาส", responsibleUnit: "ฝยศ.", constraints: null, remark: "หมายเหตุ", status: "ครบถ้วน",
      },
      {
        department: "ฝยศ.", group: "1. ภาครัฐผู้กำกับนโยบายหรือประเมินผล", subgroup: "1.1 ภาครัฐผู้กำกับนโยบายหรือประเมินผล",
        otherText: null, name: "กระทรวงเกษตรและสหกรณ์", objective: "รายงานผล", issueText: "ประเด็นที่ 2",
        interest: 3, influence: 2, priority: 6, impactOrg: 3, impactSh: 4, issueScore: 12, engagement: "Inform (แจ้งให้ทราบ)",
        responsibleUnit: "ฝยศ.", status: "ครบถ้วน",
      },
    ];
    const buf = await buildWorkbook(rows);
    const parsed = await parseWorkbook(buf);
    expect(parsed.headerRow).toBe(3);
    expect(parsed.missingHeaders).toEqual([]);
    expect(parsed.rows).toHaveLength(2);
    const r = parsed.rows[0];
    for (const c of COLUMNS) {
      if (c.key === "seq") continue;
      const expected = (rows[0] as Record<string, unknown>)[c.key] ?? null;
      expect([c.col, r[c.key as keyof typeof r] ?? null]).toEqual([c.col, expected]);
    }
    expect(parsed.rows[1].priority).toBe(6);
    expect(parsed.rows[1].issueScore).toBe(12);

    // รวม 2 แถวที่เป็นรายเดียวกันเป็น 1 ราย 2 ประเด็น
    const { preview, stakeholders } = resolveImport(parsed.rows, { departments, groups, subgroups });
    expect(preview.every((p) => p.errors.length === 0 && p.status === "ครบถ้วน")).toBe(true);
    expect(stakeholders).toHaveLength(1);
    expect(stakeholders[0].issues.map((i) => [i.interest, i.influence, i.engagement_level])).toEqual([
      [5, 5, "collaborate"],
      [3, 2, "inform"],
    ]);
  });
});

describe("resolveImport", () => {
  const base = { rowNumber: 4, department: "ฝยศ.", group: "4. ลูกค้า", subgroup: "4.1.1 ลูกค้าส่งเสริม: เกษตรกรชาวสวนยาง", name: "เกษตรกร ก." };

  it("กลุ่มย่อยไม่ตรงกลุ่ม และส่วนงานที่ไม่มีในระบบ → นำเข้าไม่ได้", () => {
    const { preview, stakeholders } = resolveImport(
      [{ ...base, subgroup: "8.1 คู่เทียบ" }, { ...base, rowNumber: 5, department: "ไม่มีจริง" }],
      { departments, groups, subgroups },
    );
    expect(preview[0].errors.join()).toContain("ไม่ตรงกับกลุ่ม");
    expect(preview[1].errors.join()).toContain("ไม่พบส่วนงาน");
    expect(stakeholders).toHaveLength(0);
  });

  it("ผู้ใช้ส่วนงาน: บังคับใช้ส่วนงานของตนเอง และคะแนนนอกช่วงถูกเว้นว่างพร้อมคำเตือน", () => {
    const { preview, stakeholders } = resolveImport(
      [{ ...base, department: "อื่น", interest: 9, impactOrg: 5 }],
      { departments, groups, subgroups, forcedDepartment: departments[1] },
    );
    expect(stakeholders[0].department_id).toBe("d2");
    expect(stakeholders[0].issues[0].interest).toBeNull();
    expect(stakeholders[0].issues[0].impact_org).toBeNull();
    expect(preview[0].warnings.length).toBe(3);
    expect(preview[0].status).toBe("กรอกข้อมูลบังคับยังไม่ครบ");
  });

  it("ยอมรับชื่อกลุ่มที่ไม่มีเลขนำหน้า", () => {
    const { stakeholders } = resolveImport([{ ...base, group: "ลูกค้า" }], { departments, groups, subgroups });
    expect(stakeholders[0].group_id).toBe("g4");
  });
});
