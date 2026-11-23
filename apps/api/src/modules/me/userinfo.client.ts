import { BadGatewayException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';
import { OidcDiscovery } from '../auth/oidc-discovery.js';

const userinfoSchema = z.object({
  sub: z.string().min(1),
  name: z.string().min(1),
  given_name: z.string().optional(),
  email: z.email(),
  // Organisation des Nutzers in Zitadel; mit Scope urn:zitadel:iam:user:resourceowner (PLT-02).
  'urn:zitadel:iam:user:resourceowner:id': z.string().min(1).optional(),
  // IN-02: Anmeldung über Microsoft oder Google. Eine Zitadel-Action ergänzt Anbieter, Subject und
  // Mandant (Entra, tid) bzw. hd (Google) aus dem Token des Anbieters; fehlt bei Passkey/Passwort.
  'urn:reziproq:idp': z
    .object({
      provider: z.enum(['entra', 'google']),
      subject: z.string().min(1).max(200),
      tenant: z.string().max(100).optional(),
      hd: z.string().max(253).optional(),
    })
    .optional(),
});

export type Userinfo = z.infer<typeof userinfoSchema>;

/** Fragt den Userinfo-Endpunkt aus der Discovery mit dem Access Token der Person ab. */
@Injectable()
export class UserinfoClient {
  constructor(@Inject(OidcDiscovery) private readonly discovery: OidcDiscovery) {}

  async fetch(accessToken: string): Promise<Userinfo> {
    const { userinfo_endpoint } = await this.discovery.get();
    let res: Response;
    try {
      res = await fetch(userinfo_endpoint, {
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new BadGatewayException('Zitadel ist nicht erreichbar.');
    }

    // Zitadel lehnt das Token ab, z. B. weil die Sitzung beendet wurde.
    if (res.status === 401 || res.status === 403) throw new UnauthorizedException();
    if (!res.ok) throw new BadGatewayException(`Zitadel antwortet mit ${res.status}.`);

    const result = userinfoSchema.safeParse(await res.json().catch(() => null));
    if (!result.success) {
      throw new BadGatewayException(
        'Zitadel liefert keinen Namen oder keine E-Mail. Fordert die Web-App die Scopes profile und email an?',
      );
    }
    return result.data;
  }
}
