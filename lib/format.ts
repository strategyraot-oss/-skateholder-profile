const dt = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});
const d = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" });
const t = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
const n = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });

export const fmtDateTime = (v?: string | Date | null) => (v ? dt.format(new Date(v)) : "–");
export const fmtDate = (v?: string | Date | null) => (v ? d.format(new Date(v)) : "–");
export const fmtTime = (v?: string | Date | null) => (v ? t.format(new Date(v)) : "–");
export const fmtNum = (v?: number | string | null) => (v == null || v === "" ? "–" : n.format(Number(v)));
export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
