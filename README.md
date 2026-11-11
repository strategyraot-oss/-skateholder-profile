# Stakeholder Profile Management System – กยท.

ระบบฐานข้อมูลผู้มีส่วนได้ส่วนเสียของการยางแห่งประเทศไทย (Next.js 15 + Supabase + Vercel)
แผนงานอยู่ในไฟล์ `plan` และโครงสร้างข้อมูลอ้างอิงไฟล์ `Stakeholder Profile กยท. (แบบกรอกข้อมูลส่วนงาน).xlsx`

> **ไม่ต้องติดตั้งโปรแกรมใดในเครื่อง** ทุกขั้นตอนทำผ่านเว็บเบราว์เซอร์ (Supabase, GitHub, Vercel)
> Vercel จะติดตั้ง package, รันชุดทดสอบ (`vitest`) และ build ให้เอง หากทดสอบไม่ผ่าน การ deploy จะหยุดพร้อมแจ้งข้อที่ไม่ผ่าน

## ขั้นตอนนำขึ้นใช้งาน

### 1) ฐานข้อมูล Supabase
1. สมัคร/เข้าสู่ระบบ https://supabase.com แล้วกด **New project** (Region: Singapore)
2. เมนู **SQL Editor** → New query → คัดลอกทั้งไฟล์ `supabase/setup_all.sql` มาวาง → **Run**
3. เมนู **Authentication → Users → Add user** สร้างบัญชีผู้ดูแลระบบ (ใส่อีเมล/รหัสผ่าน ติ๊ก Auto Confirm User)
4. กลับไปที่ SQL Editor รันคำสั่งนี้ (แก้อีเมลเป็นของจริง)
   ```sql
   insert into departments (code, name) values ('กปผ.', 'กองประเมินผล');

   update profiles
      set role = 'admin', active = true, full_name = 'ผู้ดูแลระบบ',
          department_id = (select id from departments where code = 'กปผ.')
    where email = 'admin@example.com';

   insert into fiscal_years (year_be, start_date, end_date, is_open, is_current)
   values (2570, '2026-10-01', '2027-09-30', true, true);
   ```
5. (แนะนำ) ทดสอบสิทธิ์: วางทั้งไฟล์ `supabase/tests/rls_test.sql` ใน SQL Editor แล้ว Run
   ผลจะขึ้นเป็นข้อความ `ERROR: ผลทดสอบ RLS: ผ่านทั้งหมด ...` พร้อมรายการ ✔ (ขึ้นเป็น ERROR โดยตั้งใจ เพื่อยกเลิกข้อมูลทดสอบทั้งหมด)
6. เมนู **Project Settings → API** จดค่า `Project URL`, `anon public key` และ `service_role key`

### 2) GitHub (เก็บโค้ด)
1. สร้าง repository ใหม่แบบ **Private** ที่ https://github.com/new
2. กด **uploading an existing file** แล้วลากไฟล์และโฟลเดอร์ทั้งหมดในโฟลเดอร์นี้ไปวาง (รวมไฟล์ Excel ต้นฉบับ ซึ่งใช้ในชุดทดสอบ) → Commit

### 3) Vercel (รันระบบ)
1. เข้า https://vercel.com ด้วยบัญชี GitHub → **Add New → Project** → เลือก repository
2. เปิด **Environment Variables** ใส่ 3 ค่า
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (ใช้สร้างบัญชีผู้ใช้ในหน้าตั้งค่า) |
3. กด **Deploy** → ได้ลิงก์ระบบ เช่น `https://xxxx.vercel.app`
4. ที่ Supabase → **Authentication → URL Configuration** ตั้ง Site URL เป็นลิงก์ Vercel

การแก้ไขครั้งต่อไป: อัปโหลดไฟล์ที่แก้ไขขึ้น GitHub แล้ว Vercel จะ deploy ใหม่อัตโนมัติ
หากต้องแก้ฐานข้อมูล ให้รันเฉพาะไฟล์ migration ใหม่ใน SQL Editor

## หลังติดตั้ง (โดยผู้ดูแลระบบ)
1. **จัดการข้อมูลส่วนงาน** → เพิ่มส่วนงานทั้งหมด (อักษรย่อ + ชื่อ)
2. **ตั้งค่าระบบ → ผู้ใช้งานและสิทธิ์** → เพิ่มผู้ใช้ กำหนดบทบาทและส่วนงาน (ผู้ตรวจสอบเลือกส่วนงานที่เห็นได้)
3. **ตั้งค่าระบบ → รอบปีงบประมาณ** → กำหนดช่วงวันที่กรอก และเปิด/ปิดรับข้อมูล

## สิ่งที่ระบบมี
| เมนู | ความสามารถ |
|---|---|
| Dashboard | KPI, สถานะการส่ง, แยกตามกลุ่ม/กลุ่มย่อย/ส่วนงาน, Power–Interest Matrix, ระดับความสัมพันธ์, รายการความสำคัญสูง, ประเด็นสำคัญ, ตัวกรองปี/ส่วนงาน/กลุ่ม/กลุ่มย่อย |
| ฐานข้อมูล | ค้นหา กรอง แบ่งหน้า (รองรับ 10,000+ รายการ), รายละเอียด, คัดลอกเป็นรายการใหม่, ส่งออก/นำเข้า Excel |
| เพิ่มข้อมูล | Wizard 6 ขั้นตอน, Auto Save, Smart Dropdown, Smart Suggestion, Duplicate Detection, Copy Previous Data, หลายประเด็นต่อราย |
| ตรวจสอบความครบถ้วน | ความคืบหน้ารายส่วนงาน, รายการที่ยังไม่ครบพร้อมสาเหตุ, รายการที่พร้อมส่ง |
| รายงาน | ตารางสรุปตามแท็บ “สรุป” ของต้นฉบับ, สรุประดับความสัมพันธ์, ส่งออก Excel รูปแบบต้นฉบับ |
| จัดการข้อมูลส่วนงาน | ติดตามการส่งของแต่ละส่วนงาน, เพิ่ม/แก้ไขส่วนงาน (admin) |
| ตั้งค่าระบบ | ผู้ใช้/สิทธิ์/รหัสผ่าน, รอบปีงบประมาณ, เปิด–ปิดระบบ, วันเริ่ม–สิ้นสุดการกรอก |

## หลักการที่ระบบบังคับในฐานข้อมูล
- 1 ผู้มีส่วนได้ส่วนเสีย มีได้หลายประเด็น (`stakeholder_issues`) แต่ละประเด็นมีคะแนนและระดับความสัมพันธ์ของตนเอง
- คะแนน `interest × influence` (1–25) และ `impact_org × impact_sh` (1–16) คำนวณในฐานข้อมูล
- RLS: ผู้ใช้ส่วนงานเห็น/แก้ไขเฉพาะส่วนงานตนเอง และแก้ได้เฉพาะสถานะร่าง/ส่งกลับ ระหว่างที่รอบปีเปิดรับข้อมูล
- เปลี่ยนสถานะได้ผ่านปุ่ม ส่ง / ส่งกลับ (ต้องมีข้อเสนอแนะ) / อนุมัติ เท่านั้น
- ทุกการสร้าง แก้ไข ลบ ส่ง อนุมัติ ถูกบันทึกพร้อมผู้ดำเนินการ (`audit_logs`, `review_actions`)
- ไม่มีข้อมูลตัวอย่างในฐานข้อมูล (seed มีเฉพาะกลุ่ม/กลุ่มย่อยจากไฟล์ต้นฉบับ)

## โครงสร้างไฟล์สำคัญ
- `supabase/setup_all.sql` ติดตั้งฐานข้อมูลครั้งเดียว (รวม `migrations/*` + `seed.sql`)
- `supabase/tests/rls_test.sql` ทดสอบสิทธิ์และ workflow (16 ข้อ)
- `tests/*.test.ts` ทดสอบการคำนวณคะแนน ความครบถ้วน และ Excel (รันอัตโนมัติตอน build บน Vercel)
- `lib/domain/*` กฎธุรกิจ (กลุ่ม, คะแนน, ความครบถ้วน, คำแนะนำ)
- `lib/excel/*` รูปแบบ Excel ต้นฉบับ (A–AB) สำหรับนำเข้า/ส่งออก
- `components/wizard/Wizard.tsx` แบบฟอร์ม 6 ขั้นตอน
