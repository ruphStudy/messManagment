import { Logger } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

/** Where file bytes live. Swap for an object-storage implementation (S3/GCS/R2) without touching callers. */
export interface StorageProvider {
  put(key: string, data: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
}

/** Development / single-server storage on local disk. Keys are random, never client filenames. */
export class LocalStorageProvider implements StorageProvider {
  private readonly root: string;

  constructor(dir: string, isProduction: boolean) {
    this.root = resolve(dir);
    if (isProduction) new Logger('Storage').warn(`Using local disk storage at ${this.root}; make sure it is a persistent volume.`);
  }

  async put(key: string, data: Buffer) {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.path(key), data, { flag: 'wx' });
  }

  async get(key: string) {
    try {
      return await readFile(this.path(key));
    } catch {
      return null;
    }
  }

  /** Keys are generated server-side (uuid + extension); this also refuses anything path-like. */
  private path(key: string) {
    if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key)) throw new Error('Invalid storage key');
    return join(this.root, key);
  }
}
