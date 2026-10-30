import { WebStorageStateStore } from 'oidc-client-ts';
import type { AuthProviderNoUserManagerProps } from 'react-oidc-context';

export interface ZitadelSettings {
  issuer: string;
  clientId: string;
}

/** Liest die Zitadel-Werte; null, solange einer davon in der .env fehlt. */
export function readZitadelSettings(
  env: Record<string, string | undefined>,
): ZitadelSettings | null {
  const issuer = env.ZITADEL_ISSUER?.replace(/\/+$/, '') ?? '';
  const clientId = env.ZITADEL_CLIENT_ID ?? '';
  if (!issuer || !clientId) return null;
  return { issuer, clientId };
}

export const callbackPath = '/auth/callback';

/**
 * Login mit Authorization Code und PKCE über oidc-client-ts. Zitadel schreibt die Projekt-ID
 * von sich aus in die Audience; profile und email braucht die API für den Userinfo-Endpunkt.
 */
export function oidcConfig({
  settings,
  origin,
  storage,
  onSigninCallback,
}: {
  settings: ZitadelSettings;
  origin: string;
  /** Die Sitzung endet mit dem Tab, wenn hier sessionStorage übergeben wird. */
  storage: Storage;
  onSigninCallback: NonNullable<AuthProviderNoUserManagerProps['onSigninCallback']>;
}): AuthProviderNoUserManagerProps {
  return {
    authority: settings.issuer,
    client_id: settings.clientId,
    redirect_uri: `${origin}${callbackPath}`,
    post_logout_redirect_uri: origin,
    response_type: 'code',
    // Der letzte Scope lässt Zitadel die Projektrollen ins Token schreiben (PLT-13).
    scope: 'openid profile email urn:zitadel:iam:org:projects:roles',
    userStore: new WebStorageStateStore({ store: storage }),
    onSigninCallback,
  };
}

export const zitadelSettings = readZitadelSettings(import.meta.env);

/**
 * Wohin es nach dem Login geht: die Seite, die der Nutzer öffnen wollte (PLT-01).
 * Nur Pfade dieser App; fremde Adressen wie //example.com würden sonst zum offenen Redirect.
 */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string') return '/uebersicht';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/uebersicht';
  }
  if (value.startsWith(callbackPath)) return '/uebersicht';
  return value;
}

/** Merkt sich beim Start der Anmeldung die aktuelle Seite. */
export const signInState = () => ({
  returnTo: window.location.pathname + window.location.search + window.location.hash,
});
