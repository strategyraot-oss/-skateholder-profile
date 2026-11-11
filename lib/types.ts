import type { EngagementKey } from "./domain/reference";

export type UserRole = "admin" | "reviewer" | "dept_user";
export type RecordStatus = "draft" | "submitted" | "returned" | "approved";

export type Department = { id: string; code: string; name: string; active: boolean };

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  department_id: string | null;
  active: boolean;
  department?: Pick<Department, "id" | "code" | "name"> | null;
};

export type FiscalYear = {
  id: string;
  year_be: number;
  start_date: string | null;
  end_date: string | null;
  is_open: boolean;
  is_current: boolean;
};

export type StakeholderGroup = { id: string; code: string; name: string; sort: number; is_other: boolean };
export type StakeholderSubgroup = {
  id: string;
  group_id: string;
  code: string | null;
  name: string;
  sort: number;
  is_other: boolean;
};

export type Stakeholder = {
  id: string;
  fiscal_year_id: string;
  department_id: string;
  group_id: string;
  subgroup_id: string | null;
  other_text: string | null;
  name: string;
  type_status: string | null;
  address: string | null;
  business_relation: string | null;
  coordinator: string | null;
  coordinator_contact: string | null;
  decision_maker: string | null;
  decision_maker_contact: string | null;
  objective: string | null;
  status: RecordStatus;
  updated_at: string;
};

export type StakeholderIssue = {
  id: string;
  stakeholder_id: string;
  sort: number;
  issue_text: string;
  interest: number | null;
  influence: number | null;
  priority_score: number | null;
  impact_org: number | null;
  impact_sh: number | null;
  issue_score: number | null;
  engagement_level: EngagementKey | null;
  channel: string | null;
  frequency: string | null;
  responsible_unit: string | null;
  constraints: string | null;
  remark: string | null;
};

export type DashboardKpis = {
  stakeholders: number;
  issues: number;
  complete_rows: number;
  incomplete_rows: number;
  avg_priority: number | null;
  avg_issue_score: number | null;
  departments: number;
  approved: number;
  submitted: number;
  returned: number;
  draft: number;
};
