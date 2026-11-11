// หลักเกณฑ์คะแนนตามไฟล์ต้นฉบับ: R = P × Q (1–25), U = S × T (1–16)

const inRange = (v: number | null | undefined, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= max;

/** คะแนนรวมลำดับความสำคัญ = ระดับความสนใจ × ระดับอิทธิพล */
export function priorityScore(interest?: number | null, influence?: number | null): number | null {
  return inRange(interest, 5) && inRange(influence, 5) ? interest * influence : null;
}

/** คะแนนรวมความสำคัญของประเด็น = ผลกระทบต่อองค์กร × ผลกระทบต่อผู้มีส่วนได้ส่วนเสีย */
export function issueScore(impactOrg?: number | null, impactSh?: number | null): number | null {
  return inRange(impactOrg, 4) && inRange(impactSh, 4) ? impactOrg * impactSh : null;
}

// ช่วงสีสำหรับแสดงผลเท่านั้น (ไม่ใช่เกณฑ์ในไฟล์ต้นฉบับ) แบ่งตามสัดส่วนของคะแนนสูงสุด
export type Band = { label: string; tone: "low" | "mid" | "high" | "critical" };

export function scoreBand(score: number | null, max: 25 | 16): Band | null {
  if (score == null) return null;
  const r = score / max;
  if (r > 0.75) return { label: "สูงมาก", tone: "critical" };
  if (r > 0.5) return { label: "สูง", tone: "high" };
  if (r > 0.25) return { label: "ปานกลาง", tone: "mid" };
  return { label: "ต่ำ", tone: "low" };
}

/** Power–Interest Matrix: แบ่งที่ระดับ 3 (ปานกลางขึ้นไป = สูง) */
export function quadrant(interest: number, influence: number) {
  const hiInfluence = influence >= 3;
  const hiInterest = interest >= 3;
  if (hiInfluence && hiInterest) return { key: "manage", label: "บริหารจัดการใกล้ชิด (Manage Closely)" };
  if (hiInfluence) return { key: "satisfy", label: "ทำให้พึงพอใจ (Keep Satisfied)" };
  if (hiInterest) return { key: "inform", label: "แจ้งให้ทราบสม่ำเสมอ (Keep Informed)" };
  return { key: "monitor", label: "ติดตามสถานการณ์ (Monitor)" };
}
