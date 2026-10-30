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

  // KI für das Prompt-Fenster (PLT-12). „test“ ist ein festes Modell ohne Schlüssel und Internet.
  // „bedrock“ kommt mit der Testumgebung ab März 2027.
  KI_ANBIETER: z.preprocess(emptyAsUndefined, z.enum(['test', 'anthropic']).default('test')),
  // Das Modell lässt sich ohne Codeänderung wechseln.
  KI_MODELL: z.preprocess(
    emptyAsUndefined,
    z
      .enum(['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'])
      .default('claude-haiku-5-5'),
  ),
  ANTHROPIC_API_KEY: z.preprocess(emptyAsUndefined, z.string().min(1).optional()),
  KI_ANFRAGEN_PRO_MINUTE: z.preprocess(
    emptyAsUndefined,
    z.coerce.number().int().positive().default(10),
  ),
});

export type Env = z.infer<typeof envSchema>;

/** Prüft die Umgebungsvariablen; bei einem Fehler startet die API nicht. */
export function parseEnv(input: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(input);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(
      `Fehlende oder ungültige Umgebungsvariablen: ${names.join(', ')}. ` +
        'Trage sie in die .env im Hauptordner ein (Vorlage: .env.example).',
    );
  }
  const env = result.data;
  // Der direkte Zugang zu Anthropic ist nur für Beispieldaten erlaubt; echte Kundendaten
  // laufen über Amazon Bedrock in der EU (PLT-12).
  if (env.KI_ANBIETER === 'anthropic' && env.NODE_ENV === 'production') {
    throw new Error('KI_ANBIETER=anthropic ist im Betrieb nicht erlaubt (NODE_ENV=production).');
  }
  if (env.KI_ANBIETER === 'anthropic' && !env.ANTHROPIC_API_KEY) {
    throw new Error('KI_ANBIETER=anthropic braucht ANTHROPIC_API_KEY in der .env.');
  }
  return env;
}

export const env = parseEnv(process.env);
