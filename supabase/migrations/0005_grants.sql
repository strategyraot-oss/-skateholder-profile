-- ให้สิทธิ์ระดับตารางแก่ผู้ใช้ที่เข้าสู่ระบบ (role authenticated)
-- โปรเจกต์ Supabase รุ่นใหม่ไม่ให้สิทธิ์นี้อัตโนมัติ — การเข้าถึงข้อมูลจริงยังถูกควบคุมด้วย RLS ทุกตาราง

grant usage on schema public to authenticated;

-- อ่านได้ทุกตารางและ view (แถวที่เห็นถูกกรองด้วย RLS)
grant select on all tables in schema public to authenticated;

-- เพิ่ม/แก้ไข/ลบ เฉพาะตารางที่มี policy รองรับ
-- (review_actions และ audit_logs เขียนได้ผ่านฟังก์ชัน/trigger ของระบบเท่านั้น)
grant insert, update, delete on
  public.departments,
  public.profiles,
  public.reviewer_departments,
  public.fiscal_years,
  public.stakeholder_groups,
  public.stakeholder_subgroups,
  public.stakeholders,
  public.stakeholder_issues
to authenticated;

-- ฟังก์ชันตรวจสิทธิ์ที่ RLS เรียกใช้ และฟังก์ชันที่หน้าเว็บเรียก
grant execute on function
  public.auth_role(),
  public.auth_dept(),
  public.can_view_dept(uuid),
  public.fiscal_year_writable(uuid),
  public.can_edit_stakeholder(uuid),
  public.submit_stakeholder(uuid),
  public.return_stakeholder(uuid, text),
  public.approve_stakeholder(uuid, text),
  public.comment_stakeholder(uuid, text),
  public.find_similar_stakeholders(text, uuid, uuid),
  public.dashboard_kpis(uuid, uuid, uuid, uuid),
  public.dashboard_stats(uuid, uuid, uuid, uuid),
  public.department_progress(uuid)
to authenticated;

-- ตารางที่สร้างในอนาคตให้อ่านได้ (ยังต้องมี RLS policy)
alter default privileges in schema public grant select on tables to authenticated;

-- ตรวจผล: ทุกช่องต้องเป็น true
select
  has_table_privilege('authenticated', 'public.profiles', 'select')            as profiles_select,
  has_table_privilege('authenticated', 'public.departments', 'select')         as departments_select,
  has_table_privilege('authenticated', 'public.stakeholders', 'insert')        as stakeholders_insert,
  has_table_privilege('authenticated', 'public.v_stakeholder_list', 'select')  as views_select,
  has_function_privilege('authenticated', 'public.auth_role()', 'execute')     as auth_role_execute;
