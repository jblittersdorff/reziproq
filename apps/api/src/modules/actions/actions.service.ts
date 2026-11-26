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
  currentTime,
  eq,
  inArray,
  schema,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type ActionItem,
  type ActionList,
  actionListSchema,
  actionStatuses,
  type CommitmentEvidence,
  type CreateAction,
  commitmentSettableStatuses,
  type DueItem,
  type MeetingSide,
  type MyActions,
  myActionsSchema,
  type SaveAction,
  type WorkItemKind,
  type WorkItemStatus,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import { commitmentAudit, taskAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { evidenceOf, keptEvidence, statusFields } from '../commitments/commitment-rules.js';
import { CustomersService } from '../customers/customers.service.js';
import { isOverdue, type WorkRow, workRows } from './action-rows.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const badRequest = (code: string) => new BadRequestException({ statusCode: 400, code });

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

/** Quelle der alten Seiten → Quelle der Zusage (ZQ-01) */
const commitmentSource = {
  manual: 'manual',
  meeting: 'meeting',
  feedback_gap: 'feedback',
  initiative: 'initiative',
} as const;

/**
 * QBR-03, ZQ-01 (K2-a.3): Zusagen und Aufgaben einer Beziehung für beide Seiten, früher Maßnahmen.
 * Geteilte Einträge sind Zusagen (commitment), interne sind Aufgaben (task, E-K2-1); die Schnittstelle
 * der Maßnahmen bleibt für die alten Seiten bis K2-c. Jede Seite legt an und bearbeitet nur ihre
 * eigenen Zeilen (PLT-04). Den Status einer geteilten Zusage ändern beide Seiten über
 * app_zusage_status, „gehalten“ nur mit Beleg (ZQ-01 Regel 2).
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
    row: WorkRow,
  ): ActionItem {
    const own = row.ownerOrgId === scope.orgId;
    return {
      id: row.id,
      kind: row.kind,
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
      evidence: evidenceOf(row.evidence),
      overdue: isOverdue(row),
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      sourceTitle: row.meetingTitle,
      sourceDimension: (row.gapDimension as ActionItem['sourceDimension']) ?? null,
      canEdit: scope.canEdit && own && row.status !== 'replaced',
      // Geteilte Zusagen beider Seiten (app_zusage_status), Aufgaben und interne Zusagen nur eigene
      canChangeStatus:
        scope.canEdit &&
        row.status !== 'replaced' &&
        (own || (row.kind === 'commitment' && row.visibility === 'shared')),
    };
  }

  async list(scope: ActionScope): Promise<ActionList> {
    const rows = await workRows(scope.tx, { relationshipIds: [scope.relationshipId] });
    return actionListSchema.parse({
      actions: rows.map((row) => this.toAction(scope, row)),
      canCreate: scope.canEdit,
      people: scope.canEdit ? await this.people(scope) : [],
    });
  }

  async get(scope: ActionScope, actionId: string): Promise<ActionItem> {
    return this.toAction(scope, await this.row(scope, actionId));
  }

  private async row(scope: ActionScope, actionId: string) {
    const [row] = (await workRows(scope.tx, { relationshipIds: [scope.relationshipId] })).filter(
      (entry) => entry.id === actionId,
    );
    if (!row) throw notFound();
    return row;
  }

  /** Verantwortlich: eine Person der eigenen Seite mit ID oder ein Name auf der anderen Seite. */
  private async owner(scope: ActionScope, input: SaveAction) {
    if (input.ownerSide === scope.side) {
      const person = (await this.people(scope)).find((entry) => entry.userId === input.ownerUserId);
      if (!person) throw badRequest('person_unbekannt');
      return { ownerUserId: person.userId, ownerName: person.name };
    }
    if (!input.ownerName) throw badRequest('name_fehlt');
    return { ownerUserId: null, ownerName: input.ownerName };
  }

  private snapshot(row: Pick<WorkRow, 'kind' | 'title' | 'ownerName' | 'dueDate' | 'status'>) {
    return row.kind === 'commitment'
      ? { title: row.title, owner_name: row.ownerName, due_on: row.dueDate, status: row.status }
      : { title: row.title, owner_name: row.ownerName, due_date: row.dueDate, status: row.status };
  }

  private auditOf(kind: WorkRow['kind']) {
    return kind === 'commitment' ? commitmentAudit : taskAudit;
  }

  /**
   * Anlegen: geteilt wird eine Zusage, intern eine Aufgabe der eigenen Seite. kind = commitment legt
   * eine interne Zusage an, z. B. die Zusage einer Person des Lieferanten aus einem Termin, die erst
   * mit dem Protokoll geteilt wird (KI-17).
   */
  async create(
    scope: ActionScope,
    input: CreateAction,
    options: { kind?: WorkItemKind } = {},
  ): Promise<ActionItem> {
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
      if (!meeting) throw badRequest('quelle_unbekannt');
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
      if (!result) throw badRequest('quelle_unbekannt');
    }
    const kind = options.kind ?? (input.action.visibility === 'shared' ? 'commitment' : 'task');
    // Eine Aufgabe gehört immer der eigenen Seite; für die andere Seite gibt es Zusagen
    if (kind === 'task' && input.action.ownerSide !== scope.side) {
      throw badRequest('aufgabe_eigene_seite');
    }
    const owner = await this.owner(scope, input.action);
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    const common = {
      relationshipId: scope.relationshipId,
      title: input.action.title,
      description: input.action.description,
      ...owner,
      createdBy: scope.auth.userId,
      createdByName: actor.name,
    };
    const created = await auditedChange(tx, actor, this.auditOf(kind), async () => {
      const [row] =
        kind === 'commitment'
          ? await tx
              .insert(schema.commitment)
              .values({
                ...common,
                ownerOrgId: scope.orgId,
                visibility: input.action.visibility,
                side: input.action.ownerSide,
                dueOn: input.action.dueDate,
                sourceType: commitmentSource[input.sourceType],
                sourceRef: input.sourceId,
              })
              .returning({ id: schema.commitment.id })
          : await tx
              .insert(schema.task)
              .values({
                ...common,
                orgId: scope.orgId,
                dueDate: input.action.dueDate,
                sourceType: input.sourceType,
                sourceId: input.sourceId,
              })
              .returning({ id: schema.task.id });
      const id = row?.id as string;
      return {
        objectId: id,
        relationshipId: scope.relationshipId,
        action: 'created' as const,
        before: null,
        after: this.snapshot({
          kind,
          title: input.action.title,
          ownerName: owner.ownerName,
          dueDate: input.action.dueDate,
          status: 'open',
        }),
        result: { id },
      };
    });
    return this.get(scope, created.id);
  }

  /**
   * KI-17: Beim Teilen des Protokolls wird eine eigene interne Zusage aus dem Termin geteilt und eine
   * eigene offene Aufgabe zur Zusage (dieselbe ID; Kommentare der eigenen Seite gehen mit). Ist der
   * Eintrag schon geteilt, bleibt alles.
   */
  async shareFromMeeting(scope: ActionScope, actionId: string) {
    const { tx } = scope;
    await tx
      .update(schema.commitment)
      .set({ visibility: 'shared', updatedAt: currentTime() })
      .where(
        and(
          eq(schema.commitment.id, actionId),
          eq(schema.commitment.ownerOrgId, scope.orgId),
          eq(schema.commitment.relationshipId, scope.relationshipId),
          eq(schema.commitment.visibility, 'internal'),
        ),
      );
    const [task] = await tx
      .select()
      .from(schema.task)
      .where(
        and(
          eq(schema.task.id, actionId),
          eq(schema.task.orgId, scope.orgId),
          eq(schema.task.relationshipId, scope.relationshipId),
          inArray(schema.task.status, ['open', 'in_progress']),
        ),
      );
    if (!task) return;
    await tx.delete(schema.task).where(eq(schema.task.id, task.id));
    await tx.insert(schema.commitment).values({
      id: task.id,
      relationshipId: task.relationshipId,
      ownerOrgId: task.orgId,
      visibility: 'shared',
      side: scope.side,
      title: task.title,
      description: task.description,
      ownerUserId: task.ownerUserId,
      ownerName: task.ownerName,
      dueOn: task.dueDate,
      sourceType: task.sourceType === 'feedback_gap' ? 'feedback' : task.sourceType,
      sourceRef: task.sourceType === 'manual' ? null : task.sourceId,
      createdBy: task.createdBy,
      createdByName: task.createdByName,
      createdAt: task.createdAt,
      origin: task.origin,
      originRunId: task.originRunId,
      originUserId: task.originUserId,
    });
    await tx
      .update(schema.comment)
      .set({ objectType: 'commitment' })
      .where(and(eq(schema.comment.objectType, 'task'), eq(schema.comment.objectId, task.id)));
  }

  /** Inhalt ändern: nur die Seite, die den Eintrag angelegt hat. Art und Quelle bleiben. */
  async update(scope: ActionScope, actionId: string, input: SaveAction): Promise<ActionItem> {
    if (!scope.canEdit) throw forbidden();
    const current = await this.row(scope, actionId);
    if (current.ownerOrgId !== scope.orgId) throw forbidden();
    // Zusage oder Aufgabe ist nach dem Anlegen fest (ZQ-01, E-K2-1), ebenso die Sichtbarkeit: Eine
    // interne Zusage (aus dem Termin) kommt über das Teilen in die Mitte, nicht über das Bearbeiten
    const fixed = current.kind === 'commitment' ? current.visibility : 'internal';
    if (input.visibility !== fixed) throw badRequest('art_fest');
    if (current.kind === 'task' && input.ownerSide !== scope.side) {
      throw badRequest('aufgabe_eigene_seite');
    }
    const { tx } = scope;
    const owner = await this.owner(scope, input);
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    await auditedChange(tx, actor, this.auditOf(current.kind), async () => {
      if (current.kind === 'commitment') {
        await tx
          .update(schema.commitment)
          .set({
            title: input.title,
            description: input.description,
            side: input.ownerSide,
            ...owner,
            dueOn: input.dueDate,
            updatedAt: currentTime(),
          })
          .where(eq(schema.commitment.id, actionId));
      } else {
        await tx
          .update(schema.task)
          .set({
            title: input.title,
            description: input.description,
            ...owner,
            dueDate: input.dueDate,
            updatedAt: currentTime(),
          })
          .where(eq(schema.task.id, actionId));
      }
      return {
        objectId: actionId,
        relationshipId: scope.relationshipId,
        action: 'updated' as const,
        before: this.snapshot(current),
        after: this.snapshot({
          ...current,
          title: input.title,
          ownerName: owner.ownerName,
          dueDate: input.dueDate,
        }),
        result: undefined,
      };
    });
    return this.get(scope, actionId);
  }

  /**
   * Status ändern, je Art: Aufgaben wie früher die Maßnahmen (nur die eigene Seite); Zusagen offen,
   * gehalten (nur mit Beleg), verfehlt oder zurückgezogen, geteilte von beiden Seiten über
   * app_zusage_status. „Ersetzt“ entsteht nur durch eine neue Zusage (ZQ-01 Regel 3).
   */
  async setStatus(
    scope: ActionScope,
    actionId: string,
    status: WorkItemStatus,
    evidence?: CommitmentEvidence,
  ): Promise<ActionItem> {
    if (!scope.canEdit) throw forbidden();
    const current = await this.row(scope, actionId);
    const own = current.ownerOrgId === scope.orgId;
    const shared = current.kind === 'commitment' && current.visibility === 'shared';
    if (!own && !shared) throw forbidden();
    const allowed: readonly string[] =
      current.kind === 'commitment' ? commitmentSettableStatuses : actionStatuses;
    if (!allowed.includes(status) || current.status === 'replaced') {
      throw badRequest('status_unpassend');
    }
    const { tx } = scope;
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    await auditedChange(tx, actor, this.auditOf(current.kind), async () => {
      if (current.kind === 'task') {
        await tx
          .update(schema.task)
          .set({
            status: status as (typeof actionStatuses)[number],
            doneAt: status === 'done' ? currentTime() : null,
            updatedAt: currentTime(),
          })
          .where(eq(schema.task.id, actionId));
      } else {
        const next = status as (typeof commitmentSettableStatuses)[number];
        const stored = next === 'kept' ? keptEvidence(evidence, actor) : null;
        if (shared) {
          await tx.execute(
            sql`select app_zusage_status(${actionId}, ${next}, ${stored ? JSON.stringify(stored) : null}::jsonb)`,
          );
        } else {
          await tx
            .update(schema.commitment)
            .set({ ...statusFields(next, stored), updatedAt: currentTime() })
            .where(eq(schema.commitment.id, actionId));
        }
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
   * Offene Zusagen und Aufgaben aller eigenen Beziehungen (QBR-03, /start/massnahmen): beim Käufer
   * die, in deren Team die Person ist, beim Lieferanten alle Kunden, je im Kontext des Kunden.
   */
  async mine(auth: AuthContext): Promise<MyActions> {
    const items: MyActions['items'] = [];
    await this.eachRelationship(auth, async (tx, entry) => {
      const scope = {
        orgId: entry.orgId,
        buyerOrgId: entry.buyerOrgId,
        canEdit: can(auth, 'massnahmen.bearbeiten'),
      };
      for (const row of await workRows(tx, {
        relationshipIds: [entry.relationshipId],
        openOnly: true,
      })) {
        items.push({
          ...this.toAction(scope, row),
          relationshipId: entry.relationshipId,
          counterpart: entry.counterpart,
          href: `${entry.base}/umsetzung/massnahmen#${row.id}`,
        });
      }
    });
    items.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title));
    return myActionsSchema.parse({ items });
  }

  /**
   * Aufgaben-Quelle für Start (QBR-03): offene Aufgaben, für die die Person verantwortlich ist.
   * Zusagen liefert der Dienst der Zusagen (JbpCommitmentsService.dueItems), damit keine doppelt
   * erscheint; kind 'action' heißt hier Aufgabe.
   */
  async dueItems(auth: AuthContext): Promise<DueItem[]> {
    if (!can(auth, 'massnahmen.sehen')) return [];
    const items: DueItem[] = [];
    await this.eachRelationship(auth, async (tx, entry) => {
      const rows = await workRows(tx, {
        relationshipIds: [entry.relationshipId],
        kind: 'task',
        openOnly: true,
        ownerUserId: auth.userId,
      });
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
