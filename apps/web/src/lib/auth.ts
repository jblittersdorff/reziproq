import { WebStorageStateStore } from 'oidc-client-ts';
import type { AuthProviderNoUserManagerProps } from 'react-oidc-context';

export interface ZitadelSettings {
  issuer: string;
  clientId: string;
  projectId: string;
}

/** Liest die Zitadel-Werte; null, solange einer davon in der .env fehlt. */
export function readZitadelSettings(
  env: Record<string, string | undefined>,
): ZitadelSettings | null {
  const issuer = env.ZITADEL_ISSUER?.replace(/\/+$/, '') ?? '';
  const clientId = env.ZITADEL_CLIENT_ID ?? '';
  const projectId = env.ZITADEL_PROJECT_ID ?? '';
  if (!issuer || !clientId || !projectId) return null;
  return { issuer, clientId, projectId };
}

export const callbackPath = '/auth/callback';

/**
 * Login mit Authorization Code und PKCE über oidc-client-ts.
 * Der letzte Scope sorgt dafür, dass Zitadel die Projekt-ID als Audience ins Access Token schreibt.
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
  onSigninCallback: () => void;
}): AuthProviderNoUserManagerProps {
  return {
    authority: settings.issuer,
    client_id: settings.clientId,
    redirect_uri: `${origin}${callbackPath}`,
    post_logout_redirect_uri: origin,
    response_type: 'code',
    scope: `openid profile email urn:zitadel:iam:org:project:id:${settings.projectId}:aud`,
    userStore: new WebStorageStateStore({ store: storage }),
    onSigninCallback,
  };
}

export const zitadelSettings = readZitadelSettings(import.meta.env);
