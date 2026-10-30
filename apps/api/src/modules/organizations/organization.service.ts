import { Injectable } from '@nestjs/common';
import { type Database, eq, schema } from '@reziproq/db';
import { InjectDatabase } from '../../common/database.module.js';

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
