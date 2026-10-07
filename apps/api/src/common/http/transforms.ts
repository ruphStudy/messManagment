import { Transform } from 'class-transformer';
import { normalizeMobile } from '@mess/shared';

export const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
export const TrimLower = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));
/** Trims and converts empty strings to null so optional fields can be cleared. */
export const EmptyToNull = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() || null : value));
/** Normalizes Indian mobile numbers (+91 / 91 / 0 prefixes, spaces, dashes). Invalid input is left for validators to reject. */
export const NormalizeMobile = () =>
  Transform(({ value }) => (typeof value === 'string' ? (normalizeMobile(value) ?? value.trim()) : value));
/** Like NormalizeMobile but empty strings become null (optional mobile fields). */
export const NormalizeOptionalMobile = () =>
  Transform(({ value }) => (typeof value === 'string' ? (value.trim() ? (normalizeMobile(value) ?? value.trim()) : null) : value));
