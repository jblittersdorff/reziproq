import { BadGatewayException, Logger } from '@nestjs/common';
import { z } from 'zod';
import type { IdentityProvisioner } from './identity-provisioner.js';

// LIF-01b: Organisation und Person über die Zitadel-Verwaltungsschnittstelle (API v2) anlegen.
// Pfade und Felder nach proto/zitadel/org/v2/org_service.proto und user/v2/user_service.proto.
// Das Token des Dienstkontos kommt nur aus der Umgebung (ZITADEL_SERVICE_TOKEN).

const organizationResponse = z.object({ organizationId: z.string().min(1) });
const userResponse = z.object({ userId: z.string().min(1) });
const usersResponse = z.object({
  result: z.array(z.object({ userId: z.string().min(1) })).optional(),
});
const passkeysResponse = z.object({ result: z.array(z.unknown()).optional() });
const registrationCodeResponse = z.object({
  code: z.object({ id: z.string().min(1), code: z.string().min(1) }),
});

/** Fehler der Schnittstelle mit HTTP-Status, damit Konflikte (409) gezielt behandelt werden. */
class ZitadelError extends Error {
  constructor(
    readonly path: string,
    readonly status: number,
  ) {
    super(`Zitadel ${path} antwortete mit ${status}`);
  }
}

const failed = () =>
  new BadGatewayException({
    statusCode: 502,
    code: 'identity_provider_failed',
    message:
      'Die Anmeldung konnte gerade nicht eingerichtet werden. Bitte versuche es gleich noch einmal.',
  });

/** Vor- und Nachname für Zitadel; beide sind Pflicht. Ein einzelnes Wort gilt für beide. */
export function splitName(name: string) {
  const parts = name.trim().split(/\s+/u);
  const givenName = parts[0] ?? name.trim();
  const familyName = parts.length > 1 ? parts.slice(1).join(' ') : givenName;
  return { givenName, familyName };
}

export class ZitadelIdentityProvisioner implements IdentityProvisioner {
  private readonly logger = new Logger(ZitadelIdentityProvisioner.name);

  constructor(
    private readonly issuer: string,
    private readonly token: string,
    private readonly timeoutMs = 10_000,
  ) {}

  private async call<T extends z.ZodType>(
    path: string,
    body: unknown,
    schema: T,
  ): Promise<z.output<T>> {
    const response = await fetch(`${this.issuer}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new ZitadelError(path, response.status);
    return schema.parse(await response.json());
  }

  /** Jede unerwartete Antwort wird ein 502; Details nur ins Log, nie an den Browser. */
  private async guarded<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
      throw failed();
    }
  }

  ensureOrganization(input: { supplierOrgId: string; name: string; existingId: string | null }) {
    if (input.existingId) return Promise.resolve(input.existingId);
    return this.guarded(async () => {
      try {
        return (await this.call('/v2/organizations', { name: input.name }, organizationResponse))
          .organizationId;
      } catch (error) {
        // Organisationsnamen sind in Zitadel eindeutig; bei gleichem Namen die eigene ID anhängen.
        if (!(error instanceof ZitadelError && error.status === 409)) throw error;
        const name = `${input.name} (${input.supplierOrgId.slice(0, 8)})`;
        return (await this.call('/v2/organizations', { name }, organizationResponse))
          .organizationId;
      }
    });
  }

  createUser(input: { zitadelOrgId: string; email: string; name: string }) {
    return this.guarded(async () => {
      const existing = await this.findUser(input.zitadelOrgId, input.email);
      if (existing && (await this.hasPasskey(existing))) {
        // Schon eingerichtet (z. B. vom ersten Kunden): einfach anmelden.
        return { userId: existing, passkeySetupUrl: '/start' };
      }
      const userId =
        existing ??
        (
          await this.call(
            '/v2/users/human',
            {
              organization: { orgId: input.zitadelOrgId },
              profile: splitName(input.name),
              // Die Adresse ist durch den Link in der Einladung bestätigt.
              email: { email: input.email, isVerified: true },
            },
            userResponse,
          )
        ).userId;
      const { code } = await this.call(
        `/v2/users/${encodeURIComponent(userId)}/passkeys/registration_link`,
        { returnCode: {} },
        registrationCodeResponse,
      );
      return { userId, passkeySetupUrl: this.passkeyUrl(userId, input.zitadelOrgId, code) };
    });
  }

  private async findUser(orgId: string, email: string): Promise<string | null> {
    const { result } = await this.call(
      '/v2/users',
      {
        queries: [
          { emailQuery: { emailAddress: email, method: 'TEXT_QUERY_METHOD_EQUALS_IGNORE_CASE' } },
          { organizationIdQuery: { organizationId: orgId } },
        ],
      },
      usersResponse,
    );
    return result?.[0]?.userId ?? null;
  }

  private async hasPasskey(userId: string): Promise<boolean> {
    const { result } = await this.call(
      `/v2/users/${encodeURIComponent(userId)}/passkeys/_search`,
      {},
      passkeysResponse,
    );
    return (result?.length ?? 0) > 0;
  }

  /** Die Seite des gehosteten Logins, die Zitadel auch in seinen eigenen Mails verlinkt. */
  private passkeyUrl(userId: string, orgId: string, code: { id: string; code: string }) {
    const url = new URL('/ui/login/login/passwordless/init', this.issuer);
    url.searchParams.set('userID', userId);
    url.searchParams.set('orgID', orgId);
    url.searchParams.set('codeID', code.id);
    url.searchParams.set('code', code.code);
    return url.toString();
  }
}
