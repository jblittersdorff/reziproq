import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { env } from '../config/env.js';

/**
 * IN-04: Ablage für Dateien (Anhänge abgelegter Mails). Lokal ein Ordner; im Betrieb kommt S3 in
 * Frankfurt (Block C, infra/). Schlüssel enthalten die Organisation, damit Dateien je Kunde getrennt
 * liegen; ob jemand eine Datei lesen darf, prüft immer der Dienst über die Zeilensicherheit.
 */
export const FILE_STORE = Symbol('FILE_STORE');

export interface FileStore {
  put(key: string, bytes: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
}

/** Ordner der Ablage: FILE_STORE_DIR, in Tests ein temporärer Ordner, sonst .data/dateien */
export function fileStoreDir(): string {
  if (env.FILE_STORE_DIR) return resolve(env.FILE_STORE_DIR);
  if (process.env.VITEST) return join(tmpdir(), 'reziproq-dateien');
  return resolve(process.cwd(), '.data', 'dateien');
}

@Injectable()
export class LocalFileStore implements FileStore {
  private readonly root = fileStoreDir();

  /** Nur Schlüssel innerhalb der Ablage, nie ein Pfad nach außen */
  private path(key: string) {
    if (!/^[a-z0-9-]+(\/[a-z0-9-]+)+$/i.test(key)) throw new Error('Ungültiger Dateischlüssel');
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) throw new Error('Ungültiger Dateischlüssel');
    return path;
  }

  async put(key: string, bytes: Buffer) {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async get(key: string) {
    try {
      return await readFile(this.path(key));
    } catch {
      return null;
    }
  }

  async remove(key: string) {
    await rm(this.path(key), { force: true });
  }
}
