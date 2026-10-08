/** DB DATE columns ↔ API "YYYY-MM-DD" strings. */
export const toDateString = (date: Date) => date.toISOString().slice(0, 10);
export const fromDateString = (value: string) => new Date(`${value}T00:00:00.000Z`);

/** "2026-02" → { start: "2026-02-01", end: "2026-02-28" } */
export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  return { start: `${month}-01`, end: toDateString(new Date(Date.UTC(y, m, 0))) };
}

/** Start of a business day (Asia/Kolkata, UTC+05:30, no DST) as a timestamp — for filtering createdAt-style columns. */
export const businessDayStart = (value: string) => new Date(`${value}T00:00:00.000+05:30`);

/** createdAt filter for an inclusive business-day range. */
export function timestampRange(from?: string, to?: string) {
  if (!from && !to) return undefined;
  return { ...(from ? { gte: businessDayStart(from) } : {}), ...(to ? { lt: new Date(businessDayStart(to).getTime() + 86_400_000) } : {}) };
}
