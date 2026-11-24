import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  auditedChange,
  currentTime,
  desc,
  eq,
  inArray,
  schema,
  type TenantTransaction,
} from '@reziproq/db';
import type { SaveTouchpoint, Touchpoint, TouchpointList } from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import {
  touchpointAudit,
  touchpointInternalAudit,
  touchpointReviewAudit,
} from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { CustomersService } from '../customers/customers.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

/** Wo gearbeitet wird; nur der Käufer legt Kontaktpunkte an. */
export interface TouchpointScope {
  tx: TenantTransaction;
  auth: AuthContext;
  side: 'buyer' | 'supplier';
  orgId: string;
  relationshipId: string;
  canEdit: boolean;
}

type Row = typeof schema.touchpoint.$inferSelect;

const toItem = (row: Row): Touchpoint => ({
  id: row.id,
  visibility: row.visibility,
  buyerUserId: row.buyerUserId,
  buyerName: row.buyerName,
  buyerLevel: row.buyerLevel,
  supplierContactId: row.supplierContactId,
  supplierName: row.supplierName,
  supplierLevel: row.supplierLevel,
  format: row.format,
  cadence: row.cadence,
  notes: row.notes,
});

const auditValues = (row: Row): Record<string, unknown> => ({
  buyer_name: row.buyerName,
  buyer_level: row.buyerLevel,
  supplier_name: row.supplierName,
  supplier_level: row.supplierLevel,
  format: row.format,
  cadence: row.cadence,
  visibility: row.visibility,
});

const auditOf = (visibility: 'internal' | 'shared') =>
  visibility === 'shared' ? touchpointAudit : touchpointInternalAudit;

const normalize = (text: string) => text.trim().toLocaleLowerCase('de');

/**
 * PLB-06: Kontaktpunkte einer Beziehung. Der Käufer pflegt sie; geteilte sieht der Lieferant (RLS).
 * Eine geteilte Zeile verweist nie auf einen Kontakt des Lieferanten (käuferprivat, PLT-07).
 */
@Injectable()
export class TouchpointsService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(CustomersService) private readonly customers: CustomersService,
  ) {}

  /** Käufer: Admin oder wer im Team ist; nie mit Teamrolle Leser, nie bei beendeter Beziehung. */
  buyer<T>(
    auth: AuthContext,
    relationshipId: string,
    work: (scope: TouchpointScope) => Promise<T>,
  ) {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const [relationship] = await tx
        .select({ status: schema.relationship.status })
        .from(schema.relationship)
        .where(
          and(
            eq(schema.relationship.id, relationshipId),
            eq(schema.relationship.buyerOrgId, organization.id),
          ),
        );
      if (!relationship) throw notFound();
      const [member] = await tx
        .select({ teamRole: schema.relationshipMember.teamRole })
        .from(schema.relationshipMember)
        .where(
          and(
            eq(schema.relationshipMember.relationshipId, relationshipId),
            eq(schema.relationshipMember.orgId, organization.id),
            eq(schema.relationshipMember.userId, auth.userId),
          ),
        );
      const canEdit =
        relationship.status !== 'ended' &&
        can(auth, 'kontaktpunkte.bearbeiten', { teamRole: member?.teamRole ?? null }) &&
        (auth.orgRole === 'admin' || member !== undefined);
      return work({ tx, auth, side: 'buyer', orgId: organization.id, relationshipId, canEdit });
    });
  }

  /** Lieferant: im Kontext des Kunden, nur lesend; RLS zeigt nur geteilte Zeilen. */
  supplier<T>(
    auth: AuthContext,
    relationshipId: string,
    work: (scope: TouchpointScope) => Promise<T>,
  ) {
    return this.customers.inCustomer(auth, relationshipId, (tx) =>
      work({
        tx,
        auth,
        side: 'supplier',
        orgId: auth.organization?.id as string,
        relationshipId,
        canEdit: false,
      }),
    );
  }

  async list(scope: TouchpointScope): Promise<TouchpointList> {
    const { tx, relationshipId } = scope;
    const rows = await tx
      .select()
      .from(schema.touchpoint)
      .where(eq(schema.touchpoint.relationshipId, relationshipId))
      .orderBy(asc(schema.touchpoint.buyerLevel), asc(schema.touchpoint.createdAt));
    const touchpoints = rows.map(toItem);
    if (scope.side === 'supplier') {
      return {
        touchpoints,
        gaps: [],
        formats: [],
        people: [],
        contacts: [],
        canEdit: false,
        review: null,
        canReview: false,
      };
    }
    const formats = await this.agreedFormats(tx, relationshipId);
    const names = new Set(touchpoints.map((touchpoint) => normalize(touchpoint.format)));
    const gaps = formats
      .filter(
        (format) =>
          !names.has(normalize(format.title.de)) && !names.has(normalize(format.title.en)),
      )
      .map(({ title, level }) => ({ title, level }));
    const cycle = await this.activeCycle(tx, relationshipId);
    const [review] = cycle
      ? await tx
          .select()
          .from(schema.touchpointReview)
          .where(eq(schema.touchpointReview.cycleId, cycle))
      : [];
    return {
      touchpoints,
      gaps,
      formats,
      people: scope.canEdit
        ? await tx
            .select({ userId: schema.appUser.id, name: schema.appUser.name })
            .from(schema.appUser)
            .where(eq(schema.appUser.organizationId, scope.orgId))
            .orderBy(asc(schema.appUser.name))
        : [],
      contacts: scope.canEdit
        ? await tx
            .select({ id: schema.supplierContact.id, name: schema.supplierContact.name })
            .from(schema.supplierContact)
            .where(eq(schema.supplierContact.relationshipId, relationshipId))
            .orderBy(asc(schema.supplierContact.name))
        : [],
      canEdit: scope.canEdit,
      review: review
        ? { reviewedAt: review.reviewedAt.toISOString(), reviewedByName: review.reviewedByName }
        : null,
      canReview: scope.canEdit && cycle !== null && !review,
    };
  }

  async get(scope: TouchpointScope, id: string): Promise<Touchpoint> {
    return toItem(await this.row(scope, id));
  }

  async create(scope: TouchpointScope, input: SaveTouchpoint): Promise<Touchpoint> {
    this.editable(scope);
    const values = await this.values(scope, input);
    const actor = await actorOf(scope.tx, scope.auth, scope.orgId);
    return auditedChange(scope.tx, actor, auditOf(input.visibility), async () => {
      const [row] = await scope.tx
        .insert(schema.touchpoint)
        .values({
          ...values,
          relationshipId: scope.relationshipId,
          ownerOrgId: scope.orgId,
          createdBy: scope.auth.userId,
        })
        .returning();
      if (!row) throw new Error('Kontaktpunkt nicht angelegt');
      return {
        objectId: row.id,
        relationshipId: scope.relationshipId,
        action: 'created' as const,
        after: auditValues(row),
        result: toItem(row),
      };
    });
  }

  async update(scope: TouchpointScope, id: string, input: SaveTouchpoint): Promise<Touchpoint> {
    this.editable(scope);
    const before = await this.row(scope, id);
    const values = await this.values(scope, input);
    const actor = await actorOf(scope.tx, scope.auth, scope.orgId);
    return auditedChange(scope.tx, actor, auditOf(input.visibility), async () => {
      const [row] = await scope.tx
        .update(schema.touchpoint)
        .set({ ...values, updatedAt: currentTime() })
        .where(eq(schema.touchpoint.id, id))
        .returning();
      if (!row) throw notFound();
      return {
        objectId: id,
        relationshipId: scope.relationshipId,
        action:
          before.visibility !== row.visibility && row.visibility === 'shared'
            ? ('shared' as const)
            : ('updated' as const),
        before: auditValues(before),
        after: auditValues(row),
        result: toItem(row),
      };
    });
  }

  /** Teilen: die Zeile wird geteilt; ein Verweis auf einen Kontakt fällt weg, der Name bleibt. */
  async share(scope: TouchpointScope, id: string): Promise<Touchpoint> {
    this.editable(scope);
    const before = await this.row(scope, id);
    const actor = await actorOf(scope.tx, scope.auth, scope.orgId);
    return auditedChange(scope.tx, actor, touchpointAudit, async () => {
      const [row] = await scope.tx
        .update(schema.touchpoint)
        .set({ visibility: 'shared', supplierContactId: null, updatedAt: currentTime() })
        .where(eq(schema.touchpoint.id, id))
        .returning();
      if (!row) throw notFound();
      return {
        objectId: id,
        relationshipId: scope.relationshipId,
        action: 'shared' as const,
        before: auditValues(before),
        after: auditValues(row),
        result: toItem(row),
      };
    });
  }

  async remove(scope: TouchpointScope, id: string): Promise<TouchpointList> {
    this.editable(scope);
    const before = await this.row(scope, id);
    const actor = await actorOf(scope.tx, scope.auth, scope.orgId);
    await auditedChange(scope.tx, actor, auditOf(before.visibility), async () => {
      await scope.tx.delete(schema.touchpoint).where(eq(schema.touchpoint.id, id));
      return {
        objectId: id,
        relationshipId: scope.relationshipId,
        action: 'ended' as const,
        before: auditValues(before),
        result: undefined,
      };
    });
    return this.list(scope);
  }

  /** Kontaktpunkte geprüft: erledigt den Zyklus-Schritt Kontaktpunkte (ZYK-01). */
  async review(scope: TouchpointScope): Promise<TouchpointList> {
    this.editable(scope);
    const cycle = await this.activeCycle(scope.tx, scope.relationshipId);
    if (!cycle) throw new ConflictException({ statusCode: 409, code: 'kein_zyklus' });
    const actor = await actorOf(scope.tx, scope.auth, scope.orgId);
    await auditedChange(scope.tx, actor, touchpointReviewAudit, async () => {
      const [row] = await scope.tx
        .insert(schema.touchpointReview)
        .values({
          relationshipId: scope.relationshipId,
          cycleId: cycle,
          reviewedBy: scope.auth.userId,
          reviewedByName: actor.name,
        })
        .onConflictDoNothing()
        .returning({ id: schema.touchpointReview.id });
      return {
        objectId: row?.id ?? cycle,
        relationshipId: scope.relationshipId,
        action: 'created' as const,
        after: { cycle_id: cycle },
        result: undefined,
      };
    });
    return this.list(scope);
  }

  private editable(scope: TouchpointScope) {
    if (scope.side !== 'buyer' || !scope.canEdit) throw forbidden();
  }

  private async row(scope: TouchpointScope, id: string): Promise<Row> {
    const [row] = await scope.tx
      .select()
      .from(schema.touchpoint)
      .where(
        and(
          eq(schema.touchpoint.id, id),
          eq(schema.touchpoint.relationshipId, scope.relationshipId),
        ),
      );
    if (!row) throw notFound();
    return row;
  }

  /** Namen aus Person bzw. Kontakt; beide müssen zur eigenen Organisation bzw. Beziehung gehören. */
  private async values(scope: TouchpointScope, input: SaveTouchpoint) {
    const { tx } = scope;
    let buyerName = input.buyerName;
    if (input.buyerUserId) {
      const [person] = await tx
        .select({ name: schema.appUser.name })
        .from(schema.appUser)
        .where(
          and(
            eq(schema.appUser.id, input.buyerUserId),
            eq(schema.appUser.organizationId, scope.orgId),
          ),
        );
      if (!person) throw new ConflictException({ statusCode: 409, code: 'person_unknown' });
      buyerName = person.name;
    }
    let supplierName = input.supplierName;
    if (input.supplierContactId) {
      const [contact] = await tx
        .select({ name: schema.supplierContact.name })
        .from(schema.supplierContact)
        .where(
          and(
            eq(schema.supplierContact.id, input.supplierContactId),
            eq(schema.supplierContact.relationshipId, scope.relationshipId),
          ),
        );
      if (!contact) throw new ConflictException({ statusCode: 409, code: 'person_unknown' });
      supplierName = contact.name;
    }
    return {
      visibility: input.visibility,
      buyerUserId: input.buyerUserId,
      buyerName: buyerName as string,
      buyerLevel: input.buyerLevel,
      supplierContactId: input.supplierContactId,
      supplierName: supplierName as string,
      supplierLevel: input.supplierLevel,
      format: input.format,
      cadence: input.cadence,
      notes: input.notes,
    };
  }

  /** Formate der jüngsten freigegebenen oder geteilten Spielregeln (PLB-03). */
  private async agreedFormats(tx: TenantTransaction, relationshipId: string) {
    const [set] = await tx
      .select({ id: schema.ruleSet.id })
      .from(schema.ruleSet)
      .where(
        and(
          eq(schema.ruleSet.relationshipId, relationshipId),
          inArray(schema.ruleSet.status, ['approved', 'shared']),
        ),
      )
      .orderBy(desc(schema.ruleSet.version))
      .limit(1);
    if (!set) return [];
    const items = await tx
      .select({
        title: schema.ruleSetItem.title,
        level: schema.ruleSetItem.level,
        cadence: schema.ruleSetItem.cadence,
      })
      .from(schema.ruleSetItem)
      .where(and(eq(schema.ruleSetItem.ruleSetId, set.id), eq(schema.ruleSetItem.kind, 'format')))
      .orderBy(asc(schema.ruleSetItem.position));
    return items.flatMap((item) =>
      item.cadence ? [{ title: item.title, level: item.level, cadence: item.cadence }] : [],
    );
  }

  private async activeCycle(tx: TenantTransaction, relationshipId: string) {
    const [cycle] = await tx
      .select({ id: schema.cycle.id })
      .from(schema.cycle)
      .where(
        and(eq(schema.cycle.relationshipId, relationshipId), eq(schema.cycle.status, 'active')),
      )
      .orderBy(desc(schema.cycle.startedAt))
      .limit(1);
    return cycle?.id ?? null;
  }
}
