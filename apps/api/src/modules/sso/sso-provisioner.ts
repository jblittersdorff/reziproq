import { createHash } from 'node:crypto';
import { BadGatewayException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import type { Env } from '../../config/env.js';

/**
 * IN-02: Anmeldung über Microsoft und Google, eingerichtet in Zitadel (Entscheidung F10): Anbieter
 * je Organisation (fester Entra-Mandant, Google mit Domain), Domains mit DNS-Bestätigung und die
 * Regel, ob die Anmeldung mit Passwort noch erlaubt ist.
 */
export interface SsoProvisioner {
  /** Legt den Anbieter an oder aktualisiert ihn; gibt seine ID in Zitadel zurück. */
  configure(input: {
    zitadelOrgId: string | null;
    provider: 'entra' | 'google';
    tenantId: string | null;
    hostedDomain: string | null;
    passwordLoginAllowed: boolean;
    idpRef: string | null;
  }): Promise<string>;
  /** Domain anmelden; der DNS-Eintrag (TXT), den der Kunde setzen muss */
  startDomain(input: {
    zitadelOrgId: string | null;
    domain: string;
  }): Promise<{ recordName: string; recordValue: string }>;
  /** Prüft den DNS-Eintrag; true, wenn die Domain bestätigt ist */
  confirmDomain(input: { zitadelOrgId: string | null; domain: string }): Promise<boolean>;
}

export const SSO_PROVISIONER = Symbol('SSO_PROVISIONER');

/**
 * Nachbau ohne Internet für Entwicklung und Tests: Jede Domain lässt sich bestätigen, außer sie
 * steht in failing. Der Eintrag ist derselbe wie bei Zitadel, nur der Wert ist ein Testwert.
 */
export class FakeSsoProvisioner implements SsoProvisioner {
  readonly failing = new Set<string>();
  readonly configured: Parameters<SsoProvisioner['configure']>[0][] = [];

  async configure(input: Parameters<SsoProvisioner['configure']>[0]) {
    this.configured.push(input);
    return input.idpRef ?? `fake-idp-${input.provider}-${input.zitadelOrgId ?? 'ohne'}`;
  }

  async startDomain(input: { domain: string }) {
    const token = createHash('sha256').update(`reziproq:${input.domain}`).digest('hex').slice(0, 32);
    return { recordName: `_zitadel-challenge.${input.domain}`, recordValue: token };
  }

  async confirmDomain(input: { domain: string }) {
    return !this.failing.has(input.domain);
  }
}

/** Im Betrieb ohne Zitadel-Zugang: Einrichten ist aus. */
export class UnavailableSsoProvisioner implements SsoProvisioner {
  private unavailable(): never {
    throw new ServiceUnavailableException({ statusCode: 503, code: 'sso_nicht_verfuegbar' });
  }
  async configure(): Promise<string> {
    return this.unavailable();
  }
  async startDomain(): Promise<{ recordName: string; recordValue: string }> {
    return this.unavailable();
  }
  async confirmDomain(): Promise<boolean> {
    return this.unavailable();
  }
}

const idpResponse = z.object({ id: z.string().min(1) });
const validationResponse = z.object({ token: z.string().min(1) });
const domainsResponse = z.object({
  result: z
    .array(z.object({ domainName: z.string(), isVerified: z.boolean().optional() }))
    .optional(),
});

/**
 * Über die Verwaltungsschnittstelle von Zitadel (Management API v1, je Organisation über
 * x-zitadel-orgid). Die App-Registrierungen von Reziproq kommen nur aus der Umgebung.
 */
export class ZitadelSsoProvisioner implements SsoProvisioner {
  private readonly logger = new Logger(ZitadelSsoProvisioner.name);

  constructor(
    private readonly issuer: string,
    private readonly token: string,
    private readonly apps: {
      entra: { clientId: string; clientSecret: string } | null;
      google: { clientId: string; clientSecret: string } | null;
    },
  ) {}

  private async call(
    method: 'POST' | 'PUT',
    path: string,
    orgId: string,
    body: unknown,
    allowStatus: number[] = [],
  ): Promise<unknown> {
    const response = await fetch(`${this.issuer}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
        accept: 'application/json',
        'x-zitadel-orgid': orgId,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (allowStatus.includes(response.status)) return { status: response.status };
    if (!response.ok) {
      // Details nur ins Log, nie an den Browser; der Inhalt kann Zugangsdaten nicht enthalten
      this.logger.error(`Zitadel ${method} ${path} antwortete mit ${response.status}`);
      throw new BadGatewayException({ statusCode: 502, code: 'identity_provider_failed' });
    }
    return response.json().catch(() => ({}));
  }

  private org(zitadelOrgId: string | null): string {
    if (!zitadelOrgId) {
      throw new ServiceUnavailableException({ statusCode: 503, code: 'organisation_ohne_zitadel' });
    }
    return zitadelOrgId;
  }

  async configure(input: Parameters<SsoProvisioner['configure']>[0]) {
    const orgId = this.org(input.zitadelOrgId);
    const app = this.apps[input.provider];
    if (!app) throw new ServiceUnavailableException({ statusCode: 503, code: 'sso_nicht_verfuegbar' });
    const options = {
      isLinkingAllowed: true,
      isCreationAllowed: true,
      isAutoCreation: true,
      isAutoUpdate: true,
    };
    // Die Organisation braucht eine eigene Login-Richtlinie; ohne sie gilt die der Instanz
    const policy = { allowUsernamePassword: input.passwordLoginAllowed, allowExternalIdp: true, allowRegister: false };
    const updated = (await this.call('PUT', '/management/v1/policies/login', orgId, policy, [404])) as {
      status?: number;
    };
    if (updated.status === 404) await this.call('POST', '/management/v1/policies/login', orgId, policy);
    let idpRef = input.idpRef;
    if (!idpRef) {
      const created =
        input.provider === 'entra'
          ? await this.call('POST', '/management/v1/idps/azure', orgId, {
              name: 'Microsoft (Firmenkonto)',
              clientId: app.clientId,
              clientSecret: app.clientSecret,
              // Fester Mandant statt „common“: Konten anderer Mandanten scheitern schon bei Microsoft
              tenant: { tenantId: input.tenantId },
              isEmailVerified: true,
              scopes: ['openid', 'profile', 'email'],
              providerOptions: options,
            })
          : await this.call('POST', '/management/v1/idps/google', orgId, {
              name: 'Google (Firmenkonto)',
              clientId: app.clientId,
              clientSecret: app.clientSecret,
              scopes: ['openid', 'profile', 'email'],
              providerOptions: options,
            });
      idpRef = idpResponse.parse(created).id;
      await this.call('POST', '/management/v1/policies/login/idps', orgId, {
        idpId: idpRef,
        ownerType: 'IDP_OWNER_TYPE_ORG',
      });
    }
    return idpRef;
  }

  async startDomain(input: { zitadelOrgId: string | null; domain: string }) {
    const orgId = this.org(input.zitadelOrgId);
    await this.call('POST', '/management/v1/orgs/me/domains', orgId, { domain: input.domain }, [409]);
    // Ohne Domain-Bestätigung in Zitadel (Durchstich) gibt es keinen Eintrag; „Domain bestätigen“
    // liest dann den Stand aus Zitadel
    const generated = validationResponse.safeParse(
      await this.call(
        'POST',
        `/management/v1/orgs/me/domains/${encodeURIComponent(input.domain)}/validation/_generate`,
        orgId,
        { type: 'DOMAIN_VALIDATION_TYPE_DNS' },
      ).catch(() => null),
    );
    return {
      recordName: `_zitadel-challenge.${input.domain}`,
      recordValue: generated.success ? generated.data.token : '–',
    };
  }

  async confirmDomain(input: { zitadelOrgId: string | null; domain: string }) {
    const orgId = this.org(input.zitadelOrgId);
    try {
      await this.call(
        'POST',
        `/management/v1/orgs/me/domains/${encodeURIComponent(input.domain)}/validation/_validate`,
        orgId,
        {},
      );
      return true;
    } catch {
      // Ist die Bestätigung in Zitadel abgeschaltet (Durchstich mit …onmicrosoft.com), gilt der Stand
      // der Domain in Zitadel
      const found = domainsResponse.safeParse(
        await this.call('POST', '/management/v1/orgs/me/domains/_search', orgId, {}).catch(() => null),
      );
      return Boolean(
        found.success &&
          found.data.result?.some((entry) => entry.domainName === input.domain && entry.isVerified),
      );
    }
  }
}

export function ssoProvisionerFor(
  config: Pick<
    Env,
    | 'NODE_ENV'
    | 'IDENTITY_PROVIDER'
    | 'ZITADEL_ISSUER'
    | 'ZITADEL_SERVICE_TOKEN'
    | 'SSO_ENTRA_CLIENT_ID'
    | 'SSO_ENTRA_CLIENT_SECRET'
    | 'SSO_GOOGLE_CLIENT_ID'
    | 'SSO_GOOGLE_CLIENT_SECRET'
  >,
): SsoProvisioner {
  if (config.IDENTITY_PROVIDER === 'zitadel' && config.ZITADEL_SERVICE_TOKEN) {
    const pair = (id?: string, secret?: string) =>
      id && secret ? { clientId: id, clientSecret: secret } : null;
    return new ZitadelSsoProvisioner(config.ZITADEL_ISSUER, config.ZITADEL_SERVICE_TOKEN, {
      entra: pair(config.SSO_ENTRA_CLIENT_ID, config.SSO_ENTRA_CLIENT_SECRET),
      google: pair(config.SSO_GOOGLE_CLIENT_ID, config.SSO_GOOGLE_CLIENT_SECRET),
    });
  }
  return config.NODE_ENV === 'production'
    ? new UnavailableSsoProvisioner()
    : new FakeSsoProvisioner();
}
