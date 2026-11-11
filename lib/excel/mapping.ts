import { engagementFromExcel, engagementToExcel, type EngagementKey } from "../domain/reference";
import { excelStatus } from "../domain/completeness";
import type { Department, StakeholderGroup, StakeholderSubgroup } from "../types";
import type { ParsedRow } from "./workbook";
import type { SheetRow } from "./layout";

/** แถวจาก view v_stakeholder_rows → แถว Excel */
export type ViewRow = {
  department_code: string; group_name: string; subgroup_name: string | null; other_text: string | null; name: string;
  type_status: string | null; address: string | null; business_relation: string | null; coordinator: string | null;
  coordinator_contact: string | null; decision_maker: string | null; decision_maker_contact: string | null;
  objective: string | null; issue_text: string | null; interest: number | null; influence: number | null;
  priority_score: number | null; impact_org: number | null; impact_sh: number | null; issue_score: number | null;
  engagement_level: EngagementKey | null; channel: string | null; frequency: string | null; responsible_unit: string | null;
  constraints: string | null; remark: string | null; completeness: string;
};

export function viewRowToSheet(r: ViewRow): SheetRow {
  return {
    department: r.department_code, group: r.group_name, subgroup: r.subgroup_name, otherText: r.other_text, name: r.name,
    typeStatus: r.type_status, address: r.address, businessRelation: r.business_relation, coordinator: r.coordinator,
    coordinatorContact: r.coordinator_contact, decisionMaker: r.decision_maker, decisionMakerContact: r.decision_maker_contact,
    objective: r.objective, issueText: r.issue_text, interest: r.interest, influence: r.influence, priority: r.priority_score,
    impactOrg: r.impact_org, impactSh: r.impact_sh, issueScore: r.issue_score, engagement: engagementToExcel(r.engagement_level) || null,
    channel: r.channel, frequency: r.frequency, responsibleUnit: r.responsible_unit, constraints: r.constraints, remark: r.remark,
    status: r.completeness,
  };
}

const norm = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const bare = (s: unknown) => norm(s).replace(/^[\d.]+\s*/, "").toLowerCase();
const str = (v: unknown) => (v == null || norm(v) === "" ? null : norm(v));

export type ResolvedIssue = {
  issue_text: string; interest: number | null; influence: number | null; impact_org: number | null; impact_sh: number | null;
  engagement_level: EngagementKey | null; channel: string | null; frequency: string | null; responsible_unit: string | null;
  constraints: string | null; remark: string | null;
};
export type ResolvedStakeholder = {
  department_id: string; group_id: string; subgroup_id: string | null; other_text: string | null; name: string;
  type_status: string | null; address: string | null; business_relation: string | null; coordinator: string | null;
  coordinator_contact: string | null; decision_maker: string | null; decision_maker_contact: string | null; objective: string | null;
  issues: ResolvedIssue[]; rows: number[];
};
export type PreviewRow = {
  row: number; name: string; department: string; group: string; subgroup: string; status: string;
  errors: string[]; warnings: string[];
};

type Ctx = {
  departments: Department[]; groups: StakeholderGroup[]; subgroups: StakeholderSubgroup[];
  /** ผู้ใช้ส่วนงาน: บังคับใช้ส่วนงานของตนเอง */
  forcedDepartment?: Department | null;
};

function scoreOf(v: unknown, max: number, label: string, warnings: string[]): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (Number.isInteger(n) && n >= 1 && n <= max) return n;
  warnings.push(`${label} ต้องเป็น 1–${max} (พบ “${v}”) จึงเว้นว่างไว้`);
  return null;
}

/** แปลงแถว Excel เป็นรายการผู้มีส่วนได้ส่วนเสีย (จัดกลุ่มแถวที่เป็นรายเดียวกันเป็นหลายประเด็น) */
export function resolveImport(rows: ParsedRow[], ctx: Ctx): { preview: PreviewRow[]; stakeholders: ResolvedStakeholder[] } {
  const preview: PreviewRow[] = [];
  const byKey = new Map<string, ResolvedStakeholder>();

  for (const r of rows) {
    const errors: string[] = [];
    const warnings: string[] = [];

    let dept: Department | undefined | null;
    if (ctx.forcedDepartment) {
      dept = ctx.forcedDepartment;
      const b = norm(r.department).toLowerCase();
      if (b && b !== dept.code.toLowerCase() && b !== dept.name.toLowerCase())
        warnings.push(`ส่วนงาน “${norm(r.department)}” ไม่ตรงกับบัญชีของท่าน ระบบใช้ ${dept.code}`);
    } else {
      const b = norm(r.department).toLowerCase();
      dept = ctx.departments.find((d) => d.code.toLowerCase() === b || d.name.toLowerCase() === b);
      if (!b) errors.push("ไม่ได้ระบุส่วนงานผู้กรอก (คอลัมน์ B)");
      else if (!dept) errors.push(`ไม่พบส่วนงาน “${norm(r.department)}” ในระบบ`);
    }

    const g = ctx.groups.find((x) => norm(x.name) === norm(r.group)) ?? ctx.groups.find((x) => bare(x.name) === bare(r.group) && bare(r.group) !== "");
    if (!norm(r.group)) errors.push("ไม่ได้เลือกกลุ่ม (คอลัมน์ C)");
    else if (!g) errors.push(`ไม่พบกลุ่ม “${norm(r.group)}”`);

    let sg: StakeholderSubgroup | undefined;
    if (g && norm(r.subgroup)) {
      const inGroup = ctx.subgroups.filter((x) => x.group_id === g.id);
      sg = inGroup.find((x) => norm(x.name) === norm(r.subgroup)) ?? inGroup.find((x) => bare(x.name) === bare(r.subgroup));
      if (!sg) errors.push(`กลุ่มย่อย “${norm(r.subgroup)}” ไม่ตรงกับกลุ่ม`);
    }

    const engText = str(r.engagement);
    const engagement = engagementFromExcel(engText);
    if (engText && !engagement) warnings.push(`ไม่รู้จักระดับความสัมพันธ์ “${engText}” จึงเว้นว่างไว้`);

    const issue: ResolvedIssue = {
      issue_text: norm(r.issueText),
      interest: scoreOf(r.interest, 5, "ระดับความสนใจ", warnings),
      influence: scoreOf(r.influence, 5, "ระดับอิทธิพล", warnings),
      impact_org: scoreOf(r.impactOrg, 4, "ผลกระทบต่อองค์กร", warnings),
      impact_sh: scoreOf(r.impactSh, 4, "ผลกระทบต่อผู้มีส่วนได้ส่วนเสีย", warnings),
      engagement_level: engagement,
      channel: str(r.channel), frequency: str(r.frequency), responsible_unit: str(r.responsibleUnit),
      constraints: str(r.constraints), remark: str(r.remark),
    };

    const status = excelStatus({
      department: dept?.code ?? "", group: g?.name ?? "", subgroup: sg?.name ?? "", otherText: str(r.otherText),
      name: norm(r.name), issueText: issue.issue_text, engagementLevel: issue.engagement_level, responsibleUnit: issue.responsible_unit,
      interest: issue.interest, influence: issue.influence, impactOrg: issue.impact_org, impactSh: issue.impact_sh,
    });

    preview.push({
      row: r.rowNumber, name: norm(r.name), department: dept?.code ?? norm(r.department), group: g?.name ?? norm(r.group),
      subgroup: sg?.name ?? norm(r.subgroup), status: errors.length ? "นำเข้าไม่ได้" : status, errors, warnings,
    });
    if (errors.length || !dept || !g) continue;

    const s: Omit<ResolvedStakeholder, "issues" | "rows"> = {
      department_id: dept.id, group_id: g.id, subgroup_id: sg?.id ?? null, other_text: str(r.otherText), name: norm(r.name),
      type_status: str(r.typeStatus), address: str(r.address), business_relation: str(r.businessRelation),
      coordinator: str(r.coordinator), coordinator_contact: str(r.coordinatorContact), decision_maker: str(r.decisionMaker),
      decision_maker_contact: str(r.decisionMakerContact), objective: str(r.objective),
    };
    const key = [s.department_id, s.group_id, s.subgroup_id, s.other_text, s.name.toLowerCase(), s.objective].join("|");
    const ex = byKey.get(key);
    if (ex) { ex.issues.push(issue); ex.rows.push(r.rowNumber); }
    else byKey.set(key, { ...s, issues: [issue], rows: [r.rowNumber] });
  }
  return { preview, stakeholders: [...byKey.values()] };
}
