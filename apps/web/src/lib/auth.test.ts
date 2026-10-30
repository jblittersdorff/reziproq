import { describe, expect, it } from 'vitest';
import { oidcConfig, readZitadelSettings } from './auth';

const env = {
  ZITADEL_ISSUER: 'https://reziproq.zitadel.test/',
  ZITADEL_CLIENT_ID: 'client-1',
};

describe('readZitadelSettings', () => {
  it('liest beide Werte und entfernt den Schrägstrich am Ende', () => {
    expect(readZitadelSettings(env)).toEqual({
      issuer: 'https://reziproq.zitadel.test',
      clientId: 'client-1',
    });
  });

  it('gibt null zurück, wenn ein Wert fehlt', () => {
    expect(readZitadelSettings({ ...env, ZITADEL_CLIENT_ID: '' })).toBeNull();
    expect(readZitadelSettings({})).toBeNull();
  });
});

describe('oidcConfig', () => {
  it('nutzt Authorization Code, den Callback und die Scopes openid profile email', () => {
    const settings = readZitadelSettings(env);
    if (!settings) throw new Error('Einstellungen fehlen');
    const config = oidcConfig({
      settings,
      origin: 'http://localhost:5173',
      storage: {} as Storage,
      onSigninCallback: () => {},
    });
    expect(config.response_type).toBe('code');
    expect(config.redirect_uri).toBe('http://localhost:5173/auth/callback');
    expect(config.post_logout_redirect_uri).toBe('http://localhost:5173');
    expect(config.scope).toBe('openid profile email');
  });
});
