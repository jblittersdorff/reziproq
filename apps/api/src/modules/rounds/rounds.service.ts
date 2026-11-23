import {
  ForbiddenException,
  HttpException,
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
  type AddAssignment,
  type CreateRound,
  type ExtendRound,
  type RoundCandidates,
  type RoundDetail,
  type RoundList,
  type RoundRaters,
  type RoundSummary,
  roundCandidatesSchema,
  roundDetailSchema,
  roundListSchema,
  roundRatersSchema,
  type SetRoundSuppliers,
  type UpdateAssignment,
  type UserFunction,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import { ratingInvitationAudit, segmentationRoundAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { EmailService } from '../email/email.service.js';

const fail = (statusCode: 400 | 409, code: string, message: string) =>
  new HttpException({ statusCode, code, message }, statusCode);

const notFound = () =>
  new NotFoundException({ statusCode: 404, code: 'nicht_gefunden', message: 'Nicht gefunden.' });

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });

const pastDue = () => fail(400, 'due_date_past', 'Die Frist liegt in der Vergangenheit.');

const notDraft = () => fail(409, 'round_not_draft', 'Nur ein Entwurf lässt sich ändern.');

const today = () => new Date().toISOString().slice(0, 10);

function translate(error: unknown): never {
  const cause = (error as { cause?: { code?: string; message?: string } }).cause;
  if (cause?.message?.startsWith('round_closed:')) {
    throw fail(409, 'round_closed', 'Die Runde ist geschlossen.');
  }
  if (cause?.code === '23505') {
    throw fail(409, 'assignment_exists', 'Diese Zuordnung gibt es schon.');
  }
  throw error;
}

interface Scope {
  admin: boolean;
  userId: string;
  sroOf: Set<string>;
}

interface AssignmentRow {
  id: string;
  roundId: string;
  relationshipId: string;
  supplier: string;
  businessUnitId: string;
  businessUnit: string;
  materialGroupId: string | null;
  materialGroup: string | null;
  function: UserFunction;
  raterId: string | null;
  raterName: string | null;
  status: 'open' | 'in_progress' | 'submitted';
}

type RoundRow = typeof schema.segmentationRound.$inferSelect;

const supplierName = sql<string>`coalesce(${schema.relationshipSide.displayName}, ${schema.organization.name})`;

@Injectable()
export class RoundsService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(EmailService) private readonly email: EmailService,
  ) {}

  private run<T>(
    auth: AuthContext,
    work: (tx: TenantTransaction, organization: AccountOrganization) => Promise<T>,
  ): Promise<T> {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant
      .run({ userId: auth.userId, organizationId: organization.id }, (tx) => work(tx, organization))
      .catch(translate);
  }

  private async scope(tx: TenantTransaction, auth: AuthContext, orgId: string): Promise<Scope> {
    const sro = await tx
      .select({ relationshipId: schema.relationshipMember.relationshipId })
      .from(schema.relationshipMember)
      .where(
        and(
          eq(schema.relationshipMember.orgId, orgId),
          eq(schema.relationshipMember.userId, auth.userId),
          eq(schema.relationshipMember.teamRole, 'sro'),
        ),
      );
    return {
      admin: auth.orgRole === 'admin',
      userId: auth.userId,
      sroOf: new Set(sro.map((row) => row.relationshipId)),
    };
  }

  private visible(scope: Scope, row: AssignmentRow): boolean {
    return scope.admin || scope.sroOf.has(row.relationshipId) || row.raterId === scope.userId;
  }

  private async round(tx: TenantTransaction, orgId: string, id: string): Promise<RoundRow> {
    const [round] = await tx
      .select()
      .from(schema.segmentationRound)
      .where(and(eq(schema.segmentationRound.id, id), eq(schema.segmentationRound.orgId, orgId)));
    if (!round) throw notFound();
    return round;
  }

  private async draft(tx: TenantTransaction, orgId: string, id: string): Promise<RoundRow> {
    const round = await this.round(tx, orgId, id);
    if (round.status !== 'draft') throw notDraft();
    return round;
  }

  private async assignmentRows(
    tx: TenantTransaction,
    orgId: string,
    roundIds: string[],
  ): Promise<AssignmentRow[]> {
    if (!roundIds.length) return [];
    return tx
      .select({
        id: schema.ratingAssignment.id,
        roundId: schema.ratingAssignment.roundId,
        relationshipId: schema.ratingAssignment.relationshipId,
        supplier: supplierName,
        businessUnitId: schema.businessUnit.id,
        businessUnit: schema.businessUnit.name,
        materialGroupId: schema.materialGroup.id,
        materialGroup: schema.materialGroup.name,
        function: schema.ratingAssignment.function,
        raterId: schema.ratingAssignment.raterUserId,
        raterName: schema.appUser.name,
        status: schema.ratingAssignment.status,
      })
      .from(schema.ratingAssignment)
      .innerJoin(
        schema.relationship,
        eq(schema.relationship.id, schema.ratingAssignment.relationshipId),
      )
      .innerJoin(schema.organization, eq(schema.organization.id, schema.relationship.supplierOrgId))
      .leftJoin(
        schema.relationshipSide,
        and(
          eq(schema.relationshipSide.relationshipId, schema.relationship.id),
          eq(schema.relationshipSide.orgId, orgId),
        ),
      )
      .innerJoin(
        schema.businessUnit,
        eq(schema.businessUnit.id, schema.ratingAssignment.businessUnitId),
      )
      .leftJoin(
        schema.materialGroup,
        eq(schema.materialGroup.id, schema.ratingAssignment.materialGroupId),
      )
      .leftJoin(schema.appUser, eq(schema.appUser.id, schema.ratingAssignment.raterUserId))
      .where(inArray(schema.ratingAssignment.roundId, roundIds))
      .orderBy(
        asc(supplierName),
        asc(schema.businessUnit.name),
        asc(schema.ratingAssignment.function),
      );
  }

  private summary(round: RoundRow, rows: AssignmentRow[]): RoundSummary {
    return {
      id: round.id,
      name: round.name,
      dueDate: round.dueDate,
      status: round.status,
      modelVersion: round.modelVersion,
      total: rows.length,
      submitted: rows.filter((row) => row.status === 'submitted').length,
    };
  }

  list(auth: AuthContext): Promise<RoundList> {
    return this.run(auth, async (tx, organization) => {
      const scope = await this.scope(tx, auth, organization.id);
      const rounds = await tx
        .select()
        .from(schema.segmentationRound)
        .where(eq(schema.segmentationRound.orgId, organization.id))
        .orderBy(sql`${schema.segmentationRound.createdAt} desc`);
      const rows = await this.assignmentRows(
        tx,
        organization.id,
        rounds.map((round) => round.id),
      );
      const summaries: RoundSummary[] = [];
      for (const round of rounds) {
        const visible = rows
          .filter((row) => row.roundId === round.id)
          .filter((row) => this.visible(scope, row));
        if (!scope.admin && (round.status === 'draft' || !visible.length)) continue;
        summaries.push(this.summary(round, visible));
      }
      return roundListSchema.parse({ rounds: summaries });
    });
  }

  /** Business Units und Warengruppen der Lieferanten (PLT-06); ohne Filter alle der Organisation. */
  private async options(tx: TenantTransaction, relationshipIds?: string[]) {
    if (relationshipIds && !relationshipIds.length) return { units: [], groups: [] };
    const units = await tx
      .select({
        relationshipId: schema.relationshipBusinessUnit.relationshipId,
        id: schema.businessUnit.id,
        name: schema.businessUnit.name,
      })
      .from(schema.relationshipBusinessUnit)
      .innerJoin(
        schema.businessUnit,
        eq(schema.businessUnit.id, schema.relationshipBusinessUnit.businessUnitId),
      )
      .where(
        relationshipIds
          ? inArray(schema.relationshipBusinessUnit.relationshipId, relationshipIds)
          : undefined,
      )
      .orderBy(asc(schema.businessUnit.name));
    const groups = await tx
      .select({
        relationshipId: schema.relationshipMaterialGroup.relationshipId,
        id: schema.materialGroup.id,
        name: schema.materialGroup.name,
      })
      .from(schema.relationshipMaterialGroup)
      .innerJoin(
        schema.materialGroup,
        eq(schema.materialGroup.id, schema.relationshipMaterialGroup.materialGroupId),
      )
      .where(
        relationshipIds
          ? inArray(schema.relationshipMaterialGroup.relationshipId, relationshipIds)
          : undefined,
      )
      .orderBy(asc(schema.materialGroup.name));
    return { units, groups };
  }

  private async detail(
    tx: TenantTransaction,
    auth: AuthContext,
    orgId: string,
    id: string,
  ): Promise<RoundDetail> {
    const scope = await this.scope(tx, auth, orgId);
    const round = await this.round(tx, orgId, id);
    if (!scope.admin && round.status === 'draft') throw notFound();
    const rows = (await this.assignmentRows(tx, orgId, [id])).filter((row) =>
      this.visible(scope, row),
    );
    if (!scope.admin && !rows.length) throw notFound();
    const suppliers = new Map<string, AssignmentRow[]>();
    for (const row of rows) {
      suppliers.set(row.relationshipId, [...(suppliers.get(row.relationshipId) ?? []), row]);
    }
    const mayNominate = can(
      { orgRole: auth.orgRole, isControlling: auth.isControlling, isOperator: auth.isOperator },
      'runden.nachnominieren',
    );
    const nominatable = new Set(
      [...suppliers.keys()].filter(
        (relationshipId) =>
          round.status === 'open' &&
          mayNominate &&
          (scope.admin || scope.sroOf.has(relationshipId)),
      ),
    );
    const options = await this.options(tx, [...nominatable]);
    return roundDetailSchema.parse({
      ...this.summary(round, rows),
      canManage: scope.admin,
      suppliers: [...suppliers.entries()].map(([relationshipId, items]) => ({
        relationshipId,
        name: items[0]?.supplier ?? '',
        total: items.length,
        submitted: items.filter((item) => item.status === 'submitted').length,
        canNominate: nominatable.has(relationshipId),
        businessUnits: options.units.filter((unit) => unit.relationshipId === relationshipId),
        materialGroups: options.groups.filter((group) => group.relationshipId === relationshipId),
        assignments: items.map((item) => ({
          id: item.id,
          businessUnit: { id: item.businessUnitId, name: item.businessUnit },
          materialGroup: item.materialGroupId
            ? { id: item.materialGroupId, name: item.materialGroup }
            : null,
          function: item.function,
          rater: item.raterId ? { id: item.raterId, name: item.raterName } : null,
          status: item.status,
        })),
      })),
    });
  }

  get(auth: AuthContext, id: string): Promise<RoundDetail> {
    return this.run(auth, (tx, organization) => this.detail(tx, auth, organization.id, id));
  }

  create(auth: AuthContext, input: CreateRound): Promise<RoundDetail> {
    return this.run(auth, async (tx, organization) => {
      if (input.dueDate < today()) throw pastDue();
      const actor = await actorOf(tx, auth, organization.id);
      const id = await auditedChange(tx, actor, segmentationRoundAudit, async () => {
        const [row] = await tx
          .insert(schema.segmentationRound)
          .values({
            orgId: organization.id,
            name: input.name,
            dueDate: input.dueDate,
            createdBy: auth.userId,
          })
          .returning({ id: schema.segmentationRound.id });
        if (!row) throw new Error('Runde nicht angelegt');
        return {
          objectId: row.id,
          relationshipId: null,
          action: 'created',
          after: { name: input.name, due_date: input.dueDate, status: 'draft' },
          result: row.id,
        };
      });
      return this.detail(tx, auth, organization.id, id);
    });
  }

  updateDraft(auth: AuthContext, id: string, input: CreateRound): Promise<RoundDetail> {
    return this.run(auth, async (tx, organization) => {
      const round = await this.draft(tx, organization.id, id);
      if (input.dueDate < today()) throw pastDue();
      const actor = await actorOf(tx, auth, organization.id);
      await auditedChange(tx, actor, segmentationRoundAudit, async () => {
        await tx
          .update(schema.segmentationRound)
          .set({ name: input.name, dueDate: input.dueDate })
          .where(eq(schema.segmentationRound.id, id));
        return {
          objectId: id,
          relationshipId: null,
          action: 'updated',
          before: { name: round.name, due_date: round.dueDate },
          after: { name: input.name, due_date: input.dueDate },
          result: undefined,
        };
      });
      return this.detail(tx, auth, organization.id, id);
    });
  }

  candidates(auth: AuthContext, id: string): Promise<RoundCandidates> {
    return this.run(auth, async (tx, organization) => {
      await this.round(tx, organization.id, id);
      const relationships = await tx
        .select({ id: schema.relationship.id, name: supplierName })
        .from(schema.relationship)
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
            eq(schema.relationship.buyerOrgId, organization.id),
            eq(schema.relationship.status, 'active'),
          ),
        )
        .orderBy(asc(supplierName));
      const { units, groups } = await this.options(tx);
      const selected = new Set(
        (
          await tx
            .select({ relationshipId: schema.ratingAssignment.relationshipId })
            .from(schema.ratingAssignment)
            .where(eq(schema.ratingAssignment.roundId, id))
        ).map((row) => row.relationshipId),
      );
      return roundCandidatesSchema.parse({
        candidates: relationships.map((relationship) => ({
          relationshipId: relationship.id,
          name: relationship.name,
          businessUnits: units
            .filter((unit) => unit.relationshipId === relationship.id)
            .map(({ id: unitId, name }) => ({ id: unitId, name })),
          materialGroups: groups
            .filter((group) => group.relationshipId === relationship.id)
            .map(({ id: groupId, name }) => ({ id: groupId, name })),
          selected: selected.has(relationship.id),
        })),
      });
    });
  }

  raters(auth: AuthContext): Promise<RoundRaters> {
    return this.run(auth, async (tx, organization) => {
      const users = await tx
        .select({
          id: schema.appUser.id,
          name: schema.appUser.name,
          defaultFunction: schema.appUser.defaultFunction,
        })
        .from(schema.appUser)
        .where(eq(schema.appUser.organizationId, organization.id))
        .orderBy(asc(schema.appUser.name));
      return roundRatersSchema.parse({ raters: users });
    });
  }

  /** Vorschläge je Lieferant: BUs × Funktionen aus dem Team, sonst aus der Standardfunktion. */
  private async suggest(tx: TenantTransaction, orgId: string, relationshipId: string) {
    const units = await tx
      .select({ id: schema.relationshipBusinessUnit.businessUnitId })
      .from(schema.relationshipBusinessUnit)
      .where(eq(schema.relationshipBusinessUnit.relationshipId, relationshipId));
    const [group] = await tx
      .select({ id: schema.relationshipMaterialGroup.materialGroupId })
      .from(schema.relationshipMaterialGroup)
      .where(eq(schema.relationshipMaterialGroup.relationshipId, relationshipId))
      .orderBy(sql`${schema.relationshipMaterialGroup.isPrimary} desc`)
      .limit(1);

    const team = await tx
      .select({
        userId: schema.relationshipMember.userId,
        function: sql<UserFunction | null>`coalesce(${schema.relationshipMember.function}, ${schema.appUser.defaultFunction})`,
      })
      .from(schema.relationshipMember)
      .innerJoin(schema.appUser, eq(schema.appUser.id, schema.relationshipMember.userId))
      .where(
        and(
          eq(schema.relationshipMember.relationshipId, relationshipId),
          eq(schema.relationshipMember.orgId, orgId),
          sql`${schema.relationshipMember.teamRole} <> 'viewer'`,
        ),
      )
      .orderBy(asc(schema.relationshipMember.createdAt));

    const raterByFunction = new Map<UserFunction, string>();
    for (const member of team) {
      if (member.function && !raterByFunction.has(member.function)) {
        raterByFunction.set(member.function, member.userId);
      }
    }
    if (!raterByFunction.size) {
      const users = await tx
        .select({ id: schema.appUser.id, function: schema.appUser.defaultFunction })
        .from(schema.appUser)
        .where(
          and(eq(schema.appUser.organizationId, orgId), sql`${schema.appUser.orgRole} <> 'viewer'`),
        )
        .orderBy(asc(schema.appUser.name));
      for (const user of users) {
        if (user.function && !raterByFunction.has(user.function)) {
          raterByFunction.set(user.function, user.id);
        }
      }
    }
    const slots: [UserFunction, string | null][] = raterByFunction.size
      ? [...raterByFunction.entries()]
      : [['purchasing', null]];
    return units.flatMap((unit) =>
      slots.map(([fn, raterUserId]) => ({
        businessUnitId: unit.id,
        materialGroupId: group?.id ?? null,
        function: fn,
        raterUserId,
      })),
    );
  }

  setSuppliers(auth: AuthContext, id: string, input: SetRoundSuppliers): Promise<RoundDetail> {
    return this.run(auth, async (tx, organization) => {
      await this.draft(tx, organization.id, id);
      const wanted = [...new Set(input.relationshipIds)];
      if (wanted.length) {
        const valid = await tx
          .select({ id: schema.relationship.id })
          .from(schema.relationship)
          .where(
            and(
              inArray(schema.relationship.id, wanted),
              eq(schema.relationship.buyerOrgId, organization.id),
              eq(schema.relationship.status, 'active'),
            ),
          );
        if (valid.length !== wanted.length) {
          throw fail(400, 'supplier_invalid', 'Ein Lieferant ist nicht wählbar.');
        }
      }
      const existing = new Set(
        (
          await tx
            .select({ relationshipId: schema.ratingAssignment.relationshipId })
            .from(schema.ratingAssignment)
            .where(eq(schema.ratingAssignment.roundId, id))
        ).map((row) => row.relationshipId),
      );
      const removed = [...existing].filter((relationshipId) => !wanted.includes(relationshipId));
      if (removed.length) {
        await tx
          .delete(schema.ratingAssignment)
          .where(
            and(
              eq(schema.ratingAssignment.roundId, id),
              inArray(schema.ratingAssignment.relationshipId, removed),
            ),
          );
      }
      for (const relationshipId of wanted.filter((value) => !existing.has(value))) {
        const suggestions = await this.suggest(tx, organization.id, relationshipId);
        if (!suggestions.length) {
          throw fail(400, 'no_business_unit', 'Der Lieferant hat keine Business Unit.');
        }
        await tx
          .insert(schema.ratingAssignment)
          .values(
            suggestions.map((suggestion) => ({ ...suggestion, roundId: id, relationshipId })),
          );
      }
      return this.detail(tx, auth, organization.id, id);
    });
  }

  updateAssignment(
    auth: AuthContext,
    roundId: string,
    assignmentId: string,
    input: UpdateAssignment,
  ): Promise<RoundDetail> {
    return this.run(auth, async (tx, organization) => {
      await this.draft(tx, organization.id, roundId);
      if (input.raterUserId) await this.requireRater(tx, organization.id, input.raterUserId);
      const rows = await tx
        .update(schema.ratingAssignment)
        .set({ raterUserId: input.raterUserId })
        .where(
          and(
            eq(schema.ratingAssignment.id, assignmentId),
            eq(schema.ratingAssignment.roundId, roundId),
          ),
        )
        .returning({ id: schema.ratingAssignment.id });
      if (!rows.length) throw notFound();
      return this.detail(tx, auth, organization.id, roundId);
    });
  }

  private async requireRater(tx: TenantTransaction, orgId: string, userId: string) {
    const [user] = await tx
      .select({ id: schema.appUser.id })
      .from(schema.appUser)
      .where(and(eq(schema.appUser.id, userId), eq(schema.appUser.organizationId, orgId)));
    if (!user) throw fail(400, 'rater_invalid', 'Die Person gehört nicht zur Organisation.');
  }

  /** Genau eine Mail je Person, nur mit Titel, Frist und Link; dazu ein Verlaufseintrag. */
  private async invite(
    tx: TenantTransaction,
    auth: AuthContext,
    orgId: string,
    round: RoundRow,
    raterIds: string[],
  ) {
    if (!raterIds.length) return;
    const actor = await actorOf(tx, auth, orgId);
    const users = await tx
      .select({
        name: schema.appUser.name,
        givenName: schema.appUser.givenName,
        email: schema.appUser.email,
        locale: schema.appUser.locale,
      })
      .from(schema.appUser)
      .where(inArray(schema.appUser.id, raterIds));
    for (const user of users) {
      await auditedChange(tx, actor, ratingInvitationAudit, async () => ({
        objectId: round.id,
        relationshipId: null,
        action: 'created',
        after: { round: round.name },
        email: this.email.prepare({
          recipient: user.email,
          template: 'invitation',
          locale: user.locale ?? 'de',
          firstName: user.givenName ?? user.name.split(' ')[0],
          title: round.name,
          deadline: round.dueDate,
          link: '/bewertungen',
        }),
        result: undefined,
      }));
    }
  }

  start(auth: AuthContext, id: string): Promise<RoundDetail> {
    return this.run(auth, async (tx, organization) => {
      const round = await this.draft(tx, organization.id, id);
      if (round.dueDate < today()) throw pastDue();
      const rows = await this.assignmentRows(tx, organization.id, [id]);
      if (!rows.length) throw fail(400, 'no_assignments', 'Wähle mindestens einen Lieferanten.');
      if (rows.some((row) => !row.raterId)) {
        throw fail(400, 'rater_missing', 'Jede Zuordnung braucht eine bewertende Person.');
      }
      const [model] = await tx
        .select({ version: schema.segmentModel.version })
        .from(schema.segmentModel)
        .where(
          and(
            eq(schema.segmentModel.orgId, organization.id),
            eq(schema.segmentModel.status, 'active'),
          ),
        );
      if (!model) throw fail(409, 'no_active_model', 'Es gibt kein aktives Segmentmodell.');
      const actor = await actorOf(tx, auth, organization.id);
      await auditedChange(tx, actor, segmentationRoundAudit, async () => {
        await tx
          .update(schema.segmentationRound)
          .set({ status: 'open', modelVersion: model.version, startedAt: new Date() })
          .where(eq(schema.segmentationRound.id, id));
        return {
          objectId: id,
          relationshipId: null,
          action: 'updated',
          before: { status: 'draft', model_version: null },
          after: { status: 'open', model_version: model.version },
          result: undefined,
        };
      });
      const raterIds = [...new Set(rows.flatMap((row) => (row.raterId ? [row.raterId] : [])))];
      await this.invite(tx, auth, organization.id, round, raterIds);
      return this.detail(tx, auth, organization.id, id);
    });
  }

  /**
   * WG-18: Runde mit Geltungsbereich Warengruppe anlegen und gleich starten. Die Zuordnungen kommen
   * fertig besetzt aus der Warengruppe (Lieferanten und Team); Modell, Einladung und Verlauf wie bei
   * jeder Runde. Läuft in der Transaktion des Aufrufers, der die Rolle in der Warengruppe prüft.
   */
  async startCategoryIn(
    tx: TenantTransaction,
    auth: AuthContext,
    orgId: string,
    input: {
      materialGroupId: string;
      name: string;
      dueDate: string;
      slots: {
        relationshipId: string;
        businessUnitId: string;
        function: UserFunction;
        raterUserId: string;
      }[];
    },
  ): Promise<string> {
    if (input.dueDate < today()) throw pastDue();
    if (!input.slots.length)
      throw fail(400, 'no_assignments', 'Wähle mindestens einen Lieferanten.');
    const [model] = await tx
      .select({ version: schema.segmentModel.version })
      .from(schema.segmentModel)
      .where(and(eq(schema.segmentModel.orgId, orgId), eq(schema.segmentModel.status, 'active')));
    if (!model) throw fail(409, 'no_active_model', 'Es gibt kein aktives Segmentmodell.');
    const actor = await actorOf(tx, auth, orgId);
    const round = await auditedChange(tx, actor, segmentationRoundAudit, async () => {
      const [row] = await tx
        .insert(schema.segmentationRound)
        .values({
          orgId,
          name: input.name,
          dueDate: input.dueDate,
          status: 'open',
          scope: 'category',
          materialGroupId: input.materialGroupId,
          modelVersion: model.version,
          startedAt: new Date(),
          createdBy: auth.userId,
        })
        .returning();
      if (!row) throw new Error('Runde nicht angelegt');
      return {
        objectId: row.id,
        relationshipId: null,
        action: 'created',
        after: {
          name: input.name,
          due_date: input.dueDate,
          status: 'open',
          scope: 'category',
          material_group_id: input.materialGroupId,
          model_version: model.version,
        },
        result: row,
      };
    });
    await tx.insert(schema.ratingAssignment).values(
      input.slots.map((slot) => ({
        ...slot,
        roundId: round.id,
        materialGroupId: input.materialGroupId,
      })),
    );
    const raterIds = [...new Set(input.slots.map((slot) => slot.raterUserId))];
    await this.invite(tx, auth, orgId, round, raterIds);
    return round.id;
  }

  extend(auth: AuthContext, id: string, input: ExtendRound): Promise<RoundDetail> {
    return this.run(auth, async (tx, organization) => {
      const round = await this.round(tx, organization.id, id);
      if (round.status !== 'open') {
        throw fail(409, 'round_not_open', 'Nur eine offene Runde lässt sich verlängern.');
      }
      if (input.dueDate <= round.dueDate) {
        throw fail(400, 'due_date_not_later', 'Die neue Frist muss später sein.');
      }
      const actor = await actorOf(tx, auth, organization.id);
      await auditedChange(tx, actor, segmentationRoundAudit, async () => {
        await tx
          .update(schema.segmentationRound)
          .set({ dueDate: input.dueDate })
          .where(eq(schema.segmentationRound.id, id));
        return {
          objectId: id,
          relationshipId: null,
          action: 'updated',
          before: { due_date: round.dueDate },
          after: { due_date: input.dueDate },
          result: undefined,
        };
      });
      return this.detail(tx, auth, organization.id, id);
    });
  }

  close(auth: AuthContext, id: string): Promise<RoundDetail> {
    return this.run(auth, async (tx, organization) => {
      const round = await this.round(tx, organization.id, id);
      if (round.status !== 'open') {
        throw fail(409, 'round_not_open', 'Nur eine offene Runde lässt sich schließen.');
      }
      const actor = await actorOf(tx, auth, organization.id);
      await auditedChange(tx, actor, segmentationRoundAudit, async () => {
        await tx
          .update(schema.segmentationRound)
          .set({ status: 'closed', closedAt: new Date() })
          .where(eq(schema.segmentationRound.id, id));
        return {
          objectId: id,
          relationshipId: null,
          action: 'updated',
          before: { status: 'open' },
          after: { status: 'closed' },
          result: undefined,
        };
      });
      return this.detail(tx, auth, organization.id, id);
    });
  }

  /** Nachnominieren: Admin immer, SRO nur für Lieferanten, deren SRO die Person ist. */
  addAssignment(auth: AuthContext, id: string, input: AddAssignment): Promise<RoundDetail> {
    return this.run(auth, async (tx, organization) => {
      const scope = await this.scope(tx, auth, organization.id);
      const round = await this.round(tx, organization.id, id);
      if (!scope.admin && !scope.sroOf.has(input.relationshipId)) throw forbidden();
      if (round.status === 'closed') throw fail(409, 'round_closed', 'Die Runde ist geschlossen.');
      if (round.status === 'draft' && !scope.admin) throw notFound();
      const inRound = await tx
        .select({ id: schema.ratingAssignment.id })
        .from(schema.ratingAssignment)
        .where(
          and(
            eq(schema.ratingAssignment.roundId, id),
            eq(schema.ratingAssignment.relationshipId, input.relationshipId),
          ),
        )
        .limit(1);
      if (!inRound.length) throw notFound();

      const [unit] = await tx
        .select({ id: schema.relationshipBusinessUnit.id })
        .from(schema.relationshipBusinessUnit)
        .where(
          and(
            eq(schema.relationshipBusinessUnit.relationshipId, input.relationshipId),
            eq(schema.relationshipBusinessUnit.businessUnitId, input.businessUnitId),
          ),
        );
      if (!unit) {
        throw fail(400, 'business_unit_invalid', 'Die Business Unit gehört nicht zum Lieferanten.');
      }
      if (input.materialGroupId) {
        const [group] = await tx
          .select({ id: schema.relationshipMaterialGroup.id })
          .from(schema.relationshipMaterialGroup)
          .where(
            and(
              eq(schema.relationshipMaterialGroup.relationshipId, input.relationshipId),
              eq(schema.relationshipMaterialGroup.materialGroupId, input.materialGroupId),
            ),
          );
        if (!group) {
          throw fail(
            400,
            'material_group_invalid',
            'Die Warengruppe gehört nicht zum Lieferanten.',
          );
        }
      }
      await this.requireRater(tx, organization.id, input.raterUserId);

      await tx.insert(schema.ratingAssignment).values({
        roundId: id,
        relationshipId: input.relationshipId,
        businessUnitId: input.businessUnitId,
        materialGroupId: input.materialGroupId,
        function: input.function,
        raterUserId: input.raterUserId,
      });
      if (round.status === 'open') {
        await this.invite(tx, auth, organization.id, round, [input.raterUserId]);
      }
      return this.detail(tx, auth, organization.id, id);
    });
  }
}
