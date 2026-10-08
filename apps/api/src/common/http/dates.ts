/** DB DATE columns ↔ API "YYYY-MM-DD" strings. */
export const toDateString = (date: Date) => date.toISOString().slice(0, 10);
export const fromDateString = (value: string) => new Date(`${value}T00:00:00.000Z`);

/** "2026-02" → { start: "2026-02-01", end: "2026-02-28" } */
export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  return { start: `${month}-01`, end: toDateString(new Date(Date.UTC(y, m, 0))) };
}
