/** DB DATE columns ↔ API "YYYY-MM-DD" strings. */
export const toDateString = (date: Date) => date.toISOString().slice(0, 10);
export const fromDateString = (value: string) => new Date(`${value}T00:00:00.000Z`);
