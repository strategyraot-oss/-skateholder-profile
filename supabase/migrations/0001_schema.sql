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
