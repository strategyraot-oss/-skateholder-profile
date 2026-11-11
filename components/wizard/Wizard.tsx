"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, CloudOff, Copy, Loader2, Pencil, Plus, Save, Send, Trash2,
} from "lucide-react";
import { Chips, Field, RatingCards, ScorePill, SearchSelect, type Option } from "@/components/ui";
import { ENGAGEMENT_LEVELS, LEVEL_4, LEVEL_5 } from "@/lib/domain/reference";
import { listProblems, type Problem, type RowInput } from "@/lib/domain/completeness";
import { issueScore, priorityScore } from "@/lib/domain/scoring";
import { getSuggestions } from "@/lib/domain/suggestions";
import { fmtTime } from "@/lib/format";
import { newIssue, type WizardIssue, type WizardState } from "@/lib/wizard";
import type { Department, FiscalYear, StakeholderGroup, StakeholderSubgroup, UserRole } from "@/lib/types";
import {
  findDuplicates, getCopySource, saveStakeholder, searchCopySources, submitStakeholder,
  type CopySource, type Duplicate, type SaveResult,
} from "@/app/(app)/stakeholders/actions";

const STEPS = [
  { title: "จำแนกกลุ่ม", desc: "เลือกกลุ่มและกลุ่มย่อยของผู้มีส่วนได้ส่วนเสีย ระบบจะแสดงเฉพาะกลุ่มย่อยที่เกี่ยวข้องให้อัตโนมัติ" },
  { title: "ข้อมูลพื้นฐาน", desc: "ระบุชื่อผู้มีส่วนได้ส่วนเสียและผู้ติดต่อ ช่องที่ไม่มีเครื่องหมาย * เว้นว่างได้" },
  { title: "ความต้องการ", desc: "ระบุวัตถุประสงค์ และประเด็นความต้องการ/ความคาดหวัง เพิ่มได้หลายประเด็น" },
  { title: "ระดับความสำคัญ", desc: "กดเลือกคะแนนของแต่ละประเด็น ระบบคำนวณคะแนนรวมให้ทันที" },
  { title: "การสร้างความสัมพันธ์", desc: "เลือกระดับการสร้างความสัมพันธ์และช่องทางการสื่อสารของแต่ละประเด็น" },
  { title: "ตรวจสอบและบันทึก", desc: "ตรวจทานข้อมูลทั้งหมด แก้ไขส่วนที่ยังไม่ครบ แล้วกดยืนยันส่งข้อมูล" },
];

const LS_KEY = "sp-wizard-new";
const FILLED: RowInput = {
  department: "x", group: "x", subgroup: "x", otherText: "x", name: "x", issueText: "x",
  engagementLevel: "x", responsibleUnit: "x", interest: 1, influence: 1, impactOrg: 1, impactSh: 1,
};

type SaveState = { status: "idle" | "pending" | "saving" | "saved" | "error"; at?: string | null; error?: string };
type IssueProblem = Problem & { issue?: number };

type Props = {
  initial: WizardState;
  initialSavedAt?: string | null;
  groups: StakeholderGroup[];
  subgroups: StakeholderSubgroup[];
  departments: Department[];
  role: UserRole;
  fiscalYear: FiscalYear | null;
  writable: boolean;
  returnComment?: string | null;
  allowRestore?: boolean;
};

export default function Wizard(props: Props) {
  const { groups, subgroups, departments, role, fiscalYear, writable } = props;
  const router = useRouter();
  const [state, setState] = useState<WizardState>(props.initial);
  const [version, setVersion] = useState(0);
  const [step, setStep] = useState(1);
  const [tried, setTried] = useState<Record<number, boolean>>({});
  const [save, setSave] = useState<SaveState>({ status: props.initial.id ? "saved" : "idle", at: props.initialSavedAt });
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [restore, setRestore] = useState<WizardState | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const chain = useRef<Promise<SaveResult | null>>(Promise.resolve(null));
  const topRef = useRef<HTMLDivElement>(null);

  const group = groups.find((g) => g.id === state.group_id) ?? null;
  const subgroup = subgroups.find((s) => s.id === state.subgroup_id) ?? null;
  const dept = departments.find((d) => d.id === state.department_id) ?? null;
  const sugg = useMemo(() => getSuggestions(group?.code), [group?.code]);
  const needOther = !!(group?.is_other || subgroup?.is_other);

  /* ---------- state helpers ---------- */
  const update = useCallback((patch: Partial<WizardState> | ((s: WizardState) => WizardState)) => {
    setState((prev) => (typeof patch === "function" ? patch(prev) : { ...prev, ...patch }));
    setVersion((v) => v + 1);
  }, []);
  const updateIssue = (idx: number, patch: Partial<WizardIssue>) =>
    update((s) => ({ ...s, issues: s.issues.map((x, i) => (i === idx ? { ...x, ...patch } : x)) }));
  const addIssue = (partial: Partial<WizardIssue> = {}) => update((s) => ({ ...s, issues: [...s.issues, newIssue(partial)] }));
  const removeIssue = (idx: number) => {
    const it = state.issues[idx];
    if (it.issue_text.trim() && !window.confirm("ต้องการลบประเด็นนี้ใช่หรือไม่?")) return;
    update((s) => ({ ...s, issues: s.issues.filter((_, i) => i !== idx) }));
  };
  const duplicateIssue = (idx: number) =>
    update((s) => {
      const copy = { ...s.issues[idx], id: crypto.randomUUID() };
      const issues = [...s.issues];
      issues.splice(idx + 1, 0, copy);
      return { ...s, issues };
    });

  /* ---------- Auto Save ---------- */
  const runSave = useCallback(async (): Promise<SaveResult | null> => {
    const s = stateRef.current;
    if (!s.group_id) return null;
    setSave((p) => ({ ...p, status: "saving" }));
    const res = await saveStakeholder(s);
    if (res.ok) {
      if (!stateRef.current.id) {
        stateRef.current = { ...stateRef.current, id: res.id };
        setState((p) => ({ ...p, id: res.id }));
        window.history.replaceState(null, "", `/stakeholders/${res.id}/edit`);
        try { localStorage.removeItem(LS_KEY); } catch {}
      }
      setSave({ status: "saved", at: res.savedAt });
    } else {
      setSave({ status: "error", error: res.error });
    }
    return res;
  }, []);

  const doSave = useCallback(() => {
    chain.current = chain.current.then(runSave, runSave);
    return chain.current;
  }, [runSave]);

  useEffect(() => {
    if (version === 0) return;
    if (!stateRef.current.id) {
      try { localStorage.setItem(LS_KEY, JSON.stringify(stateRef.current)); } catch {}
    }
    if (!stateRef.current.group_id || !writable) return;
    setSave((p) => ({ ...p, status: "pending" }));
    const t = setTimeout(() => void doSave(), 1500);
    return () => clearTimeout(t);
  }, [version, doSave, writable]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (save.status === "pending" || save.status === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save.status]);

  useEffect(() => {
    if (!props.allowRestore) return;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as WizardState;
      if (s && (s.group_id || s.name) && Array.isArray(s.issues)) setRestore(s);
    } catch {}
  }, [props.allowRestore]);

  /* ---------- Validation ---------- */
  const problems = useMemo<IssueProblem[]>(() => {
    const base: RowInput = {
      department: dept?.code ?? "", group: group?.name ?? "", subgroup: subgroup?.name ?? "",
      otherText: state.other_text, name: state.name,
    };
    const list: IssueProblem[] = listProblems({ ...FILLED, ...base }).map((p) =>
      p.field === "subgroup" && subgroup && group && subgroup.group_id === group.id ? null : p,
    ).filter(Boolean) as IssueProblem[];
    if (!state.issues.length)
      list.push({ field: "issueText", step: 3, message: "ยังไม่มีประเด็นความต้องการ กรุณาเพิ่มอย่างน้อย 1 ประเด็น", excelText: "" });
    state.issues.forEach((i, idx) => {
      listProblems({
        ...FILLED,
        issueText: i.issue_text, engagementLevel: i.engagement_level, responsibleUnit: i.responsible_unit,
        interest: i.interest, influence: i.influence, impactOrg: i.impact_org, impactSh: i.impact_sh,
      })
        .filter((p) => p.step >= 3)
        .forEach((p) => list.push({ ...p, issue: idx }));
    });
    return list;
  }, [state, dept, group, subgroup]);

  const stepProblems = (n: number) => problems.filter((p) => p.step === n);
  const err = (n: number, field: string, issue?: number) =>
    tried[n] ? problems.find((p) => p.step === n && p.field === field && p.issue === issue)?.message ?? null : null;

  const go = (n: number) => {
    setStep(n);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const next = () => {
    setTried((t) => ({ ...t, [step]: true }));
    // ขั้นตอน 1–2 ต้องครบก่อนไปต่อ (จำเป็นต่อการบันทึก) ขั้นตอนอื่นไปต่อได้ แต่จะแสดงในหน้าตรวจสอบ
    if (step <= 2 && stepProblems(step).length) return;
    go(Math.min(step + 1, 6));
  };

  const submit = async () => {
    setTried({ 1: true, 2: true, 3: true, 4: true, 5: true });
    setSubmitErr(null);
    if (problems.length) { go(6); return; }
    if (!window.confirm("ยืนยันส่งข้อมูลให้ผู้ตรวจสอบ?\nหลังส่งแล้วจะแก้ไขไม่ได้ จนกว่าผู้ตรวจสอบจะส่งกลับให้แก้ไข")) return;
    setSubmitting(true);
    const saved = await doSave();
    const id = stateRef.current.id;
    if (!saved?.ok || !id) {
      setSubmitErr(saved && !saved.ok ? saved.error : "บันทึกข้อมูลไม่สำเร็จ");
      setSubmitting(false);
      return;
    }
    const r = await submitStakeholder(id);
    if (!r.ok) {
      setSubmitErr(r.error);
      setSubmitting(false);
      return;
    }
    router.push(`/stakeholders/${id}?submitted=1`);
  };

  const groupOptions: Option[] = groups.map((g) => ({ value: g.id, label: g.name }));
  const subOptions: Option[] = subgroups.filter((s) => s.group_id === state.group_id).map((s) => ({ value: s.id, label: s.name }));

  return (
    <div ref={topRef} className="scroll-mt-20 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{state.id ? "แก้ไขข้อมูลผู้มีส่วนได้ส่วนเสีย" : "เพิ่มข้อมูลผู้มีส่วนได้ส่วนเสีย"}</h1>
          <p className="text-sm text-gray-600">
            {fiscalYear ? `ปีงบประมาณ ${fiscalYear.year_be}` : "ยังไม่กำหนดปีงบประมาณ"}
            {dept ? ` · ${dept.name}` : ""}
          </p>
        </div>
        <SaveIndicator save={save} hasGroup={!!state.group_id} />
      </div>

      {!writable && (
        <Notice tone="orange">ระบบปิดรับข้อมูลของรอบปีงบประมาณนี้ จึงยังบันทึกไม่ได้ โปรดติดต่อกองประเมินผล</Notice>
      )}
      {props.returnComment && (
        <Notice tone="orange">
          <b>ผู้ตรวจสอบส่งกลับให้แก้ไข:</b> {props.returnComment}
        </Notice>
      )}
      {restore && (
        <Notice tone="blue">
          พบข้อมูลที่กรอกค้างไว้ในเครื่องนี้{restore.name ? ` (“${restore.name}”)` : ""}
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-primary py-1.5" onClick={() => { update({ ...restore, id: undefined }); setRestore(null); }}>
              กู้คืนข้อมูล
            </button>
            <button type="button" className="btn-secondary py-1.5" onClick={() => { try { localStorage.removeItem(LS_KEY); } catch {} setRestore(null); }}>
              เริ่มใหม่
            </button>
          </div>
        </Notice>
      )}

      <ProgressBar step={step} onGo={go} done={(n) => stepProblems(n).length === 0} />

      <section className="card p-5 sm:p-7">
        <div className="mb-5 border-b border-gray-100 pb-4">
          <div className="text-xs font-medium text-brand-700">ขั้นตอนที่ {step} จาก 6</div>
          <h2 className="text-lg font-semibold text-gray-900">{STEPS[step - 1].title}</h2>
          <p className="text-sm text-gray-600">{STEPS[step - 1].desc}</p>
        </div>

        {/* ---------- STEP 1 ---------- */}
        {step === 1 && (
          <div className="grid gap-5 md:grid-cols-2">
            {role === "admin" ? (
              <Field label="ส่วนงานผู้กรอกข้อมูล" required error={err(1, "department")}>
                <SearchSelect
                  value={state.department_id}
                  onChange={(v) => update({ department_id: v })}
                  options={departments.filter((d) => d.active).map((d) => ({ value: d.id, label: `${d.code} ${d.name}` }))}
                  placeholder="เลือกส่วนงาน"
                />
              </Field>
            ) : (
              <Field label="ส่วนงานผู้กรอกข้อมูล" required hint="ระบบกำหนดตามบัญชีผู้ใช้งานของท่าน">
                <div className="input bg-gray-50">{dept ? `${dept.code} ${dept.name}` : "–"}</div>
              </Field>
            )}
            <div className="hidden md:block" />
            <Field label="กลุ่มผู้มีส่วนได้ส่วนเสีย" required error={err(1, "group")} hint="พิมพ์ค้นหาได้ เช่น ลูกค้า, ชุมชน">
              <SearchSelect
                value={state.group_id}
                onChange={(v) => v !== state.group_id && update({ group_id: v, subgroup_id: null })}
                options={groupOptions}
                placeholder="เลือกกลุ่ม"
              />
            </Field>
            <Field
              label="กลุ่มย่อย"
              required
              error={err(1, "subgroup")}
              hint={state.group_id ? "แสดงเฉพาะกลุ่มย่อยของกลุ่มที่เลือก" : "กรุณาเลือกกลุ่มก่อน"}
            >
              <SearchSelect
                value={state.subgroup_id}
                onChange={(v) => update({ subgroup_id: v })}
                options={subOptions}
                disabled={!state.group_id}
                placeholder={state.group_id ? "เลือกกลุ่มย่อย" : "เลือกกลุ่มก่อน"}
              />
            </Field>
            {needOther && (
              <div className="md:col-span-2">
                <Field label="ระบุกลุ่ม/กลุ่มย่อย (กรณีเลือก อื่น ๆ)" required error={err(1, "otherText")}>
                  <input
                    className={clsx("input", !state.other_text.trim() && "border-yellow-400 bg-yellow-50")}
                    value={state.other_text}
                    onChange={(e) => update({ other_text: e.target.value })}
                    placeholder="เช่น องค์กรระหว่างประเทศ"
                  />
                </Field>
              </div>
            )}
            <QuickFind
              groups={groups}
              subgroups={subgroups}
              onPick={(sg) => update({ group_id: sg.group_id, subgroup_id: sg.id })}
            />
          </div>
        )}

        {/* ---------- STEP 2 ---------- */}
        {step === 2 && (
          <Step2
            state={state}
            update={update}
            sugg={sugg}
            err={(f) => err(2, f)}
            fiscalYearId={state.fiscal_year_id ?? fiscalYear?.id ?? null}
          />
        )}

        {/* ---------- STEP 3 ---------- */}
        {step === 3 && (
          <div className="space-y-6">
            <Field label="วัตถุประสงค์ในการสร้างความสัมพันธ์" hint="ระบุว่า กยท. ต้องการสร้างความสัมพันธ์กับผู้มีส่วนได้ส่วนเสียรายนี้เพื่ออะไร">
              <textarea
                className="input min-h-24"
                value={state.objective}
                onChange={(e) => update({ objective: e.target.value })}
                placeholder="เช่น รายงานผลการดำเนินงานตามนโยบายและยุทธศาสตร์"
              />
              <Chips items={sugg.objective} onPick={(v) => update({ objective: v })} />
            </Field>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                  ประเด็น/ความต้องการ/ความคาดหวังที่สำคัญ <span className="text-red-600">*</span>
                </h3>
                <span className="text-sm text-gray-500">{state.issues.length} ประเด็น</span>
              </div>
              <p className="mb-3 text-sm text-gray-600">
                1 ประเด็นต่อ 1 กล่อง หากมีหลายประเด็นให้กด “เพิ่มประเด็น” แต่ละประเด็นจะให้คะแนนและเลือกระดับความสัมพันธ์แยกกัน
              </p>
              <div className="space-y-3">
                {state.issues.map((it, idx) => (
                  <div key={it.id} className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-brand-800">ประเด็นที่ {idx + 1}</span>
                      <div className="flex gap-1">
                        <IconBtn title="คัดลอกประเด็น" onClick={() => duplicateIssue(idx)}><Copy className="h-4 w-4" /></IconBtn>
                        <IconBtn title="ลบประเด็น" onClick={() => removeIssue(idx)} danger><Trash2 className="h-4 w-4" /></IconBtn>
                      </div>
                    </div>
                    <textarea
                      className="input min-h-24 bg-white"
                      value={it.issue_text}
                      onChange={(e) => updateIssue(idx, { issue_text: e.target.value })}
                      placeholder="เช่น ต้องการให้ราคายางมีเสถียรภาพและเป็นธรรม"
                      aria-label={`ประเด็นที่ ${idx + 1}`}
                    />
                    {err(3, "issueText", idx) && <p className="mt-1 text-xs font-medium text-orange-700">{err(3, "issueText", idx)}</p>}
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => addIssue()} className="btn-secondary mt-3">
                <Plus className="h-4 w-4" /> เพิ่มประเด็น
              </button>
              <Chips
                label="ตัวอย่างประเด็น (กดเพื่อใส่)"
                items={sugg.issues}
                onPick={(v) => {
                  const last = state.issues.length - 1;
                  if (last >= 0 && !state.issues[last].issue_text.trim()) updateIssue(last, { issue_text: v });
                  else addIssue({ issue_text: v });
                }}
              />
            </div>
          </div>
        )}

        {/* ---------- STEP 4 ---------- */}
        {step === 4 && (
          <div className="space-y-5">
            <ScoringGuide />
            {state.issues.length === 0 && <EmptyIssues onGo={() => go(3)} />}
            {state.issues.map((it, idx) => {
              const ps = priorityScore(it.interest, it.influence);
              const is = issueScore(it.impact_org, it.impact_sh);
              return (
                <div key={it.id} className="rounded-xl border border-gray-200 p-4 sm:p-5">
                  <IssueHead idx={idx} text={it.issue_text} />
                  {idx > 0 && (
                    <button
                      type="button"
                      className="mb-3 text-xs text-brand-700 underline"
                      onClick={() => updateIssue(idx, { interest: state.issues[0].interest, influence: state.issues[0].influence })}
                    >
                      ใช้ระดับความสนใจ/อิทธิพลเดียวกับประเด็นที่ 1
                    </button>
                  )}
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="space-y-3 rounded-xl bg-gray-50 p-4">
                      <div className="text-sm font-semibold text-gray-800">ส่วนที่ 1 ความสำคัญของผู้มีส่วนได้ส่วนเสีย</div>
                      <Field label="ระดับความสนใจ (Interest)" required error={err(4, "interest", idx)}>
                        <RatingCards name="Interest" value={it.interest} options={LEVEL_5} onChange={(v) => updateIssue(idx, { interest: v })} />
                      </Field>
                      <Field label="ระดับอิทธิพล (Influence)" required error={err(4, "influence", idx)}>
                        <RatingCards name="Influence" value={it.influence} options={LEVEL_5} onChange={(v) => updateIssue(idx, { influence: v })} />
                      </Field>
                      <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                        <span>คะแนนรวมลำดับความสำคัญ (ความสนใจ × อิทธิพล)</span>
                        <ScorePill score={ps} max={25} />
                      </div>
                    </div>
                    <div className="space-y-3 rounded-xl bg-gray-50 p-4">
                      <div className="text-sm font-semibold text-gray-800">ส่วนที่ 2 ความสำคัญของประเด็นความต้องการ</div>
                      <Field label="ระดับผลกระทบต่อองค์กร" required error={err(4, "impactOrg", idx)}>
                        <RatingCards name="ผลกระทบต่อองค์กร" value={it.impact_org} options={LEVEL_4} onChange={(v) => updateIssue(idx, { impact_org: v })} />
                      </Field>
                      <Field label="ระดับผลกระทบต่อผู้มีส่วนได้ส่วนเสีย" required error={err(4, "impactSh", idx)}>
                        <RatingCards name="ผลกระทบต่อผู้มีส่วนได้ส่วนเสีย" value={it.impact_sh} options={LEVEL_4} onChange={(v) => updateIssue(idx, { impact_sh: v })} />
                      </Field>
                      <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                        <span>คะแนนรวมความสำคัญของประเด็น (ผลกระทบ × ผลกระทบ)</span>
                        <ScorePill score={is} max={16} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ---------- STEP 5 ---------- */}
        {step === 5 && (
          <div className="space-y-5">
            {state.issues.length === 0 && <EmptyIssues onGo={() => go(3)} />}
            {state.issues.map((it, idx) => {
              const lvl = ENGAGEMENT_LEVELS.find((e) => e.key === it.engagement_level);
              return (
                <div key={it.id} className="rounded-xl border border-gray-200 p-4 sm:p-5">
                  <IssueHead idx={idx} text={it.issue_text} />
                  {idx > 0 && (
                    <button
                      type="button"
                      className="mb-3 text-xs text-brand-700 underline"
                      onClick={() => {
                        const f = state.issues[0];
                        updateIssue(idx, {
                          engagement_level: f.engagement_level, channel: f.channel, frequency: f.frequency,
                          responsible_unit: f.responsible_unit, constraints: f.constraints,
                        });
                      }}
                    >
                      ใช้ข้อมูลการสร้างความสัมพันธ์เดียวกับประเด็นที่ 1
                    </button>
                  )}
                  <Field label="ระดับ/รูปแบบการสร้างความสัมพันธ์" required error={err(5, "engagementLevel", idx)}>
                    <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {ENGAGEMENT_LEVELS.map((e, i) => {
                        const on = it.engagement_level === e.key;
                        return (
                          <button
                            key={e.key}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => updateIssue(idx, { engagement_level: e.key })}
                            className={clsx(
                              "rounded-xl border-2 px-2 py-3 text-center transition",
                              on ? "border-brand-600 bg-brand-600 text-white shadow" : "border-gray-200 bg-white hover:border-brand-300 hover:bg-brand-50",
                            )}
                          >
                            <div className="text-xs opacity-75">ระดับ {i + 1}</div>
                            <div className="font-semibold">{e.en}</div>
                            <div className={clsx("text-xs", on ? "text-brand-50" : "text-gray-600")}>{e.th}</div>
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                  {lvl && (
                    <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm">
                      <div className="font-medium text-brand-900">{lvl.excelText}: {lvl.description}</div>
                      <div className="mt-0.5 text-brand-800">ตัวอย่าง: {lvl.example}</div>
                    </div>
                  )}
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field label="ช่องทาง/วิธีการสื่อสาร">
                      <input className="input" value={it.channel} onChange={(e) => updateIssue(idx, { channel: e.target.value })} />
                      <Chips items={sugg.channel} onPick={(v) => updateIssue(idx, { channel: it.channel ? `${it.channel}, ${v}` : v })} />
                    </Field>
                    <Field label="ความถี่ในการสื่อสาร">
                      <input className="input" value={it.frequency} onChange={(e) => updateIssue(idx, { frequency: e.target.value })} />
                      <Chips items={sugg.frequency} onPick={(v) => updateIssue(idx, { frequency: v })} />
                    </Field>
                    <Field label="หน่วยงานภายในที่รับผิดชอบ" required error={err(5, "responsibleUnit", idx)}>
                      <input className="input" value={it.responsible_unit} onChange={(e) => updateIssue(idx, { responsible_unit: e.target.value })} placeholder="เช่น ฝยศ." />
                      {dept && <Chips items={[dept.code]} onPick={(v) => updateIssue(idx, { responsible_unit: v })} label="ส่วนงานของท่าน" />}
                    </Field>
                    <Field label="ข้อจำกัด/ความสามารถเฉพาะ" hint="เช่น ภาษา วัฒนธรรม การสื่อสาร">
                      <input className="input" value={it.constraints} onChange={(e) => updateIssue(idx, { constraints: e.target.value })} />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="หมายเหตุ">
                        <input className="input" value={it.remark} onChange={(e) => updateIssue(idx, { remark: e.target.value })} />
                      </Field>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ---------- STEP 6 ---------- */}
        {step === 6 && (
          <div className="space-y-5">
            {problems.length > 0 ? (
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                <div className="flex items-center gap-2 font-semibold text-orange-800">
                  <AlertTriangle className="h-5 w-5" /> ยังกรอกข้อมูลไม่ครบ {problems.length} รายการ
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {problems.map((p, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        className="text-left text-orange-900 underline-offset-2 hover:underline"
                        onClick={() => { setTried((t) => ({ ...t, [p.step]: true })); go(p.step); }}
                      >
                        ขั้นตอนที่ {p.step}{p.issue != null ? ` · ประเด็นที่ ${p.issue + 1}` : ""}: {p.message}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 p-4 font-medium text-brand-800">
                <CheckCircle2 className="h-5 w-5" /> ข้อมูลครบถ้วน พร้อมส่งให้ผู้ตรวจสอบ
              </div>
            )}

            <Summary title="1. จำแนกกลุ่ม" onEdit={() => go(1)} rows={[
              ["ส่วนงานผู้กรอก", dept ? `${dept.code} ${dept.name}` : ""],
              ["กลุ่ม", group?.name ?? ""],
              ["กลุ่มย่อย", subgroup?.name ?? ""],
              ...(needOther ? [["ระบุอื่น ๆ", state.other_text] as [string, string]] : []),
            ]} />
            <Summary title="2. ข้อมูลพื้นฐาน" onEdit={() => go(2)} rows={[
              ["ชื่อผู้มีส่วนได้ส่วนเสีย", state.name],
              ["ประเภท/สถานะ", state.type_status],
              ["ที่อยู่/สถานที่ติดต่อ", state.address],
              ["รูปแบบความสัมพันธ์ทางธุรกิจ", state.business_relation],
              ["ผู้ประสานงาน", state.coordinator],
              ["ช่องทางติดต่อผู้ประสานงาน", state.coordinator_contact],
              ["ผู้มีอำนาจตัดสินใจ", state.decision_maker],
              ["ช่องทางติดต่อผู้มีอำนาจตัดสินใจ", state.decision_maker_contact],
            ]} />
            <Summary title="3. วัตถุประสงค์" onEdit={() => go(3)} rows={[["วัตถุประสงค์ในการสร้างความสัมพันธ์", state.objective]]} />

            <div className="rounded-xl border border-gray-200">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <h3 className="font-semibold">ประเด็นความต้องการ ({state.issues.length})</h3>
                <div className="flex gap-1">
                  <button type="button" className="btn-secondary px-2.5 py-1 text-xs" onClick={() => go(3)}><Pencil className="h-3.5 w-3.5" /> ประเด็น</button>
                  <button type="button" className="btn-secondary px-2.5 py-1 text-xs" onClick={() => go(4)}><Pencil className="h-3.5 w-3.5" /> คะแนน</button>
                  <button type="button" className="btn-secondary px-2.5 py-1 text-xs" onClick={() => go(5)}><Pencil className="h-3.5 w-3.5" /> ความสัมพันธ์</button>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {state.issues.map((it, idx) => (
                  <div key={it.id} className="space-y-2 px-4 py-3 text-sm">
                    <div><span className="font-medium text-brand-800">ประเด็นที่ {idx + 1}:</span> {it.issue_text || <Missing />}</div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-gray-700">
                      <span>ความสนใจ {it.interest ?? "–"} × อิทธิพล {it.influence ?? "–"} = <ScorePill score={priorityScore(it.interest, it.influence)} max={25} /></span>
                      <span>ผลกระทบองค์กร {it.impact_org ?? "–"} × ผลกระทบ SH {it.impact_sh ?? "–"} = <ScorePill score={issueScore(it.impact_org, it.impact_sh)} max={16} /></span>
                    </div>
                    <div className="text-gray-700">
                      ความสัมพันธ์: {ENGAGEMENT_LEVELS.find((e) => e.key === it.engagement_level)?.excelText ?? <Missing />} ·
                      ผู้รับผิดชอบ: {it.responsible_unit || <Missing />}
                      {it.channel && ` · ช่องทาง: ${it.channel}`}
                      {it.frequency && ` · ความถี่: ${it.frequency}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {submitErr && <Notice tone="red">{submitErr}</Notice>}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => void doSave()} disabled={!state.group_id || !writable}>
                <Save className="h-4 w-4" /> บันทึกฉบับร่าง
              </button>
              <button type="button" className="btn-primary" onClick={submit} disabled={submitting || !writable}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} ยืนยันส่งข้อมูล
              </button>
            </div>
          </div>
        )}

        {/* footer nav */}
        <div className="mt-7 flex items-center justify-between border-t border-gray-100 pt-5">
          <button type="button" className="btn-secondary" onClick={() => go(Math.max(1, step - 1))} disabled={step === 1}>
            <ArrowLeft className="h-4 w-4" /> ย้อนกลับ
          </button>
          {step < 6 && (
            <button type="button" className="btn-primary" onClick={next}>
              ถัดไป <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
        {tried[step] && step <= 2 && stepProblems(step).length > 0 && (
          <p className="mt-3 text-right text-sm text-orange-700">กรุณากรอกช่องที่มีเครื่องหมาย * ให้ครบก่อนไปขั้นตอนถัดไป</p>
        )}
      </section>
    </div>
  );
}

/* ================= sub components ================= */

function Step2({
  state, update, sugg, err, fiscalYearId,
}: {
  state: WizardState;
  update: (p: Partial<WizardState>) => void;
  sugg: ReturnType<typeof getSuggestions>;
  err: (f: string) => string | null;
  fiscalYearId: string | null;
}) {
  const [dups, setDups] = useState<Duplicate[]>([]);
  const [copyOpen, setCopyOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => setDups(await findDuplicates(state.name, fiscalYearId, state.id)), 700);
    return () => clearTimeout(t);
  }, [state.name, fiscalYearId, state.id]);

  const text = (k: keyof WizardState, label: string, opts: { placeholder?: string; chips?: string[]; required?: boolean; area?: boolean } = {}) => (
    <Field label={label} required={opts.required} error={opts.required ? err(k) : null}>
      {opts.area ? (
        <textarea className="input min-h-20" value={String(state[k] ?? "")} placeholder={opts.placeholder} onChange={(e) => update({ [k]: e.target.value })} />
      ) : (
        <input className="input" value={String(state[k] ?? "")} placeholder={opts.placeholder} onChange={(e) => update({ [k]: e.target.value })} />
      )}
      {opts.chips && <Chips items={opts.chips} onPick={(v) => update({ [k]: v })} />}
    </Field>
  );

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50/50 p-3">
        <button type="button" className="text-sm font-medium text-brand-800" onClick={() => setCopyOpen((v) => !v)}>
          <Copy className="mr-1 inline h-4 w-4" /> คัดลอกข้อมูลพื้นฐานจากรายการเดิม (ช่วยลดการพิมพ์)
        </button>
        {copyOpen && <CopyPanel onPick={(p) => { update(p); setCopyOpen(false); }} />}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field label="ชื่อผู้มีส่วนได้ส่วนเสีย (หน่วยงาน/องค์กร/บุคคล)" required error={err("name")}>
            <input className="input" value={state.name} onChange={(e) => update({ name: e.target.value })} placeholder="เช่น กระทรวงเกษตรและสหกรณ์" />
          </Field>
          {dups.length > 0 && (
            <div className="mt-2 rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-sm">
              <div className="font-medium text-yellow-900">พบชื่อที่อาจซ้ำกันในปีงบประมาณนี้ โปรดตรวจสอบ</div>
              <ul className="mt-1 list-disc pl-5 text-yellow-900">
                {dups.map((d) => (
                  <li key={d.id}>
                    <a href={`/stakeholders/${d.id}`} target="_blank" className="underline">{d.name}</a>
                    {" "}· {d.department_name}{d.subgroup_name ? ` · ${d.subgroup_name}` : ""}
                  </li>
                ))}
              </ul>
              <div className="mt-1 text-xs text-yellow-800">หากเป็นคนละรายการหรือคนละประเด็น สามารถบันทึกต่อได้ตามปกติ</div>
            </div>
          )}
        </div>
        {text("type_status", "ประเภท/สถานะ", { chips: sugg.typeStatus })}
        {text("business_relation", "รูปแบบความสัมพันธ์ทางธุรกิจกับ กยท.", { chips: sugg.businessRelation })}
        <div className="md:col-span-2">{text("address", "ที่อยู่/สถานที่ติดต่อ", { area: true })}</div>
        {text("coordinator", "ผู้ประสานงาน (ชื่อ-สกุล/ตำแหน่ง)", { placeholder: "เช่น นายสมชาย ใจดี / ผู้อำนวยการกอง" })}
        {text("coordinator_contact", "ช่องทางติดต่อผู้ประสานงาน", { placeholder: "โทร / อีเมล / Line" })}
        {text("decision_maker", "ผู้มีอำนาจตัดสินใจ (ชื่อ-สกุล/ตำแหน่ง)")}
        {text("decision_maker_contact", "ช่องทางติดต่อผู้มีอำนาจตัดสินใจ", { placeholder: "โทร / อีเมล / Line" })}
      </div>
    </div>
  );
}

function CopyPanel({ onPick }: { onPick: (p: Partial<WizardState>) => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<CopySource[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = setTimeout(async () => setItems(await searchCopySources(q)), 400);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="mt-3 space-y-2">
      <input className="input bg-white" value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์ชื่อผู้มีส่วนได้ส่วนเสียที่เคยบันทึก…" autoFocus />
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          disabled={busy}
          className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm hover:border-brand-300"
          onClick={async () => {
            setBusy(true);
            const src = await getCopySource(it.id);
            setBusy(false);
            if (src) onPick(src);
          }}
        >
          <div className="font-medium">{it.name}</div>
          <div className="text-xs text-gray-500">{it.department_code} · {it.subgroup_name ?? "–"} · ปี {it.year_be}</div>
        </button>
      ))}
      {q.trim().length >= 2 && items.length === 0 && <p className="text-sm text-gray-500">ไม่พบรายการ</p>}
    </div>
  );
}

function QuickFind({
  groups, subgroups, onPick,
}: { groups: StakeholderGroup[]; subgroups: StakeholderSubgroup[]; onPick: (s: StakeholderSubgroup) => void }) {
  const [q, setQ] = useState("");
  const t = q.trim().toLowerCase();
  const hits = t.length >= 2 ? subgroups.filter((s) => !s.is_other && s.name.toLowerCase().includes(t)).slice(0, 6) : [];
  return (
    <div className="md:col-span-2 rounded-xl bg-gray-50 p-4">
      <label className="label" htmlFor="quickfind">ไม่แน่ใจว่าอยู่กลุ่มไหน? พิมพ์ค้นหากลุ่มย่อย</label>
      <input id="quickfind" className="input bg-white" value={q} onChange={(e) => setQ(e.target.value)} placeholder="เช่น เกษตรกร, สื่อออนไลน์, คู่ค้า" />
      {hits.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {hits.map((s) => (
            <button key={s.id} type="button" onClick={() => { onPick(s); setQ(""); }}
              className="rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-left text-sm hover:bg-brand-50">
              <span className="font-medium">{s.name}</span>
              <span className="block text-xs text-gray-500">{groups.find((g) => g.id === s.group_id)?.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ step, onGo, done }: { step: number; onGo: (n: number) => void; done: (n: number) => boolean }) {
  const pct = ((step - 1) / 5) * 100;
  return (
    <nav aria-label="ขั้นตอนการกรอก" className="card p-4">
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ol className="grid grid-cols-6 gap-1">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const cur = n === step;
          const ok = n < 6 && done(n);
          return (
            <li key={n}>
              <button type="button" onClick={() => onGo(n)} aria-current={cur ? "step" : undefined}
                className="flex w-full flex-col items-center gap-1 text-center">
                <span className={clsx(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                  cur ? "bg-brand-600 text-white ring-4 ring-brand-100" : ok ? "bg-brand-100 text-brand-800" : "bg-gray-100 text-gray-600",
                )}>
                  {ok && !cur ? <Check className="h-4 w-4" /> : n}
                </span>
                <span className={clsx("hidden text-xs sm:block", cur ? "font-semibold text-brand-800" : "text-gray-600")}>{s.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function SaveIndicator({ save, hasGroup }: { save: SaveState; hasGroup: boolean }) {
  if (!hasGroup) return <span className="text-xs text-gray-500">ระบบจะบันทึกอัตโนมัติหลังเลือกกลุ่ม</span>;
  const map = {
    idle: { icon: <Save className="h-4 w-4" />, text: "ยังไม่ได้บันทึก", cls: "text-gray-500" },
    pending: { icon: <Loader2 className="h-4 w-4" />, text: "มีการแก้ไข รอบันทึก…", cls: "text-gray-500" },
    saving: { icon: <Loader2 className="h-4 w-4 animate-spin" />, text: "กำลังบันทึก…", cls: "text-gray-600" },
    saved: { icon: <CheckCircle2 className="h-4 w-4" />, text: `บันทึกแล้ว เวลา ${fmtTime(save.at)} น.`, cls: "text-brand-700" },
    error: { icon: <CloudOff className="h-4 w-4" />, text: save.error ?? "บันทึกไม่สำเร็จ", cls: "text-red-700" },
  }[save.status];
  return (
    <span role="status" className={clsx("inline-flex max-w-sm items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm shadow-sm", map.cls)}>
      {map.icon} {map.text}
    </span>
  );
}

function ScoringGuide() {
  return (
    <details className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
      <summary className="cursor-pointer font-medium text-gray-800">เกณฑ์การให้คะแนน (กดเพื่อดู)</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>ระดับความสนใจ / ระดับอิทธิพล: 1 = น้อยที่สุด, 2 = น้อย, 3 = ปานกลาง, 4 = มาก, 5 = มากที่สุด</li>
        <li>คะแนนรวมลำดับความสำคัญ = ระดับความสนใจ × ระดับอิทธิพล (1–25)</li>
        <li>ระดับผลกระทบต่อองค์กร / ต่อผู้มีส่วนได้ส่วนเสีย: 1 = ต่ำ, 2 = ปานกลาง, 3 = สูง, 4 = สูงมาก</li>
        <li>คะแนนรวมความสำคัญของประเด็น = ผลกระทบต่อองค์กร × ผลกระทบต่อผู้มีส่วนได้ส่วนเสีย (1–16)</li>
      </ul>
    </details>
  );
}

function IssueHead({ idx, text }: { idx: number; text: string }) {
  return (
    <div className="mb-3">
      <div className="text-sm font-semibold text-brand-800">ประเด็นที่ {idx + 1}</div>
      <p className="line-clamp-2 text-sm text-gray-700">{text || <span className="text-orange-700">ยังไม่ได้ระบุประเด็น (กลับไปขั้นตอนที่ 3)</span>}</p>
    </div>
  );
}

function EmptyIssues({ onGo }: { onGo: () => void }) {
  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
      ยังไม่มีประเด็นความต้องการ <button type="button" className="underline" onClick={onGo}>ไปเพิ่มที่ขั้นตอนที่ 3</button>
    </div>
  );
}

function Summary({ title, rows, onEdit }: { title: string; rows: [string, string][]; onEdit: () => void }) {
  return (
    <div className="rounded-xl border border-gray-200">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h3 className="font-semibold">{title}</h3>
        <button type="button" className="btn-secondary px-2.5 py-1 text-xs" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> แก้ไข</button>
      </div>
      <dl className="grid gap-x-6 gap-y-2 px-4 py-3 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-gray-500">{k}</dt>
            <dd className="text-gray-900">{v?.trim() ? v : <span className="text-gray-400">–</span>}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Missing() {
  return <span className="font-medium text-orange-700">ยังไม่ได้ระบุ</span>;
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick}
      className={clsx("rounded-lg p-2 text-gray-500 hover:bg-white", danger ? "hover:text-red-600" : "hover:text-brand-700")}>
      {children}
    </button>
  );
}

export function Notice({ tone, children }: { tone: "orange" | "blue" | "red" | "green"; children: React.ReactNode }) {
  const cls = {
    orange: "border-orange-200 bg-orange-50 text-orange-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    red: "border-red-200 bg-red-50 text-red-800",
    green: "border-brand-200 bg-brand-50 text-brand-900",
  }[tone];
  return <div className={clsx("rounded-xl border p-4 text-sm", cls)}>{children}</div>;
}
