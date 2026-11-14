import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  auditedChange,
  eq,
  inArray,
  schema,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type ActionItem,
  type ActionList,
  type ActionStatus,
  actionListSchema,
  type CreateAction,
  type DueItem,
  type MeetingSide,
  type MyActions,
  myActionsSchema,
  type SaveAction,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import { actionAudit, actionInternalAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { CustomersService } from '../customers/customers.service.js';
import { isOverdue, openStatuses } from './action-rows.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

/** Wo gearbeitet wird: Seite, eigene Organisation, Käufer der Beziehung, ob bearbeitet werden darf. */
export interface ActionScope {
  tx: TenantTransaction;
  auth: AuthContext;
  side: MeetingSide;
  orgId: string;
  buyerOrgId: string;
  relationshipId: string;
  canEdit: boolean;
}

type ActionRow = typeof schema.action.$inferSelect;

/**
 * QBR-03: Maßnahmen einer Beziehung für beide Seiten. Jede Seite legt an und bearbeitet nur ihre
 * eigenen Zeilen (PLT-04). Den Status einer geteilten Maßnahme der anderen Seite ändert die
 * Funktion app_massnahme_status. Jede Maßnahme hat genau eine Quelle.
 */
@Injectable()
export class ActionsService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(CustomersService) private readonly customers: CustomersService,
  ) {}

  /** Käuferseite: eigene Beziehung; bearbeiten Admin oder wer im Team ist, nie Teamrolle Leser. */
  buyer<T>(auth: AuthContext, relationshipId: string, work: (scope: ActionScope) => Promise<T>) {
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
        can(auth, 'massnahmen.bearbeiten', { teamRole: member?.teamRole ?? null }) &&
        (auth.orgRole === 'admin' || member !== undefined);
      return work({
        tx,
        auth,
        side: 'buyer',
        orgId: organization.id,
        buyerOrgId: organization.id,
        relationshipId,
        canEdit,
      });
    });
  }

  /** Lieferantenseite: im Kontext genau dieses Kunden (LIF-02). */
  supplier<T>(auth: AuthContext, relationshipId: string, work: (scope: ActionScope) => Promise<T>) {
    return this.customers.inCustomer(auth, relationshipId, (tx, customer) =>
      work({
        tx,
        auth,
        side: 'supplier',
        orgId: auth.organization?.id as string,
        buyerOrgId: customer.buyerOrgId,
        relationshipId,
        canEdit: can(auth, 'massnahmen.bearbeiten'),
      }),
    );
  }

  private sideOf(scope: { buyerOrgId: string }, ownerOrgId: string): MeetingSide {
    return ownerOrgId === scope.buyerOrgId ? 'buyer' : 'supplier';
  }

  /** Personen der eigenen Seite im Team der Beziehung, für „verantwortlich“. */
  private async people(scope: ActionScope) {
    const rows = await scope.tx
      .select({ userId: schema.appUser.id, name: schema.appUser.name })
      .from(schema.relationshipMember)
      .innerJoin(schema.appUser, eq(schema.appUser.id, schema.relationshipMember.userId))
      .where(
        and(
          eq(schema.relationshipMember.relationshipId, scope.relationshipId),
          eq(schema.relationshipMember.orgId, scope.orgId),
        ),
      )
      .orderBy(asc(schema.appUser.name));
    // Wer gerade arbeitet, kann sich selbst eintragen, auch ohne Teamplatz (z. B. ein Admin).
    if (!rows.some((row) => row.userId === scope.auth.userId)) {
      const [me] = await scope.tx
        .select({ userId: schema.appUser.id, name: schema.appUser.name })
        .from(schema.appUser)
        .where(eq(schema.appUser.id, scope.auth.userId));
      if (me) rows.push(me);
    }
    return rows;
  }

  private toAction(
    scope: { buyerOrgId: string; orgId: string; canEdit: boolean },
    row: ActionRow,
    sourceTitle: string | null,
    sourceDimension: string | null = null,
  ): ActionItem {
    const own = row.ownerOrgId === scope.orgId;
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      visibility: row.visibility,
      side: this.sideOf(scope, row.ownerOrgId),
      own,
      ownerSide: row.ownerSide,
      ownerUserId: row.ownerUserId,
      ownerName: row.ownerName,
      dueDate: row.dueDate,
      status: row.status,
      overdue: isOverdue(row),
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      sourceTitle,
      sourceDimension: (sourceDimension as ActionItem['sourceDimension']) ?? null,
      canEdit: scope.canEdit && own,
      canChangeStatus: scope.canEdit && (own || row.visibility === 'shared'),
    };
  }

  /** Maßnahmen mit dem Titel ihres Termins, falls sie aus einem stammen. */
  private async rows(tx: TenantTransaction, relationshipIds: string[], openOnly = false) {
    if (relationshipIds.length === 0) return [];
    return tx
      .select({
        action: schema.action,
        meetingTitle: schema.meeting.title,
        gapDimension: schema.surveyResult.dimension,
      })
      .from(schema.action)
      .leftJoin(
        schema.meeting,
        and(eq(schema.action.sourceType, 'meeting'), eq(schema.meeting.id, schema.action.sourceId)),
      )
      .leftJoin(
        schema.surveyResult,
        and(
          eq(schema.action.sourceType, 'feedback_gap'),
          eq(schema.surveyResult.id, schema.action.sourceId),
        ),
      )
      .where(
        and(
          inArray(schema.action.relationshipId, relationshipIds),
          openOnly ? inArray(schema.action.status, [...openStatuses]) : undefined,
        ),
      )
      .orderBy(asc(schema.action.dueDate), asc(schema.action.title));
  }

  async list(scope: ActionScope): Promise<ActionList> {
    const rows = await this.rows(scope.tx, [scope.relationshipId]);
    return actionListSchema.parse({
      actions: rows.map((row) =>
        this.toAction(scope, row.action, row.meetingTitle, row.gapDimension),
      ),
      canCreate: scope.canEdit,
      people: scope.canEdit ? await this.people(scope) : [],
    });
  }

  async get(scope: ActionScope, actionId: string): Promise<ActionItem> {
    const row = await this.row(scope, actionId);
    return this.toAction(scope, row.action, row.meetingTitle, row.gapDimension);
  }

  private async row(scope: ActionScope, actionId: string) {
    const [row] = (await this.rows(scope.tx, [scope.relationshipId])).filter(
      (entry) => entry.action.id === actionId,
    );
    if (!row) throw notFound();
    return row;
  }

  /** Verantwortlich: eine Person der eigenen Seite mit ID oder ein Name auf der anderen Seite. */
  private async owner(scope: ActionScope, input: SaveAction) {
    if (input.ownerSide === scope.side) {
      const person = (await this.people(scope)).find((entry) => entry.userId === input.ownerUserId);
      if (!person) throw new BadRequestException({ statusCode: 400, code: 'person_unbekannt' });
      return { ownerUserId: person.userId, ownerName: person.name };
    }
    if (!input.ownerName) throw new BadRequestException({ statusCode: 400, code: 'name_fehlt' });
    return { ownerUserId: null, ownerName: input.ownerName };
  }

  private auditOf(visibility: 'internal' | 'shared') {
    return visibility === 'shared' ? actionAudit : actionInternalAudit;
  }

  private snapshot(row: Pick<ActionRow, 'title' | 'ownerName' | 'dueDate' | 'status'>) {
    return {
      title: row.title,
      owner_name: row.ownerName,
      due_date: row.dueDate,
      status: row.status,
    };
  }

  async create(scope: ActionScope, input: CreateAction): Promise<ActionItem> {
    if (!scope.canEdit) throw forbidden();
    const { tx } = scope;
    if (input.sourceType === 'meeting') {
      // Die Quelle muss ein Termin dieser Beziehung sein, den die Seite sieht.
      const [meeting] = await tx
        .select({ id: schema.meeting.id })
        .from(schema.meeting)
        .where(
          and(
            eq(schema.meeting.id, input.sourceId as string),
            eq(schema.meeting.relationshipId, scope.relationshipId),
          ),
        );
      if (!meeting) throw new BadRequestException({ statusCode: 400, code: 'quelle_unbekannt' });
    }
    if (input.sourceType === 'feedback_gap') {
      // PUL-06: Die Quelle ist die Ergebniszeile einer Dimension (gesamt) dieser Beziehung.
      const [result] = await tx
        .select({ id: schema.surveyResult.id })
        .from(schema.surveyResult)
        .where(
          and(
            eq(schema.surveyResult.id, input.sourceId as string),
            eq(schema.surveyResult.relationshipId, scope.relationshipId),
            sql`${schema.surveyResult.function} is null`,
            sql`${schema.surveyResult.questionKey} is null`,
          ),
        );
      if (!result) throw new BadRequestException({ statusCode: 400, code: 'quelle_unbekannt' });
    }
    const owner = await this.owner(scope, input.action);
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    const [user] = await tx
      .select({ name: schema.appUser.name })
      .from(schema.appUser)
      .where(eq(schema.appUser.id, scope.auth.userId));
    const created = await auditedChange(
      tx,
      actor,
      this.auditOf(input.action.visibility),
      async () => {
        const [row] = await tx
          .insert(schema.action)
          .values({
            relationshipId: scope.relationshipId,
            ownerOrgId: scope.orgId,
            visibility: input.action.visibility,
            title: input.action.title,
            description: input.action.description,
            ownerSide: input.action.ownerSide,
            ...owner,
            dueDate: input.action.dueDate,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            createdBy: scope.auth.userId,
            createdByName: user?.name ?? '',
          })
          .returning();
        const inserted = row as ActionRow;
        return {
          objectId: inserted.id,
          relationshipId: scope.relationshipId,
          action: 'created' as const,
          before: null,
          after: this.snapshot(inserted),
          result: inserted,
        };
      },
    );
    return this.get(scope, created.id);
  }

  /** Inhalt ändern: nur die Seite, die die Maßnahme angelegt hat. Die Quelle bleibt. */
  async update(scope: ActionScope, actionId: string, input: SaveAction): Promise<ActionItem> {
    if (!scope.canEdit) throw forbidden();
    const { action: current } = await this.row(scope, actionId);
    if (current.ownerOrgId !== scope.orgId) throw forbidden();
    const { tx } = scope;
    const owner = await this.owner(scope, input);
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    // Wechselt die Sichtbarkeit, steht die Änderung im Verlauf, den beide Seiten danach sehen.
    await auditedChange(tx, actor, this.auditOf(input.visibility), async () => {
      const next = {
        title: input.title,
        description: input.description,
        visibility: input.visibility,
        ownerSide: input.ownerSide,
        ...owner,
        dueDate: input.dueDate,
        updatedAt: new Date(),
      };
      await tx.update(schema.action).set(next).where(eq(schema.action.id, actionId));
      return {
        objectId: actionId,
        relationshipId: scope.relationshipId,
        action: 'updated' as const,
        before: this.snapshot(current),
        after: this.snapshot({ ...current, ...next }),
        result: undefined,
      };
    });
    return this.get(scope, actionId);
  }

  /**
   * Status ändern: eigene Maßnahmen direkt, geteilte der anderen Seite über
   * app_massnahme_status (die Zeile gehört der anderen Seite).
   */
  async setStatus(scope: ActionScope, actionId: string, status: ActionStatus): Promise<ActionItem> {
    if (!scope.canEdit) throw forbidden();
    const { action: current } = await this.row(scope, actionId);
    const own = current.ownerOrgId === scope.orgId;
    if (!own && current.visibility !== 'shared') throw forbidden();
    const { tx } = scope;
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    await auditedChange(tx, actor, this.auditOf(current.visibility), async () => {
      if (own) {
        await tx
          .update(schema.action)
          .set({ status, doneAt: status === 'done' ? new Date() : null, updatedAt: new Date() })
          .where(eq(schema.action.id, actionId));
      } else {
        await tx.execute(sql`select app_massnahme_status(${actionId}, ${status})`);
      }
      return {
        objectId: actionId,
        relationshipId: scope.relationshipId,
        action: 'updated' as const,
        before: this.snapshot(current),
        after: this.snapshot({ ...current, status }),
        result: undefined,
      };
    });
    return this.get(scope, actionId);
  }

  /**
   * Offene Maßnahmen aller eigenen Beziehungen (QBR-03, /start/massnahmen): beim Käufer die, in
   * deren Team die Person ist, beim Lieferanten alle Kunden, je im Kontext des Kunden.
   */
  async mine(auth: AuthContext): Promise<MyActions> {
    const items: MyActions['items'] = [];
    await this.eachRelationship(auth, async (tx, entry) => {
      const scope = {
        orgId: entry.orgId,
        buyerOrgId: entry.buyerOrgId,
        canEdit: can(auth, 'massnahmen.bearbeiten'),
      };
      for (const row of await this.rows(tx, [entry.relationshipId], true)) {
        items.push({
          ...this.toAction(scope, row.action, row.meetingTitle, row.gapDimension),
          relationshipId: entry.relationshipId,
          counterpart: entry.counterpart,
          href: `${entry.base}/umsetzung/massnahmen#${row.action.id}`,
        });
      }
    });
    items.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title));
    return myActionsSchema.parse({ items });
  }

  /** Aufgaben-Quelle für Start (QBR-03): offene Maßnahmen, für die die Person verantwortlich ist. */
  async dueItems(auth: AuthContext): Promise<DueItem[]> {
    if (!can(auth, 'massnahmen.sehen')) return [];
    const items: DueItem[] = [];
    await this.eachRelationship(auth, async (tx, entry) => {
      const rows = await tx
        .select({
          id: schema.action.id,
          title: schema.action.title,
          dueDate: schema.action.dueDate,
        })
        .from(schema.action)
        .where(
          and(
            eq(schema.action.relationshipId, entry.relationshipId),
            eq(schema.action.ownerUserId, auth.userId),
            inArray(schema.action.status, [...openStatuses]),
          ),
        );
      for (const row of rows) {
        items.push({
          id: row.id,
          kind: 'action',
          supplier: entry.counterpart,
          detail: row.title,
          dueDate: row.dueDate,
          href: `${entry.base}/umsetzung/massnahmen#${row.id}`,
        });
      }
    });
    return items;
  }

  /**
   * Läuft je eigener Beziehung in der passenden Mandanten-Session, nur lesend. Auch für andere
   * Aufgaben-Quellen der Beziehung, z. B. Zusagen und Meilensteine (JBP-05), mit ihrem Recht.
   */
  async eachRelationship(
    auth: AuthContext,
    work: (
      tx: TenantTransaction,
      entry: {
        relationshipId: string;
        orgId: string;
        buyerOrgId: string;
        counterpart: string;
        base: string;
      },
    ) => Promise<void>,
    permission: Parameters<typeof can>[1] = 'massnahmen.sehen',
  ) {
    const organization = auth.organization;
    if (!organization || !can(auth, permission)) return;
    if (!organization.buyer) {
      for (const customer of await this.customers.customersOf(auth)) {
        await this.tenant.run(
          {
            userId: auth.userId,
            organizationId: organization.id,
            customerOrganizationId: customer.buyerOrgId,
          },
          (tx) =>
            work(tx, {
              relationshipId: customer.relationshipId,
              orgId: organization.id,
              buyerOrgId: customer.buyerOrgId,
              counterpart: customer.name,
              base: `/kunden/${customer.relationshipId}`,
            }),
          { readOnly: true },
        );
      }
      return;
    }
    await this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      async (tx) => {
        const name = sql<string>`coalesce(${schema.relationshipSide.displayName}, ${schema.organization.name})`;
        const relationships = await tx
          .select({ id: schema.relationship.id, name })
          .from(schema.relationshipMember)
          .innerJoin(
            schema.relationship,
            eq(schema.relationship.id, schema.relationshipMember.relationshipId),
          )
          .innerJoin(
            schema.organization,
            eq(schema.organization.id, schema.relationship.supplierOrgId),
          )
          .leftJoin(
            schema.relationshipSide,
            and(
              eq(schema.relationshipSide.relationshipId, schema.relationship.id),
              eq(schema.relationshipSide.orgId, organization.id),
            ),
          )
          .where(
            and(
              eq(schema.relationshipMember.orgId, organization.id),
              eq(schema.relationshipMember.userId, auth.userId),
              eq(schema.relationship.status, 'active'),
            ),
          );
        for (const relationship of relationships) {
          await work(tx, {
            relationshipId: relationship.id,
            orgId: organization.id,
            buyerOrgId: organization.id,
            counterpart: relationship.name,
            base: `/lieferanten/${relationship.id}`,
          });
        }
      },
      { readOnly: true },
    );
  }
}
