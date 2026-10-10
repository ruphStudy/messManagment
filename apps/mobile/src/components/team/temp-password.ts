/** Readable temporary password meeting the password rule (letters + digits). Shared in person, never shown again. */
export function generateTemporaryPassword(): string {
  const letters = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const pick = (set: string, n: number) => Array.from({ length: n }, () => set[Math.floor(Math.random() * set.length)]).join('');
  return `${pick(letters, 1).toUpperCase()}${pick(letters, 5)}${pick(digits, 4)}`;
}
