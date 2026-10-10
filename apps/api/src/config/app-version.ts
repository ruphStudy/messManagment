import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** API version from apps/api/package.json (same path from src/ and dist/). Safe to expose. */
function readVersion(): string {
  try {
    return (JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')) as { version?: string }).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export const APP_VERSION = readVersion();
