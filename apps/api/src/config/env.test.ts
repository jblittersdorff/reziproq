import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

const base = {
  ZITADEL_ISSUER: 'https://zitadel.test',
  ZITADEL_PROJECT_ID: 'test-project',
};

describe('parseEnv', () => {
  it('nimmt ohne Angaben das Testmodell, Claude Haiku 5.5 und 10 Anfragen je Minute', () => {
    expect(parseEnv(base)).toMatchObject({
      AI_PROVIDER: 'test',
      AI_MODEL: 'claude-haiku-5-5',
      AI_REQUESTS_PER_MINUTE: 10,
    });
  });

  it.each(['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'])(
    'lässt das Modell %s per Einstellung wählen',
    (model) => {
      expect(parseEnv({ ...base, AI_MODEL: model }).AI_MODEL).toBe(model);
    },
  );

  it('lehnt unbekannte Anbieter ab', () => {
    expect(() => parseEnv({ ...base, AI_PROVIDER: 'openai' })).toThrow(/AI_PROVIDER/);
  });

  it('übernimmt weiterhin die bisherigen KI-Variablennamen', () => {
    expect(
      parseEnv({
        ...base,
        KI_ANBIETER: 'test',
        KI_MODELL: 'claude-sonnet-5-5',
        KI_ANFRAGEN_PRO_MINUTE: '7',
      }),
    ).toMatchObject({
      AI_PROVIDER: 'test',
      AI_MODEL: 'claude-sonnet-5-5',
      AI_REQUESTS_PER_MINUTE: 7,
    });
  });

  it('startet im Betrieb ausschließlich mit Bedrock in einer EU-Region', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'production', AI_PROVIDER: 'test' })).toThrow(
      /AI_PROVIDER=bedrock/,
    );
    expect(() =>
      parseEnv({
        ...base,
        NODE_ENV: 'production',
        AI_PROVIDER: 'anthropic',
        ANTHROPIC_API_KEY: 'sk-test',
      }),
    ).toThrow(/AI_PROVIDER=bedrock/);
    expect(() =>
      parseEnv({
        ...base,
        NODE_ENV: 'production',
        AI_PROVIDER: 'bedrock',
        AI_MODEL: 'eu.anthropic.claude-haiku-5-5',
        AWS_REGION: 'us-east-1',
      }),
    ).toThrow(/EU-Region/);
    expect(
      parseEnv({
        ...base,
        NODE_ENV: 'production',
        AI_PROVIDER: 'bedrock',
        AI_MODEL: 'eu.anthropic.claude-haiku-5-5',
        AWS_REGION: 'eu-central-1',
        EMAIL_SMTP_HOST: 'smtp.example.test',
        WEB_APP_URL: 'https://app.example.test',
      }).AI_PROVIDER,
    ).toBe('bedrock');
  });

  it('verlangt für AI_PROVIDER=anthropic einen Schlüssel', () => {
    expect(() => parseEnv({ ...base, AI_PROVIDER: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/);
    expect(
      parseEnv({ ...base, AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-test' }).AI_PROVIDER,
    ).toBe('anthropic');
  });

  it('verlangt für Bedrock Region und Modell-ID', () => {
    expect(() => parseEnv({ ...base, AI_PROVIDER: 'bedrock' })).toThrow(/AWS_REGION/);
    expect(() =>
      parseEnv({
        ...base,
        AI_PROVIDER: 'bedrock',
        AWS_REGION: 'eu-central-1',
        AI_MODEL: 'claude-haiku-5-5',
      }),
    ).toThrow(/Anthropic-Modell-ID/);
  });

  it('verlangt im Betrieb SMTP und HTTPS für E-Mail-Links', () => {
    expect(() =>
      parseEnv({
        ...base,
        NODE_ENV: 'production',
        AI_PROVIDER: 'bedrock',
        AI_MODEL: 'eu.anthropic.claude-haiku-5-5',
        AWS_REGION: 'eu-central-1',
        EMAIL_SMTP_HOST: 'localhost',
        WEB_APP_URL: 'http://localhost:5173',
      }),
    ).toThrow(/EMAIL_SMTP_HOST/);
    expect(() =>
      parseEnv({
        ...base,
        NODE_ENV: 'production',
        AI_PROVIDER: 'bedrock',
        AI_MODEL: 'eu.anthropic.claude-haiku-5-5',
        AWS_REGION: 'eu-central-1',
        EMAIL_SMTP_HOST: 'smtp.example.test',
        WEB_APP_URL: 'http://app.example.test',
      }),
    ).toThrow(/HTTPS/);
  });

  it('LIF-01b: ohne Angabe gilt das nachgebaute Zitadel; zitadel braucht das Token des Dienstkontos', () => {
    expect(parseEnv(base).IDENTITY_PROVIDER).toBe('fake');
    expect(() => parseEnv({ ...base, IDENTITY_PROVIDER: 'zitadel' })).toThrow(
      /ZITADEL_SERVICE_TOKEN/,
    );
    expect(
      parseEnv({
        ...base,
        IDENTITY_PROVIDER: 'zitadel',
        ZITADEL_SERVICE_TOKEN: 'pat-0123456789abcdefghij',
      }).IDENTITY_PROVIDER,
    ).toBe('zitadel');
    expect(() => parseEnv({ ...base, IDENTITY_PROVIDER: 'keycloak' })).toThrow(/IDENTITY_PROVIDER/);
  });
});
