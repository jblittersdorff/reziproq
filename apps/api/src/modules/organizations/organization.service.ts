import { Injectable } from '@nestjs/common';
import { type Database, eq, schema } from '@reziproq/db';
import { InjectDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';

export interface CurrentOrganization {
  id: string;
  name: string;
  typ: 'kaeufer' | 'lieferant';
}

/**
 * Zu welcher Organisation eine Person gehört. Diese Abfrage läuft vor der Mandanten-Session,
 * weil sie erst bestimmt, für welche Organisation die Session gilt.
 */
@Injectable()
export class OrganizationService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  /**
   * Die Organisation, für die eine Anfrage gilt: in der Betreiber-Ansicht der gewählte Kunde
   * (PLT-13), sonst die eigene Organisation der Person.
   */
  async current(auth: AuthContext): Promise<CurrentOrganization | null> {
    if (auth.supportOrganization) return { ...auth.supportOrganization, typ: 'kaeufer' };
    return this.forUser(auth.userId);
  }

  async forUser(userId: string): Promise<CurrentOrganization | null> {
    const { appUser, organization } = schema;
    const [row] = await this.db
      .select({ id: organization.id, name: organization.name, typ: organization.typ })
      .from(appUser)
      .innerJoin(organization, eq(organization.id, appUser.organizationId))
      .where(eq(appUser.id, userId));
    return row ?? null;
  }
}
