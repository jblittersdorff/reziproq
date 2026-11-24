import { randomUUID } from 'node:crypto';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  and,
  asc,
  auditedChange,
  currentTime,
  desc,
  eq,
  inArray,
  schema,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  agendaTemplates,
  type CreateJbp,
  type JbpPreparation,
  type JbpSection,
  jbpPreparationSchema,
  jbpSections,
  type MeetingSide,
  type TeamRole,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import { jbpAudit, jbpBusinessUpdateAudit, meetingAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { CustomersService } from '../customers/customers.service.js';
import { topGapOf } from '../feedback/results.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

/** Agenda-Punkte tragen ihren Abschnitt als linked_object_type „jbp:<abschnitt>“. */
const sectionType = (section: JbpSection) => `jbp:${section}`;
const sectionOf = (type: string | null): JbpSection | null => {
  const key = type?.startsWith('jbp:') ? type.slice(4) : '';
  return (jbpSections as readonly string[]).includes(key) ? (key as JbpSection) : null;
};

export interface JbpScope {
  tx: TenantTransaction;
  auth: AuthContext;
  side: MeetingSide;
  orgId: string;
  buyerOrgId: string;
  relationshipId: string;
  /** Teamrolle beim Käufer; beim Lieferanten null */
  teamRole: TeamRole | null;
}

/**
 * JBP-01: Vorbereitung des Joint Business Planning für beide Seiten. Anlegen darf der Käufer (SRO
 * oder Admin); es erzeugt Plan, Termin der Art jbp und Agenda nach Vorlage in einem Schritt.
 * Geschäftsupdates schreibt jede Seite nur für sich (PLT-04).
 */
@Injectable()
export class JbpService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(CustomersService) private readonly customers: CustomersService,
  ) {}

  buyer<T>(auth: AuthContext, relationshipId: string, work: (scope: JbpScope) => Promise<T>) {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const [relationship] = await tx
        .select({ id: schema.relationship.id })
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
      return work({
        tx,
        auth,
        side: 'buyer',
        orgId: organization.id,
        buyerOrgId: organization.id,
        relationshipId,
        teamRole: member?.teamRole ?? null,
      });
    });
  }

  supplier<T>(auth: AuthContext, relationshipId: string, work: (scope: JbpScope) => Promise<T>) {
    return this.customers.inCustomer(auth, relationshipId, (tx, customer) =>
      work({
        tx,
        auth,
        side: 'supplier',
        orgId: auth.organization?.id as string,
        buyerOrgId: customer.buyerOrgId,
        relationshipId,
        teamRole: null,
      }),
    );
  }

  /** Der jüngste Gemeinsame Plan der Beziehung, wie die Session ihn sieht. */
  private async current(tx: TenantTransaction, relationshipId: string) {
    const [row] = await tx
      .select()
      .from(schema.jbp)
      .where(eq(schema.jbp.relationshipId, relationshipId))
      .orderBy(desc(schema.jbp.version))
      .limit(1);
    return row ?? null;
  }

  private canCreate(scope: JbpScope) {
    return (
      scope.side === 'buyer' &&
      can(scope.auth, 'jbp.anlegen', { teamRole: scope.teamRole }) &&
      (scope.auth.orgRole === 'admin' || scope.teamRole === 'sro')
    );
  }

  private canEditUpdate(scope: JbpScope) {
    if (!can(scope.auth, 'jbp.bearbeiten', { teamRole: scope.teamRole })) return false;
    // Beim Käufer schreibt, wer im Team ist, oder ein Admin; beim Lieferanten jede berechtigte Person.
    return scope.side === 'supplier' || scope.auth.orgRole === 'admin' || scope.teamRole !== null;
  }

  /** Freigegeben ist der Lieferantenplan, sobald im Zyklus eine Version freigegeben ist (SPL-07). */
  private async planApproved(tx: TenantTransaction, cycleId: string | undefined) {
    if (!cycleId) return false;
    const rows = await tx
      .select({ id: schema.supplierPlan.id })
      .from(schema.supplierPlan)
      .where(
        and(
          eq(schema.supplierPlan.cycleId, cycleId),
          inArray(schema.supplierPlan.status, ['approved', 'superseded']),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  /** WG-20: Warengruppen des Lieferanten ohne Strategie im laufenden Jahr, offene Widersprüche */
  private async categoryWarnings(tx: TenantTransaction, relationshipId: string) {
    const year = currentTime().getFullYear();
    const missing = await tx.execute<{ name: string }>(sql`
      select g.name from material_group g
      where g.active and g.id in (
        select material_group_id from relationship_material_group where relationship_id = ${relationshipId})
        and not exists (select 1 from material_group_strategy s
          where s.material_group_id = g.id and s.year = ${year})
      order by g.name`);
    const [open] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.materialGroupConflict)
      .where(
        and(
          eq(schema.materialGroupConflict.relationshipId, relationshipId),
          eq(schema.materialGroupConflict.status, 'open'),
        ),
      );
    return { withoutStrategy: missing.rows.map((row) => row.name), openConflicts: open?.n ?? 0 };
  }

  async preparation(scope: JbpScope): Promise<JbpPreparation> {
    const { tx } = scope;
    const plan = await this.current(tx, scope.relationshipId);
    // Der Zyklus ist käuferprivat; der Lieferant bekommt weder Termin-Vorschlag noch Hinweis.
    const [cycle] =
      scope.side === 'buyer'
        ? await tx
            .select({ id: schema.cycle.id, jbpDate: schema.cycle.jbpDate })
            .from(schema.cycle)
            .where(
              and(
                eq(schema.cycle.relationshipId, scope.relationshipId),
                eq(schema.cycle.status, 'active'),
              ),
            )
            .limit(1)
        : [];
    // Spielregeln erscheinen nur, wenn sie geteilt sind (SEG-10); Row-Level Security sorgt dafür.
    const [target] = await tx
      .select({
        typeName: schema.relationshipTarget.typeName,
        sharedAt: schema.relationshipTarget.sharedAt,
      })
      .from(schema.relationshipTarget)
      .where(eq(schema.relationshipTarget.relationshipId, scope.relationshipId));
    // PUL-03: Feedback-Ergebnis nur, wenn eine Welle aufgedeckt ist; für beide Seiten gleich.
    const [revealed] = await tx
      .select({
        id: schema.surveyWave.id,
        kind: schema.surveyWave.kind,
        revealedAt: schema.surveyWave.revealedAt,
      })
      .from(schema.surveyWave)
      .where(
        and(
          eq(schema.surveyWave.relationshipId, scope.relationshipId),
          sql`${schema.surveyWave.revealedAt} is not null`,
        ),
      )
      .orderBy(desc(schema.surveyWave.revealedAt))
      .limit(1);
    const live = {
      feedback: revealed?.revealedAt
        ? {
            waveId: revealed.id,
            kind: revealed.kind,
            revealedAt: revealed.revealedAt.toISOString(),
            topGap: await topGapOf(tx, revealed.id),
          }
        : null,
      rules: target ? { typeName: target.typeName, sharedAt: target.sharedAt.toISOString() } : null,
    };
    const buyerHint =
      scope.side === 'buyer'
        ? { supplierPlanApproved: await this.planApproved(tx, cycle?.id) }
        : null;
    const empty = {
      canCreate: false,
      suggestedDate: cycle?.jbpDate ?? null,
      live,
      ownSide: scope.side,
      buyerHint,
      // WG-20: nur beim Käufer; warnt bei fehlender Strategie oder offenem Widerspruch
      categories:
        scope.side === 'buyer' ? await this.categoryWarnings(tx, scope.relationshipId) : null,
    };

    if (!plan) {
      return jbpPreparationSchema.parse({
        ...empty,
        jbp: null,
        canCreate: this.canCreate(scope),
        meeting: null,
        agenda: [],
        updates: { buyer: null, supplier: null },
        canEditOwnUpdate: false,
      });
    }

    const updates = await tx
      .select()
      .from(schema.jbpBusinessUpdate)
      .where(eq(schema.jbpBusinessUpdate.jbpId, plan.id));
    const update = (side: MeetingSide) => {
      const row = updates.find((entry) => entry.side === side);
      return row ? { text: row.text, updatedAt: row.updatedAt.toISOString() } : null;
    };
    const buyerUpdate = update('buyer');
    const supplierUpdate = update('supplier');

    const [meeting] = plan.meetingId
      ? await tx.select().from(schema.meeting).where(eq(schema.meeting.id, plan.meetingId))
      : [];
    const participants = meeting
      ? await tx
          .select({ name: schema.meetingParticipant.name })
          .from(schema.meetingParticipant)
          .where(eq(schema.meetingParticipant.meetingId, meeting.id))
          .orderBy(asc(schema.meetingParticipant.position))
      : [];
    const agenda = meeting
      ? await tx
          .select()
          .from(schema.meetingAgendaItem)
          .where(eq(schema.meetingAgendaItem.meetingId, meeting.id))
      : [];
    // JBP-02: Themen sind bereit, sobald beide Seiten mindestens ein Thema haben, das offen oder
    // zu einer Initiative zusammengeführt ist (JBP-03).
    const topics = await tx
      .select({ side: schema.jbpTopic.side })
      .from(schema.jbpTopic)
      .where(
        and(
          eq(schema.jbpTopic.jbpId, plan.id),
          inArray(schema.jbpTopic.status, ['proposed', 'merged']),
        ),
      );
    // JBP-03: Initiativen sind bereit, sobald es mindestens eine gibt.
    const [initiative] = await tx
      .select({ id: schema.initiative.id })
      .from(schema.initiative)
      .where(eq(schema.initiative.jbpId, plan.id))
      .limit(1);
    // JBP-05: Zusagen sind bereit, sobald es mindestens eine gibt.
    const [commitment] = await tx
      .select({ id: schema.commitment.id })
      .from(schema.commitment)
      .where(eq(schema.commitment.jbpId, plan.id))
      .limit(1);
    const ready = (section: JbpSection | null) => {
      if (section === 'buyer_update') return Boolean(buyerUpdate?.text);
      if (section === 'supplier_update') return Boolean(supplierUpdate?.text);
      if (section === 'topics') {
        return (
          topics.some((row) => row.side === 'buyer') &&
          topics.some((row) => row.side === 'supplier')
        );
      }
      if (section === 'initiatives') return Boolean(initiative);
      if (section === 'commitments') return Boolean(commitment);
      // Die Scorecard meldet ihren Stand mit JBP-07.
      return section ? false : null;
    };
    // Erst die Punkte der Seite, die den Termin angelegt hat, dann die der anderen.
    const ordered = [...agenda].sort(
      (a, b) =>
        Number(a.ownerOrgId !== meeting?.ownerOrgId) -
          Number(b.ownerOrgId !== meeting?.ownerOrgId) || a.position - b.position,
    );

    return jbpPreparationSchema.parse({
      ...empty,
      jbp: { id: plan.id, version: plan.version, status: plan.status },
      meeting: meeting
        ? {
            id: meeting.id,
            title: meeting.title,
            startsAt: meeting.startsAt.toISOString(),
            location: meeting.location,
            participants: participants.map((entry) => entry.name),
          }
        : null,
      agenda: ordered.map((item) => {
        const section = sectionOf(item.linkedObjectType);
        return {
          id: item.id,
          title: item.title,
          side: item.ownerOrgId === scope.buyerOrgId ? 'buyer' : 'supplier',
          section,
          ready: ready(section),
        };
      }),
      updates: { buyer: buyerUpdate, supplier: supplierUpdate },
      canEditOwnUpdate: this.canEditUpdate(scope),
    });
  }

  /**
   * Gemeinsamen Plan anlegen: Plan, Termin der Art jbp und Agenda nach Vorlage in einem Schritt.
   * Der Verweis auf den Zyklus bleibt käuferprivat. Gibt es schon einen Plan, bleibt er.
   */
  async create(scope: JbpScope, input: CreateJbp): Promise<JbpPreparation> {
    if (!this.canCreate(scope)) throw forbidden();
    const { tx } = scope;
    if (await this.current(tx, scope.relationshipId)) return this.preparation(scope);
    const [user] = await tx
      .select({ name: schema.appUser.name })
      .from(schema.appUser)
      .where(eq(schema.appUser.id, scope.auth.userId));
    const creator = { createdBy: scope.auth.userId, createdByName: user?.name ?? '' };
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    const base = {
      relationshipId: scope.relationshipId,
      ownerOrgId: scope.orgId,
      visibility: 'shared' as const,
    };
    const meetingId = randomUUID();
    const jbpId = randomUUID();
    const title = `Joint Business Planning ${new Date(input.startsAt).getUTCFullYear()}`;

    await auditedChange(tx, actor, meetingAudit, async () => {
      await tx.insert(schema.meeting).values({
        ...base,
        id: meetingId,
        type: 'jbp',
        title,
        startsAt: new Date(input.startsAt),
        location: input.location,
        ...creator,
      });
      await tx.insert(schema.meetingAgendaItem).values(
        agendaTemplates.jbp[input.locale].map((itemTitle, index) => ({
          ...base,
          meetingId,
          title: itemTitle,
          position: index + 1,
          linkedObjectType: sectionType(jbpSections[index] as JbpSection),
          linkedObjectId: jbpId,
        })),
      );
      return {
        objectId: meetingId,
        relationshipId: scope.relationshipId,
        action: 'created' as const,
        after: { title, starts_at: input.startsAt, status: 'planned' },
        result: undefined,
      };
    });
    await auditedChange(tx, actor, jbpAudit, async () => {
      await tx.insert(schema.jbp).values({ ...base, id: jbpId, meetingId, ...creator });
      const [cycle] = await tx
        .select({ id: schema.cycle.id })
        .from(schema.cycle)
        .where(
          and(
            eq(schema.cycle.relationshipId, scope.relationshipId),
            eq(schema.cycle.status, 'active'),
          ),
        )
        .limit(1);
      if (cycle) {
        await tx
          .insert(schema.jbpCycleLink)
          .values({ relationshipId: scope.relationshipId, jbpId, cycleId: cycle.id });
      }
      return {
        objectId: jbpId,
        relationshipId: scope.relationshipId,
        action: 'created' as const,
        after: { version: 1, status: 'draft' },
        result: undefined,
      };
    });
    return this.preparation(scope);
  }

  /** Eigenes Geschäftsupdate schreiben; jede Seite nur ihres. */
  async saveUpdate(scope: JbpScope, text: string): Promise<JbpPreparation> {
    if (!this.canEditUpdate(scope)) throw forbidden();
    const { tx } = scope;
    const plan = await this.current(tx, scope.relationshipId);
    if (!plan) throw notFound();
    const [before] = await tx
      .select()
      .from(schema.jbpBusinessUpdate)
      .where(
        and(
          eq(schema.jbpBusinessUpdate.jbpId, plan.id),
          eq(schema.jbpBusinessUpdate.ownerOrgId, scope.orgId),
        ),
      );
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    await auditedChange(tx, actor, jbpBusinessUpdateAudit, async () => {
      if (before) {
        await tx
          .update(schema.jbpBusinessUpdate)
          .set({ text, updatedAt: currentTime() })
          .where(eq(schema.jbpBusinessUpdate.id, before.id));
      } else {
        await tx.insert(schema.jbpBusinessUpdate).values({
          relationshipId: scope.relationshipId,
          ownerOrgId: scope.orgId,
          visibility: 'shared',
          jbpId: plan.id,
          side: scope.side,
          text,
        });
      }
      return {
        objectId: `${plan.id}:${scope.side}`,
        relationshipId: scope.relationshipId,
        action: before ? ('updated' as const) : ('created' as const),
        before: before ? { text: before.text } : null,
        after: { text },
        result: undefined,
      };
    });
    return this.preparation(scope);
  }
}
