import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Die .env liegt im Hauptordner des Repos – von src/config/ und dist/config/ aus vier Ebenen höher.
const rootEnvFile = fileURLToPath(new URL('../../../../.env', import.meta.url));

if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Leerer Wert (wie in .env.example) zählt als nicht gesetzt.
  PORT: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().positive().default(3000),
  ),
});

export const env = envSchema.parse(process.env);
