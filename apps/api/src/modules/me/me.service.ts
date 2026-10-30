import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { type Database, schema, sql } from '@reziproq/db';
import type { MeResponse } from '@reziproq/shared';
import { InjectDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { OrganizationService } from '../organizations/organization.service.js';
import { UserinfoClient } from './userinfo.client.js';

const { appUser } = schema;

@Injectable()
export class MeService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    @Inject(UserinfoClient) private readonly userinfo: UserinfoClient,
    @Inject(OrganizationService) private readonly organizations: OrganizationService,
  ) {}

  /**
   * Holt Name, Vorname und E-Mail von Zitadel, speichert sie in app_user und liefert den
   * gespeicherten Stand zusammen mit den Rechten der Person.
   */
  async syncFromUserinfo(auth: AuthContext): Promise<MeResponse> {
    const info = await this.userinfo.fetch(auth.accessToken);
    // Userinfo muss zur selben Person gehören wie das Token (OpenID Connect Core 5.3.2).
    if (info.sub !== auth.userId) throw new UnauthorizedException();

    const values = { name: info.name, givenName: info.given_name || null, email: info.email };
    const [user] = await this.db
      .insert(appUser)
      .values({ id: auth.userId, ...values })
      .onConflictDoUpdate({ target: appUser.id, set: { ...values, updatedAt: sql`now()` } })
      .returning({ name: appUser.name, givenName: appUser.givenName, email: appUser.email });
    if (!user) throw new Error('app_user wurde nicht gespeichert.');
    const organization = await this.organizations.current(auth);

    return {
      name: user.name,
      firstName: user.givenName || firstWord(user.name),
      email: user.email,
      organization: organization && { id: organization.id, name: organization.name },
      supportView: auth.supportOrganization !== undefined,
      permissions: {
        viewOrganizationSettings: can(auth, 'organisation.einstellungen.sehen'),
        // Lieferanten nur für Käufer mit Rolle; so fragt die Oberfläche die Liste gar nicht erst an.
        viewSuppliers: organization?.typ === 'kaeufer' && can(auth, 'lieferanten.sehen'),
        switchCustomer: can(auth, 'kunden.wechseln'),
      },
    };
  }
}

function firstWord(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
