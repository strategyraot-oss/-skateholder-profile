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
