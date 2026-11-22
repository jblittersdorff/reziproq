import { InMemoryWebStorage, WebStorageStateStore } from 'oidc-client-ts';
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
 *
 * PLT-01: Tokens liegen nur im Speicher des Tabs, nie in localStorage oder sessionStorage.
 * offline_access liefert einen Refresh Token, mit dem die App das Access Token vor Ablauf im
 * Hintergrund erneuert. Nach einem Neuladen holt eine kurze Weiterleitung zu Zitadel die Sitzung.
 */
export function oidcConfig({
  settings,
  origin,
  onSigninCallback,
}: {
  settings: ZitadelSettings;
  origin: string;
  onSigninCallback: NonNullable<AuthProviderNoUserManagerProps['onSigninCallback']>;
}): AuthProviderNoUserManagerProps {
  return {
    authority: settings.issuer,
    client_id: settings.clientId,
    redirect_uri: `${origin}${callbackPath}`,
    post_logout_redirect_uri: origin,
    response_type: 'code',
    // Projektrollen ins Token (PLT-13) und die Zitadel-Organisation des Nutzers für die Zuordnung
    // zur Organisation beim Login (PLT-02).
    scope:
      'openid profile email offline_access urn:zitadel:iam:org:projects:roles urn:zitadel:iam:user:resourceowner',
    userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
    automaticSilentRenew: true,
    onSigninCallback,
  };
}

export const zitadelSettings = readZitadelSettings(import.meta.env);

/**
 * Wohin es nach dem Login geht: die Seite, die der Nutzer öffnen wollte (PLT-01).
 * Nur Pfade dieser App; fremde Adressen wie //example.com würden sonst zum offenen Redirect.
 */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/';
  }
  if (value.startsWith(callbackPath)) return '/';
  return value;
}

/** Merkt sich beim Start der Anmeldung die aktuelle Seite, standardmäßig die Adresse im Browser. */
export const signInState = (
  returnTo = window.location.pathname + window.location.search + window.location.hash,
) => ({ returnTo });

// Nach dem Abmelden nicht sofort wieder zu Zitadel weiterleiten, sondern „Anmelden“ zeigen (PLT-01).
// Nur ein Merker im Tab, kein Token. sessionStorage kann fehlen; dann gilt der Merker nicht.
const signedOutKey = 'reziproq-abgemeldet';

export const signedOut = {
  mark() {
    try {
      window.sessionStorage.setItem(signedOutKey, '1');
    } catch {}
  },
  isSet(): boolean {
    try {
      return window.sessionStorage.getItem(signedOutKey) === '1';
    } catch {
      return false;
    }
  },
  clear() {
    try {
      window.sessionStorage.removeItem(signedOutKey);
    } catch {}
  },
};
