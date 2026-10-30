import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

const base = {
  ZITADEL_ISSUER: 'https://zitadel.test',
  ZITADEL_PROJECT_ID: 'test-project',
};

describe('parseEnv', () => {
  it('nimmt ohne Angaben das Testmodell, Claude Haiku 5.5 und 10 Anfragen je Minute', () => {
    expect(parseEnv(base)).toMatchObject({
      KI_ANBIETER: 'test',
      KI_MODELL: 'claude-haiku-5-5',
      KI_ANFRAGEN_PRO_MINUTE: 10,
    });
  });

  it.each(['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'])(
    'lässt das Modell %s per Einstellung wählen',
    (model) => {
      expect(parseEnv({ ...base, KI_MODELL: model }).KI_MODELL).toBe(model);
    },
  );

  it('lehnt unbekannte Modelle und Anbieter ab', () => {
    expect(() => parseEnv({ ...base, KI_MODELL: 'gpt-5' })).toThrow(/KI_MODELL/);
    expect(() => parseEnv({ ...base, KI_ANBIETER: 'bedrock' })).toThrow(/KI_ANBIETER/);
  });

  it('startet nicht mit KI_ANBIETER=anthropic und NODE_ENV=production', () => {
    expect(() =>
      parseEnv({
        ...base,
        NODE_ENV: 'production',
        KI_ANBIETER: 'anthropic',
        ANTHROPIC_API_KEY: 'sk-test',
      }),
    ).toThrow(/nicht erlaubt/);
  });

  it('verlangt für KI_ANBIETER=anthropic einen Schlüssel', () => {
    expect(() => parseEnv({ ...base, KI_ANBIETER: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/);
    expect(
      parseEnv({ ...base, KI_ANBIETER: 'anthropic', ANTHROPIC_API_KEY: 'sk-test' }).KI_ANBIETER,
    ).toBe('anthropic');
  });
});
