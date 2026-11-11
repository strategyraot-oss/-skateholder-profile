import { createClient } from "./supabase/server";
import type { EngagementKey } from "./domain/reference";

export type Stats = {
  kpi: {
    stakeholders: number; issues: number; rows: number; complete_rows: number; incomplete_rows: number;
    avg_priority: number | null; avg_issue_score: number | null; departments: number;
    draft: number; submitted: number; returned: number; approved: number; high_priority: number;
  };
  by_group: { id: string; name: string; sort: number; rows: number; stakeholders: number; avg_priority: number | null; avg_issue_score: number | null; incomplete: number; departments: number }[];
  by_subgroup: { id: string; name: string; sort: number; group_name: string; group_sort: number; rows: number; stakeholders: number; avg_priority: number | null; incomplete: number }[];
  by_department: { id: string; code: string; name: string; rows: number; stakeholders: number; incomplete: number }[];
  by_engagement: { level: EngagementKey; ord: number; issues: number }[];
  matrix: { interest: number; influence: number; issues: number; stakeholders: number }[];
  top_stakeholders: { id: string; name: string; department_code: string; group_name: string; subgroup_name: string | null; max_priority: number; max_issue_score: number | null; issues: number }[];
  top_issues: { stakeholder_id: string; issue_id: string; name: string; department_code: string; issue_text: string; issue_score: number; priority_score: number | null; engagement_level: EngagementKey | null }[];
};

const EMPTY: Stats = {
  kpi: { stakeholders: 0, issues: 0, rows: 0, complete_rows: 0, incomplete_rows: 0, avg_priority: null, avg_issue_score: null, departments: 0, draft: 0, submitted: 0, returned: 0, approved: 0, high_priority: 0 },
  by_group: [], by_subgroup: [], by_department: [], by_engagement: [], matrix: [], top_stakeholders: [], top_issues: [],
};

export async function getStats(f: { fy: string | null; dept: string | null; group: string | null; subgroup: string | null }): Promise<Stats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_stats", {
    p_fiscal_year: f.fy, p_department: f.dept, p_group: f.group, p_subgroup: f.subgroup,
  });
  if (error || !data) return EMPTY;
  return { ...EMPTY, ...(data as Stats) };
}
