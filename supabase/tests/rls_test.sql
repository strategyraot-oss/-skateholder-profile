-- ทดสอบสิทธิ์การเข้าถึง (RLS), workflow และการคำนวณคะแนน
-- วิธีใช้: คัดลอกทั้งไฟล์ไปวางใน Supabase > SQL Editor แล้วกด Run
-- ผลลัพธ์จะแสดงเป็นข้อความ "ERROR: ผลทดสอบ RLS ..." โดยตั้งใจ เพื่อให้ยกเลิกข้อมูลทดสอบทั้งหมดอัตโนมัติ
-- (ไม่มีข้อมูลทดสอบค้างในระบบ จึงรันกับโปรเจกต์จริงได้อย่างปลอดภัย)

begin;

create function public._rls_rec(t text, ok boolean, d text default null) returns void
language sql as $$
  select set_config('rls.log',
    coalesce(current_setting('rls.log', true), '') || E'\n' || case when ok then '✔ ' else '✘ ' end || t ||
    case when ok or d is null then '' else ' → ' || d end, true);
$$;

-- ---------- ข้อมูลทดสอบ (ถูกยกเลิกท้ายสคริปต์) ----------
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('11111111-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-admin@test.invalid', '{}', now(), now()),
  ('11111111-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-dept-a@test.invalid', '{}', now(), now()),
  ('11111111-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-dept-b@test.invalid', '{}', now(), now()),
  ('11111111-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-reviewer-b@test.invalid', '{}', now(), now());

insert into public.departments (id, code, name) values
  ('22222222-0000-4000-8000-00000000000a', 'RLS-A', 'ส่วนงานทดสอบ A'),
  ('22222222-0000-4000-8000-00000000000b', 'RLS-B', 'ส่วนงานทดสอบ B');

update public.profiles set role = 'admin', active = true where id = '11111111-0000-4000-8000-00000000000a';
update public.profiles set role = 'dept_user', active = true, department_id = '22222222-0000-4000-8000-00000000000a' where id = '11111111-0000-4000-8000-00000000000b';
update public.profiles set role = 'dept_user', active = true, department_id = '22222222-0000-4000-8000-00000000000b' where id = '11111111-0000-4000-8000-00000000000c';
update public.profiles set role = 'reviewer', active = true where id = '11111111-0000-4000-8000-00000000000d';
insert into public.reviewer_departments values ('11111111-0000-4000-8000-00000000000d', '22222222-0000-4000-8000-00000000000b');

insert into public.fiscal_years (id, year_be, is_open) values ('33333333-0000-4000-8000-000000000001', 2699, true);

-- ================= ผู้ใช้ส่วนงาน A =================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-00000000000b","role":"authenticated"}', true);

do $$
declare
  v_g uuid := (select id from public.stakeholder_groups where code = '1');
  v_sg uuid := (select id from public.stakeholder_subgroups where code = '1.1');
  v_n int;
  v_ps int; v_is int;
begin
  begin
    insert into public.stakeholders (id, fiscal_year_id, department_id, group_id, subgroup_id, name)
    values ('44444444-0000-4000-8000-00000000000a', '33333333-0000-4000-8000-000000000001', '22222222-0000-4000-8000-00000000000a', v_g, v_sg, 'RLS ทดสอบ A');
    perform public._rls_rec('T01 ผู้ใช้ส่วนงานเพิ่มข้อมูลของส่วนงานตนเองได้', true);
  exception when others then perform public._rls_rec('T01 ผู้ใช้ส่วนงานเพิ่มข้อมูลของส่วนงานตนเองได้', false, sqlerrm); end;

  begin
    insert into public.stakeholders (fiscal_year_id, department_id, group_id, name)
    values ('33333333-0000-4000-8000-000000000001', '22222222-0000-4000-8000-00000000000b', v_g, 'บุกรุก');
    perform public._rls_rec('T02 ห้ามเพิ่มข้อมูลในส่วนงานอื่น', false, 'insert สำเร็จ');
  exception when others then perform public._rls_rec('T02 ห้ามเพิ่มข้อมูลในส่วนงานอื่น', true); end;

  begin
    update public.stakeholders set status = 'approved' where id = '44444444-0000-4000-8000-00000000000a';
    perform public._rls_rec('T03 ห้ามเปลี่ยนสถานะโดยตรง (ต้องผ่านปุ่มส่ง/อนุมัติ)', false, 'update สำเร็จ');
  exception when others then perform public._rls_rec('T03 ห้ามเปลี่ยนสถานะโดยตรง (ต้องผ่านปุ่มส่ง/อนุมัติ)', true); end;

  begin
    perform public.submit_stakeholder('44444444-0000-4000-8000-00000000000a');
    perform public._rls_rec('T04 ส่งข้อมูลที่ยังไม่ครบไม่ได้', false, 'ส่งสำเร็จ');
  exception when others then perform public._rls_rec('T04 ส่งข้อมูลที่ยังไม่ครบไม่ได้', sqlerrm like '%ไม่ครบถ้วน%', sqlerrm); end;

  insert into public.stakeholder_issues (stakeholder_id, issue_text, interest, influence, impact_org, impact_sh, engagement_level, responsible_unit)
  values ('44444444-0000-4000-8000-00000000000a', 'ประเด็นทดสอบ', 5, 4, 3, 4, 'collaborate', 'RLS-A')
  returning priority_score, issue_score into v_ps, v_is;
  perform public._rls_rec('T05 คำนวณคะแนน 5×4 = 20 และ 3×4 = 12', v_ps = 20 and v_is = 12, format('ได้ %s และ %s', v_ps, v_is));

  begin
    insert into public.stakeholder_issues (stakeholder_id, issue_text, interest) values ('44444444-0000-4000-8000-00000000000a', 'x', 6);
    perform public._rls_rec('T06 คะแนนนอกช่วง 1–5 ถูกปฏิเสธ', false, 'บันทึกได้');
  exception when others then perform public._rls_rec('T06 คะแนนนอกช่วง 1–5 ถูกปฏิเสธ', true); end;

  begin
    perform public.submit_stakeholder('44444444-0000-4000-8000-00000000000a');
    perform public._rls_rec('T07 ส่งข้อมูลที่ครบถ้วนได้', (select status from public.stakeholders where id = '44444444-0000-4000-8000-00000000000a') = 'submitted');
  exception when others then perform public._rls_rec('T07 ส่งข้อมูลที่ครบถ้วนได้', false, sqlerrm); end;

  update public.stakeholders set name = 'แก้หลังส่ง' where id = '44444444-0000-4000-8000-00000000000a';
  get diagnostics v_n = row_count;
  perform public._rls_rec('T08 แก้ไขไม่ได้หลังส่งตรวจสอบ', v_n = 0, format('แก้ไขได้ %s แถว', v_n));

  select count(*) into v_n from public.audit_logs;
  perform public._rls_rec('T09 ผู้ใช้ส่วนงานอ่าน audit log ไม่ได้', v_n = 0, format('เห็น %s แถว', v_n));
end $$;

-- ================= ผู้ใช้ส่วนงาน B =================
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-00000000000c","role":"authenticated"}', true);

do $$
declare v_n int; v_m int;
begin
  select count(*) into v_n from public.stakeholders where id = '44444444-0000-4000-8000-00000000000a';
  select count(*) into v_m from public.stakeholder_issues where stakeholder_id = '44444444-0000-4000-8000-00000000000a';
  perform public._rls_rec('T10 ส่วนงาน B มองไม่เห็นข้อมูลและประเด็นของส่วนงาน A', v_n = 0 and v_m = 0, format('เห็น %s ราย %s ประเด็น', v_n, v_m));

  delete from public.stakeholders where id = '44444444-0000-4000-8000-00000000000a';
  get diagnostics v_n = row_count;
  perform public._rls_rec('T11 ส่วนงาน B ลบข้อมูลส่วนงาน A ไม่ได้', v_n = 0, format('ลบได้ %s แถว', v_n));

  begin
    perform public.approve_stakeholder('44444444-0000-4000-8000-00000000000a', null);
    perform public._rls_rec('T12 ผู้ใช้ส่วนงานอนุมัติไม่ได้', false, 'อนุมัติสำเร็จ');
  exception when others then perform public._rls_rec('T12 ผู้ใช้ส่วนงานอนุมัติไม่ได้', true); end;
end $$;

-- ================= ผู้ตรวจสอบที่ได้รับสิทธิ์เฉพาะส่วนงาน B =================
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-00000000000d","role":"authenticated"}', true);

do $$
declare v_n int;
begin
  select count(*) into v_n from public.stakeholders where id = '44444444-0000-4000-8000-00000000000a';
  perform public._rls_rec('T13 ผู้ตรวจสอบเห็นเฉพาะส่วนงานที่ได้รับสิทธิ์', v_n = 0, format('เห็น %s ราย', v_n));
  begin
    perform public.approve_stakeholder('44444444-0000-4000-8000-00000000000a', null);
    perform public._rls_rec('T14 ผู้ตรวจสอบอนุมัตินอกสิทธิ์ไม่ได้', false, 'อนุมัติสำเร็จ');
  exception when others then perform public._rls_rec('T14 ผู้ตรวจสอบอนุมัตินอกสิทธิ์ไม่ได้', true); end;
end $$;

-- ================= ผู้ดูแลระบบ =================
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-00000000000a","role":"authenticated"}', true);

do $$
begin
  begin
    perform public.return_stakeholder('44444444-0000-4000-8000-00000000000a', '');
    perform public._rls_rec('T15 ส่งกลับแก้ไขต้องมีข้อเสนอแนะ', false, 'ส่งกลับได้โดยไม่มีข้อความ');
  exception when others then perform public._rls_rec('T15 ส่งกลับแก้ไขต้องมีข้อเสนอแนะ', true); end;
  begin
    perform public.approve_stakeholder('44444444-0000-4000-8000-00000000000a', 'ผ่าน');
    perform public._rls_rec('T16 ผู้ดูแลระบบอนุมัติได้ และบันทึกประวัติ',
      (select status from public.stakeholders where id = '44444444-0000-4000-8000-00000000000a') = 'approved'
      and (select count(*) from public.review_actions where stakeholder_id = '44444444-0000-4000-8000-00000000000a') = 2
      and exists (select 1 from public.audit_logs where record_id = '44444444-0000-4000-8000-00000000000a'));
  exception when others then perform public._rls_rec('T16 ผู้ดูแลระบบอนุมัติได้ และบันทึกประวัติ', false, sqlerrm); end;
end $$;

-- ================= สรุปผล และยกเลิกข้อมูลทดสอบทั้งหมด =================
reset role;
do $$
declare v_log text := coalesce(current_setting('rls.log', true), '');
begin
  if v_log like '%✘%' then
    raise exception E'ผลทดสอบ RLS: ไม่ผ่าน (ยกเลิกข้อมูลทดสอบแล้ว)%', v_log;
  else
    raise exception E'ผลทดสอบ RLS: ผ่านทั้งหมด (ยกเลิกข้อมูลทดสอบแล้ว ไม่มีข้อมูลค้างในระบบ)%', v_log;
  end if;
end $$;
