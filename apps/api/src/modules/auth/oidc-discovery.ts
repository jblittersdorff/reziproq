import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AUTH_OPTIONS, type AuthOptions } from './token-verifier.js';

export const DISCOVERY_URL = Symbol('DISCOVERY_URL');

const metadataSchema = z.object({
  issuer: z.string(),
  jwks_uri: z.url(),
  userinfo_endpoint: z.url(),
});

export type OidcMetadata = z.infer<typeof metadataSchema>;

/**
 * Liest die Adressen von Zitadel aus dem Discovery-Dokument des Issuers.
 * Geladen wird beim ersten Bedarf; danach gilt das Ergebnis, bis die API neu startet.
 * Schlägt das Laden fehl, wird es beim nächsten Bedarf erneut versucht.
 */
@Injectable()
export class OidcDiscovery {
  private metadata: Promise<OidcMetadata> | undefined;

  constructor(
    @Inject(DISCOVERY_URL) private readonly url: string,
    @Inject(AUTH_OPTIONS) private readonly options: AuthOptions,
  ) {}

  get(): Promise<OidcMetadata> {
    this.metadata ??= this.load().catch((error: unknown) => {
      this.metadata = undefined;
      throw error;
    });
    return this.metadata;
  }

  private async load(): Promise<OidcMetadata> {
    let res: Response;
    try {
      res = await fetch(this.url, { signal: AbortSignal.timeout(5000) });
    } catch {
      throw new BadGatewayException('Zitadel ist nicht erreichbar.');
    }
    if (!res.ok) throw new BadGatewayException(`Zitadel-Discovery antwortet mit ${res.status}.`);

    const result = metadataSchema.safeParse(await res.json().catch(() => null));
    if (!result.success)
      throw new BadGatewayException('Das Zitadel-Discovery-Dokument ist unvollständig.');
    // Nur Adressen vom erwarteten Issuer verwenden (OpenID Connect Discovery 4.3).
    if (result.data.issuer.replace(/\/+$/, '') !== this.options.issuer) {
      throw new BadGatewayException(
        'Das Zitadel-Discovery-Dokument gehört zu einem anderen Issuer.',
      );
    }
    return result.data;
  }
}
