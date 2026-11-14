import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
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
  desc,
  eq,
  schema,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type ExtendSurveyWave,
  type InviteSurveyParticipants,
  type StartSurveyWave,
  type SurveyFunction,
  type SurveyQuestion,
  type SurveySide,
  type SurveySuggestion,
  type SurveySuggestions,
  type SurveyWave,
  type SurveyWaveDetail,
  type SurveyWaves,
  surveyFunctions,
  surveySuggestionsSchema,
  surveyWaveDetailSchema,
  surveyWavesSchema,
  type TeamRole,
} from '@reziproq/shared';
import { AccountStore, TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import { surveyParticipantAudit, surveyWaveAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { CustomersService } from '../customers/customers.service.js';
import { EmailService } from '../email/email.service.js';
import { SurveyService } from './survey.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const conflict = (code: string) => new ConflictException({ statusCode: 409, code });
const invalid = (code: string) => new BadRequestException({ statusCode: 400, code });

/** Nur der Hash des persönlichen Links wird gespeichert (wie LIF-01a). */
export const hashSurveyToken = (token: string) => createHash('sha256').update(token).digest('hex');

export interface WaveScope {
  tx: TenantTransaction;
  auth: AuthContext;
  side: SurveySide;
  orgId: string;
  relationshipId: string;
  /** Teamrolle beim Käufer; beim Lieferanten null */
  teamRole: TeamRole | null;
  /** Für den Titel der Mail: Käufer und Lieferant */
  names: { buyer: string; supplier: string };
}

type WaveRow = typeof schema.surveyWave.$inferSelect;

const today = () => new Date().toISOString().slice(0, 10);
const isFunction = (value: string | null): value is SurveyFunction =>
  value !== null && (surveyFunctions as readonly string[]).includes(value);

/**
 * PUL-02a: Feedback-Welle anlegen und einladen. Der Käufer (SRO oder Admin) startet die Welle und
 * lädt Teilnehmende beider Seiten ein; der Lieferant lädt weitere eigene ein. Jede Seite sieht nur
 * ihre Einladungen; der Rücklauf je Seite ist eine Anzahl (app_survey_turnout).
 */
@Injectable()
export class WavesService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(CustomersService) private readonly customers: CustomersService,
    @Inject(SurveyService) private readonly surveys: SurveyService,
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(AccountStore) private readonly accounts: AccountStore,
  ) {}

  buyer<T>(auth: AuthContext, relationshipId: string, work: (scope: WaveScope) => Promise<T>) {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const [relationship] = await tx
        .select({
          id: schema.relationship.id,
          supplier: sql<string>`coalesce(${schema.relationshipSide.displayName}, ${schema.organization.name})`,
        })
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
        relationshipId,
        teamRole: member?.teamRole ?? null,
        names: { buyer: organization.name, supplier: relationship.supplier },
      });
    });
  }

  supplier<T>(auth: AuthContext, relationshipId: string, work: (scope: WaveScope) => Promise<T>) {
    return this.customers.inCustomer(auth, relationshipId, (tx, customer) =>
      work({
        tx,
        auth,
        side: 'supplier',
        orgId: auth.organization?.id as string,
        relationshipId,
        teamRole: null,
        names: { buyer: customer.name, supplier: auth.organization?.name ?? '' },
      }),
    );
  }

  /** Starten, Frist ändern: Käufer, SRO oder Admin. */
  private canLead(scope: WaveScope) {
    return (
      scope.side === 'buyer' &&
      can(scope.auth, 'feedback.verwalten', { teamRole: scope.teamRole }) &&
      (scope.auth.orgRole === 'admin' || scope.teamRole === 'sro')
    );
  }

  /** Einladen und die eigene Seite abschließen. */
  private canManage(scope: WaveScope) {
    return scope.side === 'buyer'
      ? this.canLead(scope)
      : can(scope.auth, 'feedback.verwalten', { teamRole: null });
  }

  private statusOf(row: WaveRow): SurveyWave['status'] {
    const bothClosed = row.buyerClosedAt !== null && row.supplierClosedAt !== null;
    return bothClosed || row.dueDate < today() ? 'closed' : 'open';
  }

  private async toWave(tx: TenantTransaction, row: WaveRow): Promise<SurveyWave> {
    const counts = await tx.execute<{ side: SurveySide; invited: number; completed: number }>(
      sql`select side, invited, completed from app_survey_turnout(${row.id})`,
    );
    const turnout = { buyer: { invited: 0, completed: 0 }, supplier: { invited: 0, completed: 0 } };
    for (const entry of counts.rows) {
      turnout[entry.side] = { invited: Number(entry.invited), completed: Number(entry.completed) };
    }
    return {
      id: row.id,
      kind: row.kind,
      templateVersion: row.templateVersion,
      dueDate: row.dueDate,
      createdAt: row.createdAt.toISOString(),
      createdByName: row.createdByName,
      buyerClosedAt: row.buyerClosedAt?.toISOString() ?? null,
      supplierClosedAt: row.supplierClosedAt?.toISOString() ?? null,
      status: this.statusOf(row),
      turnout,
    };
  }

  async list(scope: WaveScope): Promise<SurveyWaves> {
    const rows = await scope.tx
      .select()
      .from(schema.surveyWave)
      .where(eq(schema.surveyWave.relationshipId, scope.relationshipId))
      .orderBy(desc(schema.surveyWave.createdAt));
    const waves = [];
    for (const row of rows) waves.push(await this.toWave(scope.tx, row));
    return surveyWavesSchema.parse({ waves, canStart: this.canLead(scope) });
  }

  private async row(scope: WaveScope, waveId: string) {
    const [row] = await scope.tx
      .select()
      .from(schema.surveyWave)
      .where(
        and(
          eq(schema.surveyWave.id, waveId),
          eq(schema.surveyWave.relationshipId, scope.relationshipId),
        ),
      );
    if (!row) throw notFound();
    return row;
  }

  async detail(scope: WaveScope, waveId: string): Promise<SurveyWaveDetail> {
    const row = await this.row(scope, waveId);
    // RLS zeigt nur die eigenen Einladungen (intern); der Filter macht es ausdrücklich.
    const participants = await scope.tx
      .select()
      .from(schema.surveyParticipant)
      .where(
        and(
          eq(schema.surveyParticipant.waveId, waveId),
          eq(schema.surveyParticipant.ownerOrgId, scope.orgId),
        ),
      )
      .orderBy(asc(schema.surveyParticipant.side), asc(schema.surveyParticipant.invitedAt));
    const open = this.statusOf(row) === 'open';
    const ownClosed = scope.side === 'buyer' ? row.buyerClosedAt : row.supplierClosedAt;
    return surveyWaveDetailSchema.parse({
      wave: await this.toWave(scope.tx, row),
      ownSide: scope.side,
      participants: participants.map((entry) => ({
        id: entry.id,
        email: entry.email,
        name: entry.name,
        function: entry.function,
        invitedAt: entry.invitedAt.toISOString(),
        side: entry.side,
      })),
      canInvite: open && ownClosed === null && this.canManage(scope),
      canClose: open && ownClosed === null && this.canManage(scope),
      canExtend: open && this.canLead(scope),
    });
  }

  /** Vorschläge: Käufer aus Team und Kontakten des Lieferanten, Lieferant aus der eigenen Organisation. */
  async suggestions(scope: WaveScope): Promise<SurveySuggestions> {
    if (!this.canManage(scope)) throw forbidden();
    const { tx } = scope;
    const suggestions: SurveySuggestion[] = [];
    if (scope.side === 'buyer') {
      const team = await tx
        .select({
          name: schema.appUser.name,
          email: schema.appUser.email,
          function: schema.appUser.defaultFunction,
        })
        .from(schema.relationshipMember)
        .innerJoin(schema.appUser, eq(schema.appUser.id, schema.relationshipMember.userId))
        .where(
          and(
            eq(schema.relationshipMember.relationshipId, scope.relationshipId),
            eq(schema.relationshipMember.orgId, scope.orgId),
          ),
        )
        .orderBy(asc(schema.appUser.name));
      for (const person of team) {
        if (!person.email) continue;
        suggestions.push({
          side: 'buyer',
          name: person.name,
          email: person.email.toLowerCase(),
          function: isFunction(person.function) ? person.function : null,
          source: 'team',
        });
      }
      const contacts = await tx
        .select({
          name: schema.supplierContact.name,
          email: schema.supplierContact.email,
          function: schema.supplierContact.function,
        })
        .from(schema.supplierContact)
        .where(eq(schema.supplierContact.relationshipId, scope.relationshipId))
        .orderBy(asc(schema.supplierContact.name));
      for (const contact of contacts) {
        suggestions.push({
          side: 'supplier',
          name: contact.name,
          email: contact.email.toLowerCase(),
          function: isFunction(contact.function) ? contact.function : null,
          source: 'contact',
        });
      }
    } else {
      const colleagues = await tx
        .select({
          name: schema.appUser.name,
          email: schema.appUser.email,
          function: schema.appUser.defaultFunction,
        })
        .from(schema.appUser)
        .where(eq(schema.appUser.organizationId, scope.orgId))
        .orderBy(asc(schema.appUser.name));
      for (const person of colleagues) {
        if (!person.email) continue;
        suggestions.push({
          side: 'supplier',
          name: person.name,
          email: person.email.toLowerCase(),
          function: isFunction(person.function) ? person.function : null,
          source: 'colleague',
        });
      }
    }
    const templates =
      scope.side === 'buyer'
        ? Object.values(await this.surveys.ensureTemplates(tx, scope.orgId)).map((row) => ({
            kind: row.kind,
            version: row.version,
            questions: (row.questions as SurveyQuestion[]).filter((question) => question.active)
              .length,
          }))
        : [];
    return surveySuggestionsSchema.parse({ suggestions, templates });
  }

  async start(scope: WaveScope, input: StartSurveyWave): Promise<SurveyWaveDetail> {
    if (!this.canLead(scope)) throw forbidden();
    const { tx } = scope;
    if (input.dueDate < today()) throw invalid('frist_vergangen');
    this.checkDuplicates(input.participants);
    const latest = (await this.surveys.ensureTemplates(tx, scope.orgId))[input.kind];
    if (!(latest.questions as SurveyQuestion[]).some((question) => question.active)) {
      throw invalid('keine_aktiven_fragen');
    }
    // Je Art höchstens eine offene Welle, damit sich Rückläufe nicht vermischen.
    const existing = await tx
      .select()
      .from(schema.surveyWave)
      .where(
        and(
          eq(schema.surveyWave.relationshipId, scope.relationshipId),
          eq(schema.surveyWave.kind, input.kind),
        ),
      );
    if (existing.some((row) => this.statusOf(row) === 'open')) throw conflict('welle_offen');
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    const waveId = await auditedChange(tx, actor, surveyWaveAudit, async () => {
      const [row] = await tx
        .insert(schema.surveyWave)
        .values({
          relationshipId: scope.relationshipId,
          ownerOrgId: scope.orgId,
          visibility: 'shared',
          templateId: latest.id,
          templateVersion: latest.version,
          kind: input.kind,
          dueDate: input.dueDate,
          createdBy: scope.auth.userId,
          createdByName: actor.name,
        })
        .returning({ id: schema.surveyWave.id });
      if (!row) throw new Error('Welle nicht angelegt');
      return {
        objectId: row.id,
        relationshipId: scope.relationshipId,
        action: 'created' as const,
        after: {
          kind: input.kind,
          due_date: input.dueDate,
          buyer_closed: false,
          supplier_closed: false,
        },
        result: row.id,
      };
    });
    await this.addParticipants(scope, waveId, input.dueDate, input.participants);
    return this.detail(scope, waveId);
  }

  async invite(
    scope: WaveScope,
    waveId: string,
    input: InviteSurveyParticipants,
  ): Promise<SurveyWaveDetail> {
    const current = await this.detail(scope, waveId);
    if (!this.canManage(scope)) throw forbidden();
    if (!current.canInvite) throw conflict('welle_geschlossen');
    if (
      scope.side === 'supplier' &&
      input.participants.some((entry) => entry.side !== 'supplier')
    ) {
      throw forbidden();
    }
    this.checkDuplicates(input.participants);
    const taken = new Set(current.participants.map((entry) => entry.email.toLowerCase()));
    if (input.participants.some((entry) => taken.has(entry.email)))
      throw conflict('schon_eingeladen');
    await this.addParticipants(scope, waveId, current.wave.dueDate, input.participants);
    return this.detail(scope, waveId);
  }

  private checkDuplicates(participants: { email: string }[]) {
    const emails = participants.map((entry) => entry.email);
    if (new Set(emails).size !== emails.length) throw invalid('doppelt');
  }

  /** Je Person eine Einladung mit eigenem Link; die Mail geht über die Outbox (QS-01). */
  private async addParticipants(
    scope: WaveScope,
    waveId: string,
    dueDate: string,
    participants: StartSurveyWave['participants'],
  ) {
    const { tx } = scope;
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    const locale = await this.accounts.localeOf(scope.auth.userId);
    const deadline = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'de-DE', {
      dateStyle: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${dueDate}T00:00:00Z`));
    for (const participant of participants) {
      const token = randomBytes(32).toString('base64url');
      await auditedChange(tx, actor, surveyParticipantAudit, async () => {
        const [row] = await tx
          .insert(schema.surveyParticipant)
          .values({
            waveId,
            relationshipId: scope.relationshipId,
            ownerOrgId: scope.orgId,
            visibility: 'internal',
            side: participant.side,
            email: participant.email,
            name: participant.name,
            function: participant.function,
            tokenHash: hashSurveyToken(token),
            invitedBy: scope.auth.userId,
          })
          .returning({ id: schema.surveyParticipant.id });
        if (!row) throw new Error('Einladung nicht angelegt');
        return {
          objectId: row.id,
          relationshipId: scope.relationshipId,
          action: 'created' as const,
          after: { side: participant.side, function: participant.function },
          result: undefined,
          email: this.email.prepare({
            recipient: participant.email,
            template: 'survey',
            locale,
            ...(participant.name ? { firstName: participant.name.split(' ')[0] } : {}),
            title: `${scope.names.buyer} · ${scope.names.supplier}`,
            deadline,
            link: `/umfrage/${token}`,
          }),
        };
      });
    }
  }

  async extend(scope: WaveScope, waveId: string, input: ExtendSurveyWave) {
    if (!this.canLead(scope)) throw forbidden();
    const row = await this.row(scope, waveId);
    if (row.buyerClosedAt && row.supplierClosedAt) throw conflict('welle_geschlossen');
    if (input.dueDate < today() || input.dueDate <= row.dueDate) throw invalid('frist_frueher');
    const actor = await actorOf(scope.tx, scope.auth, scope.orgId);
    await auditedChange(scope.tx, actor, surveyWaveAudit, async () => {
      await scope.tx
        .update(schema.surveyWave)
        .set({ dueDate: input.dueDate })
        .where(eq(schema.surveyWave.id, waveId));
      return {
        objectId: waveId,
        relationshipId: scope.relationshipId,
        action: 'updated' as const,
        before: {
          kind: row.kind,
          due_date: row.dueDate,
          buyer_closed: row.buyerClosedAt !== null,
          supplier_closed: row.supplierClosedAt !== null,
        },
        after: {
          kind: row.kind,
          due_date: input.dueDate,
          buyer_closed: row.buyerClosedAt !== null,
          supplier_closed: row.supplierClosedAt !== null,
        },
        result: undefined,
      };
    });
    return this.detail(scope, waveId);
  }

  async close(scope: WaveScope, waveId: string) {
    const current = await this.detail(scope, waveId);
    if (!this.canManage(scope)) throw forbidden();
    if (!current.canClose) throw conflict('welle_geschlossen');
    const row = await this.row(scope, waveId);
    const actor = await actorOf(scope.tx, scope.auth, scope.orgId);
    await auditedChange(scope.tx, actor, surveyWaveAudit, async () => {
      await scope.tx.execute(sql`select app_survey_close(${waveId})`);
      const before = {
        kind: row.kind,
        due_date: row.dueDate,
        buyer_closed: row.buyerClosedAt !== null,
        supplier_closed: row.supplierClosedAt !== null,
      };
      return {
        objectId: waveId,
        relationshipId: scope.relationshipId,
        action: 'updated' as const,
        before,
        after: { ...before, [`${scope.side}_closed`]: true },
        result: undefined,
      };
    });
    return this.detail(scope, waveId);
  }
}
