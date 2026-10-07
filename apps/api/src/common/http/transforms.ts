import { Transform } from 'class-transformer';

export const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
export const TrimLower = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));
/** Trims and converts empty strings to null so optional fields can be cleared. */
export const EmptyToNull = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() || null : value));
