import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Die .env liegt im Hauptordner des Repos – von src/ und dist/ aus drei Ebenen höher.
const rootEnvFile = fileURLToPath(new URL('../../../.env', import.meta.url));

// Bereits gesetzte Umgebungsvariablen (z. B. im Betrieb) haben Vorrang vor der Datei.
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export function databaseUrl(): string {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      'DATABASE_URL fehlt oder ist ungültig. Trage sie in die .env im Hauptordner ein (Vorlage: .env.example).',
    );
  }
  return result.data.DATABASE_URL;
}

const apiEnvSchema = z.object({
  API_DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

const jobsEnvSchema = z.object({
  JOBS_DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

/**
 * Adresse, mit der sich die API verbindet: als Rolle reziproq_api, die nicht Eigentümer der
 * Tabellen ist (PLT-02). DATABASE_URL bleibt für Migrationen und Skripte.
 */
export function apiDatabaseUrl(): string {
  const result = apiEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      'API_DATABASE_URL fehlt oder ist ungültig. Trage sie in die .env im Hauptordner ein (Vorlage: .env.example) und führe pnpm db:roles aus.',
    );
  }
  return result.data.API_DATABASE_URL;
}

/** Adresse des Hintergrundjobs: eigene Rolle, getrennt von API und Migrationen (QS-01). */
export function jobsDatabaseUrl(): string {
  const result = jobsEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      'JOBS_DATABASE_URL fehlt oder ist ungültig. Trage sie in die .env im Hauptordner ein (Vorlage: .env.example) und führe pnpm db:roles aus.',
    );
  }
  return result.data.JOBS_DATABASE_URL;
}
