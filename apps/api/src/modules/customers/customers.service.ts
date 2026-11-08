import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  type CustomerList,
  type CustomerWorkspace,
  customerListSchema,
  customerWorkspaceSchema,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

/** Eine aktive Beziehung, in der die eigene Organisation Lieferant ist. */
export interface OwnCustomer {
  relationshipId: string;
  buyerOrgId: string;
  name: string;
}

/**
 * LIF-02: Kunden und Arbeitsbereich der Lieferantenseite. Ohne Kundenkontext liefert die Datenbank
 * nur app_meine_kunden(); alles Beziehungsbezogene läuft in einer Session mit
 * app.customer_org_id, die die restriktive Policy aus PLT-04 auf diesen einen Kunden begrenzt.
 */
@Injectable()
export class CustomersService {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  /** Nur Organisationen ohne Käuferfunktionen; Käufer arbeiten unter /lieferanten. */
  private supplier(auth: AuthContext): AccountOrganization {
    const organization = auth.organization;
    if (!organization || organization.buyer) throw forbidden();
    return organization;
  }

  /**
   * Die eigenen Kunden, nach Name. Für die Liste, die Startseite und die Wahl des Kontexts. Käufer
   * haben hier keine Kunden: Sie arbeiten unter /lieferanten.
   */
  async customersOf(auth: AuthContext): Promise<OwnCustomer[]> {
    if (auth.organization?.buyer) return [];
    const organization = this.supplier(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, (tx) =>
      readCustomers(tx),
    );
  }

  async list(auth: AuthContext): Promise<CustomerList> {
    const customers = await this.customersOf(auth);
    return customerListSchema.parse({
      customers: customers.map((customer) => ({
        relationshipId: customer.relationshipId,
        name: customer.name,
        nextMeeting: null,
      })),
    });
  }

  /** Arbeit im Kontext genau eines Kunden; eine fremde oder beendete Beziehung gibt 404. */
  async inCustomer<T>(
    auth: AuthContext,
    relationshipId: string,
    work: (tx: TenantTransaction, customer: OwnCustomer) => Promise<T>,
  ): Promise<T> {
    const organization = this.supplier(auth);
    const customer = (await this.customersOf(auth)).find(
      (entry) => entry.relationshipId === relationshipId,
    );
    if (!customer) throw notFound();
    return this.tenant.run(
      {
        userId: auth.userId,
        organizationId: organization.id,
        customerOrganizationId: customer.buyerOrgId,
      },
      (tx) => work(tx, customer),
    );
  }

  workspace(auth: AuthContext, relationshipId: string): Promise<CustomerWorkspace> {
    return this.inCustomer(auth, relationshipId, async (tx, customer) => {
      // Im Kontext des Kunden sieht die Lieferantenseite die Beziehung selbst (PLT-04).
      const [relationship] = await tx
        .select({ id: schema.relationship.id })
        .from(schema.relationship)
        .where(eq(schema.relationship.id, relationshipId));
      if (!relationship) throw notFound();
      return customerWorkspaceSchema.parse({
        relationshipId,
        name: customer.name,
        relationshipType: null,
        nextMeeting: null,
      });
    });
  }
}

async function readCustomers(tx: TenantTransaction): Promise<OwnCustomer[]> {
  const result = await tx.execute<{ relationship_id: string; buyer_org_id: string; name: string }>(
    sql`select k.relationship_id, k.buyer_org_id, o.name
        from app_meine_kunden() k
        join ${schema.organization} o on o.id = k.buyer_org_id
        order by o.name`,
  );
  return result.rows.map((row) => ({
    relationshipId: row.relationship_id,
    buyerOrgId: row.buyer_org_id,
    name: row.name,
  }));
}
