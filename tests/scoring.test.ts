import { describe, expect, it } from "vitest";
import { issueScore, priorityScore, quadrant, scoreBand } from "@/lib/domain/scoring";

describe("priorityScore = ความสนใจ × อิทธิพล (1–25)", () => {
  it("ถูกต้องทุกคู่ 1–5", () => {
    for (let a = 1; a <= 5; a++) for (let b = 1; b <= 5; b++) expect(priorityScore(a, b)).toBe(a * b);
  });
  it("ตัวอย่างใน Excel: 3 × 2 = 6 และ 5 × 5 = 25", () => {
    expect(priorityScore(3, 2)).toBe(6);
    expect(priorityScore(5, 5)).toBe(25);
  });
  it("ค่าว่างหรือเกินช่วง → null", () => {
    expect(priorityScore(null, 3)).toBeNull();
    expect(priorityScore(3, undefined)).toBeNull();
    expect(priorityScore(0, 3)).toBeNull();
    expect(priorityScore(6, 3)).toBeNull();
    expect(priorityScore(2.5, 3)).toBeNull();
  });
});

describe("issueScore = ผลกระทบองค์กร × ผลกระทบผู้มีส่วนได้ส่วนเสีย (1–16)", () => {
  it("ถูกต้องทุกคู่ 1–4", () => {
    for (let a = 1; a <= 4; a++) for (let b = 1; b <= 4; b++) expect(issueScore(a, b)).toBe(a * b);
  });
  it("ตัวอย่างใน Excel: 3 × 4 = 12 และ 4 × 4 = 16", () => {
    expect(issueScore(3, 4)).toBe(12);
    expect(issueScore(4, 4)).toBe(16);
  });
  it("ระดับ 5 ไม่ถูกต้องสำหรับผลกระทบ", () => {
    expect(issueScore(5, 1)).toBeNull();
  });
});

describe("แถบสีและ quadrant", () => {
  it("scoreBand", () => {
    expect(scoreBand(25, 25)?.tone).toBe("critical");
    expect(scoreBand(1, 25)?.tone).toBe("low");
    expect(scoreBand(null, 16)).toBeNull();
  });
  it("quadrant", () => {
    expect(quadrant(5, 5).key).toBe("manage");
    expect(quadrant(1, 5).key).toBe("satisfy");
    expect(quadrant(5, 1).key).toBe("inform");
    expect(quadrant(1, 1).key).toBe("monitor");
  });
});
