import { BadGatewayException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';
import { OidcDiscovery } from '../auth/oidc-discovery.js';

const userinfoSchema = z.object({
  sub: z.string().min(1),
  name: z.string().min(1),
  email: z.email(),
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
