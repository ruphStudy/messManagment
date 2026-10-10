const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dateTimeFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

const timestampDateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

/** Shown instead of crashing when an optional value is missing or malformed. */
const safe = (fmt: Intl.DateTimeFormat, d: Date) => (Number.isNaN(d.getTime()) ? '—' : fmt.format(d));

/** "2026-09-01" → "1 Sep 2026" (calendar date, no timezone shift). Only for date-only values, not timestamps. */
export function formatDate(value: string | null | undefined) {
  return value ? safe(dateFormat, new Date(`${value}T00:00:00Z`)) : '—';
}

/** ISO timestamp (createdAt, addedAt…) → its Indian calendar date, e.g. "9 Oct 2026". */
export function formatTimestampDate(value: string | null | undefined) {
  return value ? safe(timestampDateFormat, new Date(value)) : '—';
}

export function formatDateTime(value: string | null | undefined) {
  return value ? safe(dateTimeFormat, new Date(value)) : '—';
}

export function formatMobile(mobile: string) {
  return `+91 ${mobile.slice(0, 5)} ${mobile.slice(5)}`;
}

export function fullName(person: { firstName: string; lastName: string | null }) {
  return [person.firstName, person.lastName].filter(Boolean).join(' ');
}

const priceFormat = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** 3300 → "₹3,300"; 1800.5 → "₹1,800.5" */
export function formatPrice(rupees: number) {
  return priceFormat.format(rupees);
}
