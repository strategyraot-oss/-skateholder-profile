-- รายการ 1 แถวต่อผู้มีส่วนได้ส่วนเสีย, สถิติ Dashboard/รายงาน, ความคืบหน้าส่วนงาน, Storage สำหรับไฟล์นำเข้า

create or replace view public.v_stakeholder_list with (security_invoker = true) as
select
  stakeholder_id as id,
  fiscal_year_id, year_be,
  department_id, department_code, department_name,
  group_id, group_name, group_sort,
  subgroup_id, subgroup_name, subgroup_sort,
  other_text, name, status, updated_at,
  count(issue_id)::int as issue_count,
  max(priority_score) as max_priority,
  max(issue_score) as max_issue_score,
  (coalesce(bool_and(is_complete), false) and count(issue_id) > 0) as is_complete,
  count(*) filter (where not is_complete)::int as incomplete_rows,
  (array_agg(completeness order by is_complete, issue_sort nulls first))[1] as first_problem
from public.v_stakeholder_rows
group by stakeholder_id, fiscal_year_id, year_be, department_id, department_code, department_name,
         group_id, group_name, group_sort, subgroup_id, subgroup_name, subgroup_sort,
         other_text, name, status, updated_at;

create or replace function public.dashboard_stats(
  p_fiscal_year uuid default null, p_department uuid default null,
  p_group uuid default null, p_subgroup uuid default null)
returns json language sql stable security invoker set search_path = public as $$
with r as (
  select * from public.v_stakeholder_rows
  where (p_fiscal_year is null or fiscal_year_id = p_fiscal_year)
    and (p_department is null or department_id = p_department)
    and (p_group is null or group_id = p_group)
    and (p_subgroup is null or subgroup_id = p_subgroup)
)
select json_build_object(
  'kpi', (select json_build_object(
      'stakeholders', count(distinct stakeholder_id),
      'issues', count(issue_id),
      'rows', count(*),
      'complete_rows', count(*) filter (where is_complete),
      'incomplete_rows', count(*) filter (where not is_complete),
      'avg_priority', round(avg(priority_score)::numeric, 2),
      'avg_issue_score', round(avg(issue_score)::numeric, 2),
      'departments', count(distinct department_id),
      'draft', count(distinct stakeholder_id) filter (where status = 'draft'),
      'submitted', count(distinct stakeholder_id) filter (where status = 'submitted'),
      'returned', count(distinct stakeholder_id) filter (where status = 'returned'),
      'approved', count(distinct stakeholder_id) filter (where status = 'approved'),
      'high_priority', count(distinct stakeholder_id) filter (where priority_score >= 20))
    from r),
  'by_group', coalesce((select json_agg(x order by x.sort) from (
      select g.id, g.name, g.sort,
             count(r.stakeholder_id) as rows,
             count(distinct r.stakeholder_id) as stakeholders,
             round(avg(r.priority_score)::numeric, 2) as avg_priority,
             round(avg(r.issue_score)::numeric, 2) as avg_issue_score,
             count(r.stakeholder_id) filter (where not r.is_complete) as incomplete,
             count(distinct r.department_id) as departments
      from public.stakeholder_groups g
      left join r on r.group_id = g.id
      group by g.id, g.name, g.sort) x), '[]'::json),
  'by_subgroup', coalesce((select json_agg(x order by x.group_sort, x.sort) from (
      select sg.id, sg.name, sg.sort, g.name as group_name, g.sort as group_sort,
             count(r.stakeholder_id) as rows,
             count(distinct r.stakeholder_id) as stakeholders,
             round(avg(r.priority_score)::numeric, 2) as avg_priority,
             count(r.stakeholder_id) filter (where not r.is_complete) as incomplete
      from public.stakeholder_subgroups sg
      join public.stakeholder_groups g on g.id = sg.group_id
      left join r on r.subgroup_id = sg.id
      where p_group is null or sg.group_id = p_group
      group by sg.id, sg.name, sg.sort, g.name, g.sort) x), '[]'::json),
  'by_department', coalesce((select json_agg(x order by x.stakeholders desc, x.code) from (
      select department_id as id, department_code as code, department_name as name,
             count(*) as rows,
             count(distinct stakeholder_id) as stakeholders,
             count(*) filter (where not is_complete) as incomplete
      from r group by department_id, department_code, department_name) x), '[]'::json),
  'by_engagement', coalesce((select json_agg(x order by x.ord) from (
      select e::text as level, array_position(enum_range(null::public.engagement_level), e) as ord,
             count(r.issue_id) as issues
      from unnest(enum_range(null::public.engagement_level)) e
      left join r on r.engagement_level = e
      group by e) x), '[]'::json),
  'matrix', coalesce((select json_agg(x) from (
      select interest, influence, count(*) as issues, count(distinct stakeholder_id) as stakeholders
      from r where interest is not null and influence is not null
      group by interest, influence) x), '[]'::json),
  'top_stakeholders', coalesce((select json_agg(x order by x.max_priority desc, x.name) from (
      select stakeholder_id as id, name, department_code, group_name, subgroup_name,
             max(priority_score) as max_priority, max(issue_score) as max_issue_score, count(issue_id) as issues
      from r where priority_score is not null
      group by stakeholder_id, name, department_code, group_name, subgroup_name
      order by max(priority_score) desc, name
      limit 10) x), '[]'::json),
  'top_issues', coalesce((select json_agg(x order by x.issue_score desc, x.priority_score desc nulls last) from (
      select stakeholder_id, issue_id, name, department_code, issue_text, issue_score, priority_score, engagement_level
      from r where issue_score is not null
      order by issue_score desc, priority_score desc nulls last
      limit 15) x), '[]'::json)
)
$$;

create or replace function public.department_progress(p_fiscal_year uuid default null)
returns table (
  id uuid, code text, name text, active boolean,
  total int, complete int, draft int, submitted int, returned int, approved int,
  last_update timestamptz)
language sql stable security invoker set search_path = public as $$
  select d.id, d.code, d.name, d.active,
         count(l.id)::int,
         count(l.id) filter (where l.is_complete)::int,
         count(l.id) filter (where l.status = 'draft')::int,
         count(l.id) filter (where l.status = 'submitted')::int,
         count(l.id) filter (where l.status = 'returned')::int,
         count(l.id) filter (where l.status = 'approved')::int,
         max(l.updated_at)
  from public.departments d
  left join public.v_stakeholder_list l
    on l.department_id = d.id and (p_fiscal_year is null or l.fiscal_year_id = p_fiscal_year)
  where public.can_view_dept(d.id)
  group by d.id, d.code, d.name, d.active
  order by d.code
$$;

grant execute on function public.dashboard_stats(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.department_progress(uuid) to authenticated;

-- Storage: เก็บไฟล์ Excel ต้นฉบับที่นำเข้า (โฟลเดอร์ตาม user id)
insert into storage.buckets (id, name, public)
values ('imports', 'imports', false)
on conflict (id) do nothing;

create policy imports_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'imports' and (storage.foldername(name))[1] = auth.uid()::text);
create policy imports_read on storage.objects for select to authenticated
  using (bucket_id = 'imports'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.auth_role() = 'admin'));

-- ชื่อผู้ดำเนินการในประวัติการตรวจสอบ (ผู้ใช้ส่วนงานอ่าน profiles ของผู้อื่นไม่ได้)
alter table public.review_actions add column if not exists actor_name text;

create or replace function public.tg_review_actor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select coalesce(full_name, email) into new.actor_name from public.profiles where id = new.actor;
  return new;
end $$;

create trigger review_actions_actor before insert on public.review_actions
  for each row execute function public.tg_review_actor();
