import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, schema, type TenantTransaction } from '@reziproq/db';
import type { AuditEntry, AuditQuery, AuditResponse } from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CustomersService } from '../customers/customers.service.js';
import { auditedObjectByType } from './audited-objects.js';

@Injectable()
export class AuditService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(CustomersService) private readonly customers: CustomersService,
  ) {}

  /**
   * Verlauf eines Objekts, neueste zuerst. Welche Einträge sichtbar sind, entscheidet allein
   * Row-Level Security auf audit_event, mit denselben Ebenen wie das Objekt (PLT-04).
   */
  async history(auth: AuthContext, query: AuditQuery): Promise<AuditResponse> {
    // Das Recht prüft der Guard (@Requires); hier nur, ob es eine Organisation gibt.
    if (!auth.organization) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    }
    // Mehrere Typen mit Komma, z. B. relationship,relationship_side für die Profilseite.
    const types = query.object_type.split(',');
    if (!types.every((type) => auditedObjectByType(type))) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'kein_verlauf',
        message: 'Für diesen Objekttyp gibt es keinen Verlauf.',
      });
    }
    const { auditEvent, organization } = schema;
    const read = (tx: TenantTransaction) =>
      tx
        .select({
          id: auditEvent.id,
          occurredAt: auditEvent.occurredAt,
          actorName: auditEvent.actorName,
          organization: organization.name,
          action: auditEvent.action,
          changes: auditEvent.changes,
        })
        .from(auditEvent)
        .innerJoin(organization, eq(organization.id, auditEvent.actorOrgId))
        .where(and(inArray(auditEvent.objectType, types), eq(auditEvent.objectId, query.object_id)))
        .orderBy(desc(auditEvent.occurredAt), desc(auditEvent.id));
    // Die Lieferantenseite sieht geteilte Einträge nur im Kontext ihres Kunden (PLT-04, JBP-03).
    const rows =
      query.relationship_id && !auth.organization.buyer
        ? await this.customers.inCustomer(auth, query.relationship_id, (tx) => read(tx))
        : await this.tenant.run(
            { userId: auth.userId, organizationId: auth.organization.id },
            read,
          );
    return {
      entries: rows.map(
        (row): AuditEntry => ({ ...row, occurredAt: row.occurredAt.toISOString() }),
      ),
    };
  }
}
