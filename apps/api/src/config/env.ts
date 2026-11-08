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

  // Das Testmodell braucht weder Schlüssel noch Internet. Echte Daten laufen über Bedrock.
  AI_PROVIDER: z.preprocess(
    emptyAsUndefined,
    z.enum(['test', 'anthropic', 'bedrock']).default('test'),
  ),
  AI_MODEL: z.preprocess(emptyAsUndefined, z.string().trim().min(1).default('claude-haiku-5-5')),
  ANTHROPIC_API_KEY: z.preprocess(emptyAsUndefined, z.string().min(1).optional()),
  AWS_REGION: z.preprocess(emptyAsUndefined, z.string().min(1).optional()),
  AI_REQUESTS_PER_MINUTE: z.preprocess(
    emptyAsUndefined,
    z.coerce.number().int().positive().default(10),
  ),
  EMAIL_SMTP_HOST: z.preprocess(emptyAsUndefined, z.string().trim().min(1).default('localhost')),
  EMAIL_SMTP_PORT: z.preprocess(emptyAsUndefined, z.coerce.number().int().positive().default(1025)),
  EMAIL_SMTP_USER: z.preprocess(emptyAsUndefined, z.string().min(1).optional()),
  EMAIL_SMTP_PASSWORD: z.preprocess(emptyAsUndefined, z.string().min(1).optional()),
  WEB_APP_URL: z.preprocess(
    emptyAsUndefined,
    z
      .url({ protocol: /^https?$/ })
      .transform((url) => url.replace(/\/+$/, ''))
      .default('http://localhost:5173'),
  ),
});

export type Env = z.infer<typeof envSchema>;

/** Prüft die Umgebungsvariablen; bei einem Fehler startet die API nicht. */
export function parseEnv(input: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse({
    ...input,
    AI_PROVIDER: input.AI_PROVIDER ?? input.KI_ANBIETER,
    AI_MODEL: input.AI_MODEL ?? input.KI_MODELL,
    AI_REQUESTS_PER_MINUTE: input.AI_REQUESTS_PER_MINUTE ?? input.KI_ANFRAGEN_PRO_MINUTE,
  });
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(
      `Fehlende oder ungültige Umgebungsvariablen: ${names.join(', ')}. ` +
        'Trage sie in die .env im Hauptordner ein (Vorlage: .env.example).',
    );
  }
  const env = result.data;
  if (env.NODE_ENV === 'production' && env.AI_PROVIDER !== 'bedrock') {
    throw new Error('Im Betrieb muss AI_PROVIDER=bedrock gesetzt sein.');
  }
  if (env.AI_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY) {
    throw new Error('AI_PROVIDER=anthropic braucht ANTHROPIC_API_KEY in der .env.');
  }
  if (env.AI_PROVIDER === 'anthropic' && !/^claude-[a-z0-9-]+$/i.test(env.AI_MODEL)) {
    throw new Error('AI_MODEL muss für Anthropic eine Claude-Modell-ID sein.');
  }
  if (env.AI_PROVIDER === 'bedrock') {
    if (!env.AWS_REGION) {
      throw new Error('AI_PROVIDER=bedrock braucht AWS_REGION.');
    }
    if (!/^(?:(?:eu|us|global)\.)?anthropic\.[a-z0-9-]+(?::\d+)?$/i.test(env.AI_MODEL)) {
      throw new Error('AI_MODEL muss für Bedrock eine Anthropic-Modell-ID sein.');
    }
    if (env.NODE_ENV === 'production' && !env.AWS_REGION.startsWith('eu-')) {
      throw new Error('Produktionsdaten dürfen nur in einer AWS-EU-Region verarbeitet werden.');
    }
  }
  if (Boolean(env.EMAIL_SMTP_USER) !== Boolean(env.EMAIL_SMTP_PASSWORD)) {
    throw new Error('EMAIL_SMTP_USER und EMAIL_SMTP_PASSWORD müssen gemeinsam gesetzt werden.');
  }
  if (env.NODE_ENV === 'production') {
    if (env.EMAIL_SMTP_HOST === 'localhost' || env.EMAIL_SMTP_HOST === '127.0.0.1') {
      throw new Error('Im Betrieb muss EMAIL_SMTP_HOST auf den Mailserver zeigen.');
    }
    if (!env.WEB_APP_URL.startsWith('https://')) {
      throw new Error('Im Betrieb muss WEB_APP_URL HTTPS verwenden.');
    }
  }
  return env;
}

export const env = parseEnv(process.env);
