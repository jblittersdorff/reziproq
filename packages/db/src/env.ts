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
