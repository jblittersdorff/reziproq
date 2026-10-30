import { Injectable, NotFoundException } from '@nestjs/common';
import { and, type Database, eq, schema } from '@reziproq/db';
import { InjectDatabase } from '../../common/database.module.js';

export interface SupportOrganization {
  id: string;
  name: string;
}

/**
 * Betreiber-Zugang (PLT-13): prüft den gewählten Kunden und protokolliert jeden Zugriff.
 * Läuft vor der Mandanten-Session, weil er erst bestimmt, für welchen Kunden sie gilt.
 */
@Injectable()
export class SupportAccessService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  /** Wechselt für eine Anfrage in einen Käufer-Kunden; 404, wenn es ihn nicht gibt. */
  async enter(
    userId: string,
    organizationId: string,
    action: string,
  ): Promise<SupportOrganization> {
    const { organization } = schema;
    const [customer] = await this.db
      .select({ id: organization.id, name: organization.name })
      .from(organization)
      .where(and(eq(organization.id, organizationId), eq(organization.typ, 'kaeufer')));
    if (!customer) throw new NotFoundException('Diesen Kunden gibt es nicht.');
    await this.record(userId, customer.id, action);
    return customer;
  }

  async record(userId: string, organizationId: string | null, action: string): Promise<void> {
    await this.db
      .insert(schema.betreiberZugriff)
      .values({ nutzerId: userId, organizationId, aktion: action });
  }

  /** Alle Käufer-Organisationen mit Name und Land, für die Auswahl „Kunde wechseln“. */
  async customers(userId: string, action: string) {
    const { organization } = schema;
    await this.record(userId, null, action);
    return this.db
      .select({ id: organization.id, name: organization.name, country: organization.land })
      .from(organization)
      .where(eq(organization.typ, 'kaeufer'))
      .orderBy(organization.name);
  }
}
