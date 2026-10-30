import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Die .env liegt im Hauptordner des Repos – von src/config/ und dist/config/ aus vier Ebenen höher.
const rootEnvFile = fileURLToPath(new URL('../../../../.env', import.meta.url));

if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

// Leerer Wert (wie in .env.example) zählt als nicht gesetzt.
const emptyAsUndefined = (value: unknown) => (value === '' ? undefined : value);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.preprocess(emptyAsUndefined, z.coerce.number().int().positive().default(3000)),
  // Zitadel vergleicht den Issuer exakt, deshalb ohne / am Ende.
  ZITADEL_ISSUER: z.preprocess(
    emptyAsUndefined,
    z.url({ protocol: /^https?$/ }).transform((url) => url.replace(/\/+$/, '')),
  ),
  ZITADEL_PROJECT_ID: z.preprocess(emptyAsUndefined, z.string().min(1)),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  const names = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
  throw new Error(
    `Fehlende oder ungültige Umgebungsvariablen: ${names.join(', ')}. ` +
      'Trage sie in die .env im Hauptordner ein (Vorlage: .env.example).',
  );
}

export const env = result.data;
