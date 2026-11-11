-- ไฟล์รวมสำหรับติดตั้งครั้งแรก: คัดลอกทั้งไฟล์ไปวางใน Supabase > SQL Editor แล้วกด Run (สร้างจาก migrations/0001–0004 + seed.sql)

-- ===================== migrations/0001_schema.sql =====================
-- Stakeholder Profile Management System (กยท.) : schema
-- โครงสร้างอ้างอิงไฟล์ "Stakeholder Profile กยท. (แบบกรอกข้อมูลส่วนงาน).xlsx" คอลัมน์ A–AB

create extension if not exists pg_trgm with schema extensions;

create type public.user_role as enum ('admin', 'reviewer', 'dept_user');
create type public.record_status as enum ('draft', 'submitted', 'returned', 'approved');
create type public.engagement_level as enum ('inform', 'consult', 'involve', 'collaborate', 'empower');
create type public.review_action_type as enum ('submit', 'return', 'approve', 'comment');

-- ---------- ส่วนงาน / ผู้ใช้ ----------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,            -- เช่น ฝยศ.
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role public.user_role not null default 'dept_user',
  department_id uuid references public.departments(id),
  active boolean not null default false,  -- ผู้ดูแลระบบต้องเปิดใช้งานก่อน
  created_at timestamptz not null default now(),
  constraint active_dept_user_needs_department
    check (role <> 'dept_user' or active = false or department_id is not null)
);

create table public.reviewer_departments (
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  primary key (reviewer_id, department_id)
);

-- ---------- รอบปีงบประมาณ ----------
create table public.fiscal_years (
  id uuid primary key default gen_random_uuid(),
  year_be int not null unique check (year_be between 2500 and 2700),
  start_date date,
  end_date date,
  is_open boolean not null default false,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  check (start_date is null or end_date is null or end_date >= start_date)
);
create unique index fiscal_years_one_current on public.fiscal_years (is_current) where is_current;

-- ---------- กลุ่ม / กลุ่มย่อย (จากแท็บ "รายการ") ----------
create table public.stakeholder_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,             -- ข้อความตรงตาม Excel เช่น "4. ลูกค้า"
  sort int not null,
  is_other boolean not null default false
);

create table public.stakeholder_subgroups (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.stakeholder_groups(id),
  code text,
  name text not null,
  sort int not null,
  is_other boolean not null default false,
  unique (group_id, name),
  unique (id, group_id)
);

-- ---------- ผู้มีส่วนได้ส่วนเสีย (คอลัมน์ B–N) ----------
create table public.stakeholders (
  id uuid primary key default gen_random_uuid(),
  fiscal_year_id uuid not null references public.fiscal_years(id),
  department_id uuid not null references public.departments(id),     -- B
  group_id uuid not null references public.stakeholder_groups(id),    -- C
  subgroup_id uuid,                                                   -- D
  other_text text,                                                    -- E
  name text not null default '',                                      -- F
  name_norm text not null default '',
  type_status text,                                                   -- G
  address text,                                                       -- H
  business_relation text,                                             -- I
  coordinator text,                                                   -- J
  coordinator_contact text,                                           -- K
  decision_maker text,                                                -- L
  decision_maker_contact text,                                        -- M
  objective text,                                                     -- N
  status public.record_status not null default 'draft',
  created_by uuid references auth.users(id) default auth.uid(),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  -- กลุ่มย่อยต้องอยู่ในกลุ่มที่เลือก (กฎ "กลุ่มย่อยไม่ตรงกับกลุ่ม")
  foreign key (subgroup_id, group_id) references public.stakeholder_subgroups (id, group_id)
);

-- ---------- ประเด็นความต้องการ (คอลัมน์ O–AA) : One-to-Many ----------
create table public.stakeholder_issues (
  id uuid primary key default gen_random_uuid(),
  stakeholder_id uuid not null references public.stakeholders(id) on delete cascade,
  sort int not null default 0,
  issue_text text not null default '',                                        -- O
  interest int check (interest between 1 and 5),                              -- P
  influence int check (influence between 1 and 5),                            -- Q
  priority_score int generated always as (interest * influence) stored,       -- R
  impact_org int check (impact_org between 1 and 4),                          -- S
  impact_sh int check (impact_sh between 1 and 4),                            -- T
  issue_score int generated always as (impact_org * impact_sh) stored,        -- U
  engagement_level public.engagement_level,                                   -- V
  channel text,                                                               -- W
  frequency text,                                                             -- X
  responsible_unit text,                                                      -- Y
  constraints text,                                                           -- Z
  remark text,                                                                -- AA
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- การตรวจสอบ / ประวัติ ----------
create table public.review_actions (
  id uuid primary key default gen_random_uuid(),
  stakeholder_id uuid not null references public.stakeholders(id) on delete cascade,
  action public.review_action_type not null,
  comment text,
  actor uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid,
  action text not null,
  actor uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Indexes (รองรับ 10,000+ รายการ) ----------
create index stakeholders_fy_dept_idx on public.stakeholders (fiscal_year_id, department_id);
create index stakeholders_group_idx on public.stakeholders (group_id, subgroup_id);
create index stakeholders_status_idx on public.stakeholders (status);
create index stakeholders_name_trgm_idx on public.stakeholders using gin (name_norm extensions.gin_trgm_ops);
create index issues_stakeholder_idx on public.stakeholder_issues (stakeholder_id, sort);
create index review_actions_sh_idx on public.review_actions (stakeholder_id, created_at desc);
create index audit_logs_record_idx on public.audit_logs (table_name, record_id);

-- ===================== migrations/0002_security.sql =====================
-- Helper functions, triggers และ Row Level Security

-- ---------- Helpers ----------
create or replace function public.auth_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.auth_dept() returns uuid
language sql stable security definer set search_path = public as $$
  select department_id from public.profiles where id = auth.uid() and active
$$;

-- reviewer ที่ไม่มีรายการใน reviewer_departments = เห็นทุกส่วนงาน
create or replace function public.can_view_dept(p_dept uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.auth_role()
    when 'admin' then true
    when 'dept_user' then p_dept = public.auth_dept()
    when 'reviewer' then
      not exists (select 1 from public.reviewer_departments where reviewer_id = auth.uid())
      or exists (select 1 from public.reviewer_departments
                 where reviewer_id = auth.uid() and department_id = p_dept)
    else false
  end
$$;

-- รอบปีเปิดรับข้อมูล และอยู่ในช่วงวันที่กำหนด
create or replace function public.fiscal_year_writable(p_fy uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select is_open
       and current_date >= coalesce(start_date, current_date)
       and current_date <= coalesce(end_date, current_date)
    from public.fiscal_years where id = p_fy), false)
$$;

create or replace function public.can_edit_stakeholder(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.stakeholders s
    where s.id = p_id and (
      public.auth_role() = 'admin'
      or (public.auth_role() = 'dept_user'
          and s.department_id = public.auth_dept()
          and s.status in ('draft', 'returned')
          and public.fiscal_year_writable(s.fiscal_year_id))))
$$;

-- ---------- Triggers ----------
create or replace function public.tg_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if tg_table_name = 'stakeholders' then
    new.updated_by := auth.uid();
    new.name := btrim(coalesce(new.name, ''));
    new.name_norm := lower(regexp_replace(new.name, '[[:space:][:punct:]]+', '', 'g'));
  end if;
  return new;
end $$;

create trigger stakeholders_touch before insert or update on public.stakeholders
  for each row execute function public.tg_touch();
create trigger issues_touch before insert or update on public.stakeholder_issues
  for each row execute function public.tg_touch();

-- เปลี่ยนสถานะได้เฉพาะผ่าน RPC (submit/return/approve)
create or replace function public.tg_guard_status() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.status_rpc', true), '') <> 'on' then
    raise exception 'ไม่สามารถเปลี่ยนสถานะโดยตรงได้ กรุณาใช้ปุ่มส่ง/ส่งกลับ/อนุมัติ';
  end if;
  return new;
end $$;

create trigger stakeholders_guard_status before update on public.stakeholders
  for each row execute function public.tg_guard_status();

-- เมื่อแก้ไขประเด็น ให้ปรับเวลาแก้ไขล่าสุดของผู้มีส่วนได้ส่วนเสียด้วย
create or replace function public.tg_issue_touch_parent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.stakeholders set updated_at = now()
   where id = coalesce(new.stakeholder_id, old.stakeholder_id);
  return null;
end $$;

create trigger issues_touch_parent after insert or update or delete on public.stakeholder_issues
  for each row execute function public.tg_issue_touch_parent();

-- Audit log ทุกการสร้าง/แก้ไข/ลบ
create or replace function public.tg_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(old) - 'updated_at' - 'updated_by') = (to_jsonb(new) - 'updated_at' - 'updated_by') then
    return null;
  end if;
  insert into public.audit_logs (table_name, record_id, action, actor, old_data, new_data)
  values (
    tg_table_name,
    case when tg_op = 'DELETE' then old.id else new.id end,
    tg_op,
    auth.uid(),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end);
  return null;
end $$;

create trigger stakeholders_audit after insert or update or delete on public.stakeholders
  for each row execute function public.tg_audit();
create trigger issues_audit after insert or update or delete on public.stakeholder_issues
  for each row execute function public.tg_audit();
create trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function public.tg_audit();
create trigger fiscal_years_audit after insert or update or delete on public.fiscal_years
  for each row execute function public.tg_audit();

-- สร้าง profile อัตโนมัติเมื่อมีผู้ใช้ใหม่ (ยังไม่เปิดใช้งาน)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RLS ----------
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.reviewer_departments enable row level security;
alter table public.fiscal_years enable row level security;
alter table public.stakeholder_groups enable row level security;
alter table public.stakeholder_subgroups enable row level security;
alter table public.stakeholders enable row level security;
alter table public.stakeholder_issues enable row level security;
alter table public.review_actions enable row level security;
alter table public.audit_logs enable row level security;

-- ข้อมูลอ้างอิง: ทุกคนที่ล็อกอินอ่านได้ / admin แก้ไขได้
create policy ref_read on public.departments for select to authenticated using (true);
create policy ref_admin on public.departments for all to authenticated
  using (public.auth_role() = 'admin') with check (public.auth_role() = 'admin');
create policy ref_read on public.fiscal_years for select to authenticated using (true);
create policy ref_admin on public.fiscal_years for all to authenticated
  using (public.auth_role() = 'admin') with check (public.auth_role() = 'admin');
create policy ref_read on public.stakeholder_groups for select to authenticated using (true);
create policy ref_admin on public.stakeholder_groups for all to authenticated
  using (public.auth_role() = 'admin') with check (public.auth_role() = 'admin');
create policy ref_read on public.stakeholder_subgroups for select to authenticated using (true);
create policy ref_admin on public.stakeholder_subgroups for all to authenticated
  using (public.auth_role() = 'admin') with check (public.auth_role() = 'admin');

-- profiles: เห็นของตัวเอง, admin/reviewer เห็นทั้งหมด, admin เท่านั้นที่แก้ไขได้
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.auth_role() in ('admin', 'reviewer'));
create policy profiles_admin on public.profiles for all to authenticated
  using (public.auth_role() = 'admin') with check (public.auth_role() = 'admin');

create policy revdept_read on public.reviewer_departments for select to authenticated
  using (reviewer_id = auth.uid() or public.auth_role() = 'admin');
create policy revdept_admin on public.reviewer_departments for all to authenticated
  using (public.auth_role() = 'admin') with check (public.auth_role() = 'admin');

-- stakeholders
create policy sh_select on public.stakeholders for select to authenticated
  using (public.can_view_dept(department_id));
create policy sh_insert on public.stakeholders for insert to authenticated
  with check (
    public.auth_role() = 'admin'
    or (public.auth_role() = 'dept_user'
        and department_id = public.auth_dept()
        and status = 'draft'
        and public.fiscal_year_writable(fiscal_year_id)));
create policy sh_update on public.stakeholders for update to authenticated
  using (public.can_edit_stakeholder(id))
  with check (
    public.auth_role() = 'admin'
    or (department_id = public.auth_dept() and status in ('draft', 'returned')));
create policy sh_delete on public.stakeholders for delete to authenticated
  using (
    public.auth_role() = 'admin'
    or (public.auth_role() = 'dept_user' and department_id = public.auth_dept() and status = 'draft'));

-- stakeholder_issues (สิทธิ์ตามผู้มีส่วนได้ส่วนเสียที่เป็นเจ้าของ)
create policy iss_select on public.stakeholder_issues for select to authenticated
  using (exists (select 1 from public.stakeholders s where s.id = stakeholder_id));
create policy iss_insert on public.stakeholder_issues for insert to authenticated
  with check (public.can_edit_stakeholder(stakeholder_id));
create policy iss_update on public.stakeholder_issues for update to authenticated
  using (public.can_edit_stakeholder(stakeholder_id))
  with check (public.can_edit_stakeholder(stakeholder_id));
create policy iss_delete on public.stakeholder_issues for delete to authenticated
  using (public.can_edit_stakeholder(stakeholder_id));

-- review_actions: อ่านได้ตามสิทธิ์ข้อมูล, เขียนผ่าน RPC เท่านั้น
create policy ra_select on public.review_actions for select to authenticated
  using (exists (select 1 from public.stakeholders s where s.id = stakeholder_id));

-- audit_logs: admin เท่านั้น
create policy audit_admin on public.audit_logs for select to authenticated
  using (public.auth_role() = 'admin');

revoke all on all tables in schema public from anon;

-- ===================== migrations/0003_views_rpc.sql =====================
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

-- ===================== migrations/0004_reports_storage.sql =====================
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

-- ===================== seed.sql =====================
-- ข้อมูลอ้างอิงเท่านั้น: กลุ่ม/กลุ่มย่อยจากแท็บ "รายการ" ของไฟล์ต้นฉบับ (ห้ามใส่ข้อมูลตัวอย่างใน prod)
insert into public.stakeholder_groups (code, name, sort, is_other) values
  ('1', '1. ภาครัฐผู้กำกับนโยบายหรือประเมินผล', 1, false),
  ('2', '2. คณะกรรมการ', 2, false),
  ('3', '3. พันธมิตร', 3, false),
  ('4', '4. ลูกค้า', 4, false),
  ('5', '5. ชุมชน', 5, false),
  ('6', '6. พนักงาน', 6, false),
  ('7', '7. สื่อมวลชน', 7, false),
  ('8', '8. คู่เทียบ', 8, false),
  ('9', 'อื่น ๆ (โปรดระบุ)', 9, true)
on conflict (code) do nothing;

insert into public.stakeholder_subgroups (group_id, code, name, sort, is_other)
select g.id, v.code, v.name, v.sort, v.is_other
from (values
  ('1', '1.1',   '1.1 ภาครัฐผู้กำกับนโยบายหรือประเมินผล', 1, false),
  ('1', null,    'อื่น ๆ (โปรดระบุ)', 99, true),
  ('2', '2.1',   '2.1 คณะกรรมการ กยท.', 1, false),
  ('2', '2.2',   '2.2 คณะอนุกรรมการฯ ชุดต่าง ๆ ของ กยท.', 2, false),
  ('2', null,    'อื่น ๆ (โปรดระบุ)', 99, true),
  ('3', '3.1',   '3.1 ผู้ส่งมอบ/คู่ค้า', 1, false),
  ('3', '3.2',   '3.2 คู่ความร่วมมือ', 2, false),
  ('3', null,    'อื่น ๆ (โปรดระบุ)', 99, true),
  ('4', '4.1.1', '4.1.1 ลูกค้าส่งเสริม: เกษตรกรชาวสวนยาง', 1, false),
  ('4', '4.1.2', '4.1.2 ลูกค้าส่งเสริม: สถาบันเกษตรกรชาวสวนยาง', 2, false),
  ('4', '4.1.3', '4.1.3 ลูกค้าส่งเสริม: ผู้ประกอบกิจการยาง/โรงงานแปรรูปยางพารา', 3, false),
  ('4', '4.1.4', '4.1.4 ลูกค้าส่งเสริม: สมาคม สภาอุตสาหกรรม นักวิชาการ นักศึกษา', 4, false),
  ('4', '4.2.1', '4.2.1 ลูกค้าเชิงพาณิชย์: ผู้ประกอบการผลิตผลิตภัณฑ์ยาง', 5, false),
  ('4', '4.2.2', '4.2.2 ลูกค้าเชิงพาณิชย์: สถาบันเกษตรกรแปรรูปผลิตภัณฑ์ยาง', 6, false),
  ('4', '4.2.3', '4.2.3 ลูกค้าเชิงพาณิชย์: หน่วยงานภาครัฐ (กรมทางหลวง กรมชลประทาน)', 7, false),
  ('4', '4.2.4', '4.2.4 ลูกค้าเชิงพาณิชย์: บริษัทต่างประเทศ', 8, false),
  ('4', '4.2.5', '4.2.5 ลูกค้าเชิงพาณิชย์: ผู้ส่งออกยางพารา', 9, false),
  ('4', null,    'อื่น ๆ (โปรดระบุ)', 99, true),
  ('5', '5.1',   '5.1 ชุมชนรอบพื้นที่ปฏิบัติงาน กยท.', 1, false),
  ('5', null,    'อื่น ๆ (โปรดระบุ)', 99, true),
  ('6', '6.1',   '6.1 ผู้บริหาร พนักงาน พนักงานสัญญาจ้าง สหภาพแรงงาน', 1, false),
  ('6', '6.2',   '6.2 หน่วยงาน/คณะทำงานภายใน กยท.', 2, false),
  ('6', null,    'อื่น ๆ (โปรดระบุ)', 99, true),
  ('7', '7.1',   '7.1 สื่อสิ่งพิมพ์/วิทยุและโทรทัศน์', 1, false),
  ('7', '7.2',   '7.2 สื่อออนไลน์', 2, false),
  ('7', null,    'อื่น ๆ (โปรดระบุ)', 99, true),
  ('8', '8.1',   '8.1 คู่เทียบ', 1, false),
  ('8', null,    'อื่น ๆ (โปรดระบุ)', 99, true),
  ('9', null,    'อื่น ๆ (โปรดระบุ)', 99, true)
) as v(group_code, code, name, sort, is_other)
join public.stakeholder_groups g on g.code = v.group_code
on conflict (group_id, name) do nothing;
