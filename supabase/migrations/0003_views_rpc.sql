-- Views และ RPC

-- แถวข้อมูลแบบเดียวกับแท็บ "แบบกรอกข้อมูล" (1 แถว = 1 ราย × 1 ประเด็น)
-- completeness ใช้ลำดับตรวจเดียวกับ lib/domain/completeness.ts (อ้างอิงคอลัมน์ AB ใน Excel)
create or replace view public.v_stakeholder_rows with (security_invoker = true) as
select
  s.id as stakeholder_id,
  i.id as issue_id,
  s.fiscal_year_id,
  fy.year_be,
  s.department_id,
  d.code as department_code,
  d.name as department_name,
  s.group_id,
  g.name as group_name,
  g.sort as group_sort,
  s.subgroup_id,
  sg.name as subgroup_name,
  sg.sort as subgroup_sort,
  s.other_text,
  s.name,
  s.type_status,
  s.address,
  s.business_relation,
  s.coordinator,
  s.coordinator_contact,
  s.decision_maker,
  s.decision_maker_contact,
  s.objective,
  i.sort as issue_sort,
  i.issue_text,
  i.interest,
  i.influence,
  i.priority_score,
  i.impact_org,
  i.impact_sh,
  i.issue_score,
  i.engagement_level,
  i.channel,
  i.frequency,
  i.responsible_unit,
  i.constraints,
  i.remark,
  s.status,
  s.updated_at,
  c.completeness,
  c.completeness = 'ครบถ้วน' as is_complete
from public.stakeholders s
join public.fiscal_years fy on fy.id = s.fiscal_year_id
join public.departments d on d.id = s.department_id
join public.stakeholder_groups g on g.id = s.group_id
left join public.stakeholder_subgroups sg on sg.id = s.subgroup_id
left join public.stakeholder_issues i on i.stakeholder_id = s.id
cross join lateral (
  select case
    when s.subgroup_id is null then 'โปรดเลือกกลุ่มย่อย'
    when (g.is_other or coalesce(sg.is_other, false)) and coalesce(btrim(s.other_text), '') = ''
      then 'โปรดระบุกลุ่มอื่น ๆ ในคอลัมน์ E'
    when s.name = '' then 'โปรดระบุชื่อผู้มีส่วนได้ส่วนเสีย'
    when i.id is null
      or coalesce(btrim(i.issue_text), '') = ''
      or i.engagement_level is null
      or coalesce(btrim(i.responsible_unit), '') = ''
      then 'กรอกข้อมูลบังคับยังไม่ครบ'
    when i.interest is null or i.influence is null or i.impact_org is null or i.impact_sh is null
      then 'ยังให้คะแนนไม่ครบ'
    else 'ครบถ้วน'
  end as completeness
) c;

-- ---------- Workflow ----------
create or replace function public._set_status(p_id uuid, p_status public.record_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.status_rpc', 'on', true);
  update public.stakeholders
     set status = p_status,
         submitted_at = case when p_status = 'submitted' then now() else submitted_at end,
         approved_at = case when p_status = 'approved' then now() else null end
   where id = p_id;
  perform set_config('app.status_rpc', 'off', true);
end $$;
revoke execute on function public._set_status(uuid, public.record_status) from public, anon, authenticated;

create or replace function public.submit_stakeholder(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  s public.stakeholders;
  v_issues int;
  v_ok boolean;
begin
  select * into s from public.stakeholders where id = p_id for update;
  if not found then raise exception 'ไม่พบข้อมูลรายการนี้'; end if;
  if not (public.auth_role() = 'admin'
          or (public.auth_role() = 'dept_user' and s.department_id = public.auth_dept())) then
    raise exception 'ท่านไม่มีสิทธิ์ส่งข้อมูลรายการนี้';
  end if;
  if s.status not in ('draft', 'returned') then
    raise exception 'รายการนี้ส่งตรวจสอบแล้ว';
  end if;
  if public.auth_role() <> 'admin' and not public.fiscal_year_writable(s.fiscal_year_id) then
    raise exception 'ระบบปิดรับข้อมูลของรอบปีงบประมาณนี้แล้ว';
  end if;
  select count(issue_id), coalesce(bool_and(is_complete), false)
    into v_issues, v_ok
    from public.v_stakeholder_rows where stakeholder_id = p_id;
  if v_issues = 0 or not v_ok then
    raise exception 'ข้อมูลยังไม่ครบถ้วน กรุณาตรวจสอบก่อนส่ง';
  end if;
  perform public._set_status(p_id, 'submitted');
  insert into public.review_actions (stakeholder_id, action, actor) values (p_id, 'submit', auth.uid());
end $$;

create or replace function public.return_stakeholder(p_id uuid, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare s public.stakeholders;
begin
  select * into s from public.stakeholders where id = p_id for update;
  if not found then raise exception 'ไม่พบข้อมูลรายการนี้'; end if;
  if public.auth_role() not in ('admin', 'reviewer') or not public.can_view_dept(s.department_id) then
    raise exception 'ท่านไม่มีสิทธิ์ตรวจสอบรายการนี้';
  end if;
  if coalesce(btrim(p_comment), '') = '' then
    raise exception 'กรุณาระบุข้อเสนอแนะก่อนส่งกลับแก้ไข';
  end if;
  if not (s.status = 'submitted' or (s.status = 'approved' and public.auth_role() = 'admin')) then
    raise exception 'ส่งกลับได้เฉพาะรายการที่ส่งตรวจสอบแล้ว';
  end if;
  perform public._set_status(p_id, 'returned');
  insert into public.review_actions (stakeholder_id, action, comment, actor)
  values (p_id, 'return', p_comment, auth.uid());
end $$;

create or replace function public.approve_stakeholder(p_id uuid, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare s public.stakeholders;
begin
  select * into s from public.stakeholders where id = p_id for update;
  if not found then raise exception 'ไม่พบข้อมูลรายการนี้'; end if;
  if public.auth_role() not in ('admin', 'reviewer') or not public.can_view_dept(s.department_id) then
    raise exception 'ท่านไม่มีสิทธิ์อนุมัติรายการนี้';
  end if;
  if s.status <> 'submitted' then
    raise exception 'อนุมัติได้เฉพาะรายการที่ส่งตรวจสอบแล้ว';
  end if;
  perform public._set_status(p_id, 'approved');
  insert into public.review_actions (stakeholder_id, action, comment, actor)
  values (p_id, 'approve', nullif(btrim(p_comment), ''), auth.uid());
end $$;

create or replace function public.comment_stakeholder(p_id uuid, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare s public.stakeholders;
begin
  select * into s from public.stakeholders where id = p_id;
  if not found or not public.can_view_dept(s.department_id) then
    raise exception 'ท่านไม่มีสิทธิ์แสดงความคิดเห็นในรายการนี้';
  end if;
  if coalesce(btrim(p_comment), '') = '' then raise exception 'กรุณาพิมพ์ความคิดเห็น'; end if;
  insert into public.review_actions (stakeholder_id, action, comment, actor)
  values (p_id, 'comment', p_comment, auth.uid());
end $$;

-- ---------- Duplicate Detection (แจ้งเตือนเท่านั้น ไม่บล็อก) ----------
create or replace function public.find_similar_stakeholders(
  p_name text, p_fiscal_year uuid, p_exclude uuid default null)
returns table (id uuid, name text, department_name text, subgroup_name text, similarity real)
language sql stable security invoker set search_path = public, extensions as $$
  with q as (select lower(regexp_replace(btrim(coalesce(p_name, '')), '[[:space:][:punct:]]+', '', 'g')) as n)
  select s.id, s.name, d.name, sg.name, extensions.similarity(s.name_norm, q.n)
  from public.stakeholders s
  cross join q
  join public.departments d on d.id = s.department_id
  left join public.stakeholder_subgroups sg on sg.id = s.subgroup_id
  where length(q.n) >= 3
    and s.fiscal_year_id = p_fiscal_year
    and (p_exclude is null or s.id <> p_exclude)
    and (s.name_norm = q.n or extensions.similarity(s.name_norm, q.n) >= 0.4)
  order by 5 desc
  limit 5
$$;

-- ---------- Dashboard KPI ----------
create or replace function public.dashboard_kpis(
  p_fiscal_year uuid default null, p_department uuid default null,
  p_group uuid default null, p_subgroup uuid default null)
returns json language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'stakeholders', count(distinct stakeholder_id),
    'issues', count(issue_id),
    'complete_rows', count(*) filter (where is_complete),
    'incomplete_rows', count(*) filter (where not is_complete),
    'avg_priority', round(avg(priority_score)::numeric, 2),
    'avg_issue_score', round(avg(issue_score)::numeric, 2),
    'departments', count(distinct department_id),
    'approved', count(distinct stakeholder_id) filter (where status = 'approved'),
    'submitted', count(distinct stakeholder_id) filter (where status = 'submitted'),
    'returned', count(distinct stakeholder_id) filter (where status = 'returned'),
    'draft', count(distinct stakeholder_id) filter (where status = 'draft'))
  from public.v_stakeholder_rows
  where (p_fiscal_year is null or fiscal_year_id = p_fiscal_year)
    and (p_department is null or department_id = p_department)
    and (p_group is null or group_id = p_group)
    and (p_subgroup is null or subgroup_id = p_subgroup)
$$;

grant execute on function public.submit_stakeholder(uuid) to authenticated;
grant execute on function public.return_stakeholder(uuid, text) to authenticated;
grant execute on function public.approve_stakeholder(uuid, text) to authenticated;
grant execute on function public.comment_stakeholder(uuid, text) to authenticated;
grant execute on function public.find_similar_stakeholders(text, uuid, uuid) to authenticated;
grant execute on function public.dashboard_kpis(uuid, uuid, uuid, uuid) to authenticated;
