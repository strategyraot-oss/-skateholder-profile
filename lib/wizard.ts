import type { EngagementKey } from "./domain/reference";
import type { Stakeholder, StakeholderIssue } from "./types";

export type WizardIssue = {
  id: string;
  issue_text: string;
  interest: number | null;
  influence: number | null;
  impact_org: number | null;
  impact_sh: number | null;
  engagement_level: EngagementKey | null;
  channel: string;
  frequency: string;
  responsible_unit: string;
  constraints: string;
  remark: string;
};

export type WizardState = {
  id?: string;
  fiscal_year_id?: string;
  department_id: string | null;
  group_id: string | null;
  subgroup_id: string | null;
  other_text: string;
  name: string;
  type_status: string;
  address: string;
  business_relation: string;
  coordinator: string;
  coordinator_contact: string;
  decision_maker: string;
  decision_maker_contact: string;
  objective: string;
  issues: WizardIssue[];
};

export const BASIC_FIELDS = [
  "type_status", "address", "business_relation", "coordinator",
  "coordinator_contact", "decision_maker", "decision_maker_contact",
] as const;

export function newIssue(partial: Partial<WizardIssue> = {}): WizardIssue {
  return {
    id: crypto.randomUUID(),
    issue_text: "",
    interest: null,
    influence: null,
    impact_org: null,
    impact_sh: null,
    engagement_level: null,
    channel: "",
    frequency: "",
    responsible_unit: "",
    constraints: "",
    remark: "",
    ...partial,
  };
}

export function emptyState(departmentId: string | null): WizardState {
  return {
    department_id: departmentId,
    group_id: null,
    subgroup_id: null,
    other_text: "",
    name: "",
    type_status: "",
    address: "",
    business_relation: "",
    coordinator: "",
    coordinator_contact: "",
    decision_maker: "",
    decision_maker_contact: "",
    objective: "",
    issues: [newIssue()],
  };
}

export function stateFromDb(s: Stakeholder, issues: StakeholderIssue[]): WizardState {
  return {
    id: s.id,
    fiscal_year_id: s.fiscal_year_id,
    department_id: s.department_id,
    group_id: s.group_id,
    subgroup_id: s.subgroup_id,
    other_text: s.other_text ?? "",
    name: s.name ?? "",
    type_status: s.type_status ?? "",
    address: s.address ?? "",
    business_relation: s.business_relation ?? "",
    coordinator: s.coordinator ?? "",
    coordinator_contact: s.coordinator_contact ?? "",
    decision_maker: s.decision_maker ?? "",
    decision_maker_contact: s.decision_maker_contact ?? "",
    objective: s.objective ?? "",
    issues: issues.length
      ? [...issues].sort((a, b) => a.sort - b.sort).map((i) => ({
          id: i.id,
          issue_text: i.issue_text ?? "",
          interest: i.interest,
          influence: i.influence,
          impact_org: i.impact_org,
          impact_sh: i.impact_sh,
          engagement_level: i.engagement_level,
          channel: i.channel ?? "",
          frequency: i.frequency ?? "",
          responsible_unit: i.responsible_unit ?? "",
          constraints: i.constraints ?? "",
          remark: i.remark ?? "",
        }))
      : [newIssue()],
  };
}

export const STAKEHOLDER_COLUMNS =
  "id, fiscal_year_id, department_id, group_id, subgroup_id, other_text, name, type_status, address, business_relation, coordinator, coordinator_contact, decision_maker, decision_maker_contact, objective, status, updated_at";

export const ISSUE_COLUMNS =
  "id, stakeholder_id, sort, issue_text, interest, influence, priority_score, impact_org, impact_sh, issue_score, engagement_level, channel, frequency, responsible_unit, constraints, remark";
