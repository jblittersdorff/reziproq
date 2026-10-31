import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { asc, eq, schema } from '@reziproq/db';
import type { OrganizationResponse } from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';

@Injectable()
export class OrganizationService {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  /**
   * Die Organisation, für die eine Anfrage gilt. Der Guard stellt sie vor der Mandanten-Session
   * fest: in der Betreiber-Ansicht der gewählte Kunde (PLT-13), sonst die eigene (PLT-02).
   */
  current(auth: AuthContext): AccountOrganization | null {
    return auth.organization;
  }

  /**
   * Name, Land und Mitglieder. Welche Mitglieder sichtbar sind, entscheidet allein Row-Level
   * Security auf app_user: die Abfrage selbst filtert nicht nach Organisation.
   */
  async withMembers(auth: AuthContext): Promise<OrganizationResponse> {
    const organization = this.current(auth);
    if (!organization) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_organisation' });
    }
    const members = await this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      (tx) =>
        tx
          .select({ name: schema.appUser.name, email: schema.appUser.email })
          .from(schema.appUser)
          .where(eq(schema.appUser.organizationId, organization.id))
          .orderBy(asc(schema.appUser.name)),
    );
    return { name: organization.name, country: organization.country, members };
  }
}
