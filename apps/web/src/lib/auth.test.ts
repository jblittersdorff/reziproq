// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { oidcConfig, readZitadelSettings, safeReturnTo } from './auth';

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
  it('nutzt Authorization Code, den Callback, openid profile email und die Projektrollen', () => {
    const settings = readZitadelSettings(env);
    if (!settings) throw new Error('Einstellungen fehlen');
    const config = oidcConfig({
      settings,
      origin: 'http://localhost:5173',
      onSigninCallback: () => {},
    });
    expect(config.response_type).toBe('code');
    expect(config.redirect_uri).toBe('http://localhost:5173/auth/callback');
    expect(config.post_logout_redirect_uri).toBe('http://localhost:5173');
    expect(config.scope).toBe(
      'openid profile email offline_access urn:zitadel:iam:org:projects:roles urn:zitadel:iam:user:resourceowner',
    );
  });

  it('PLT-01: hält Tokens nur im Speicher und erneuert sie im Hintergrund per Refresh Token', async () => {
    const settings = readZitadelSettings(env);
    if (!settings) throw new Error('Einstellungen fehlen');
    const config = oidcConfig({
      settings,
      origin: 'http://localhost:5173',
      onSigninCallback: () => {},
    });
    expect(config.automaticSilentRenew).toBe(true);
    expect(config.scope?.split(' ')).toContain('offline_access');
    expect(config.popup_redirect_uri).toBe('http://localhost:5173/auth/callback');

    const before = { local: localStorage.length, session: sessionStorage.length };
    await config.userStore?.set('oidc.user:test', 'geheimes-token');
    expect(await config.userStore?.get('oidc.user:test')).toBe('geheimes-token');
    expect({ local: localStorage.length, session: sessionStorage.length }).toEqual(before);
  });
});

describe('safeReturnTo', () => {
  it('führt nach dem Login zur ursprünglich angefragten Seite der App', () => {
    expect(safeReturnTo('/lieferanten')).toBe('/lieferanten');
    expect(safeReturnTo('/lieferanten?suche=guss#oben')).toBe('/lieferanten?suche=guss#oben');
  });

  it('nimmt keine fremden Adressen an und fällt auf die Übersicht zurück', () => {
    for (const value of [
      'https://example.com',
      '//example.com',
      '/\\example.com',
      'lieferanten',
      '/auth/callback?code=x',
      undefined,
      42,
    ]) {
      expect(safeReturnTo(value)).toBe('/uebersicht');
    }
  });
});
