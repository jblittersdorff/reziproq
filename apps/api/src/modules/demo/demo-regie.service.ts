import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { currentTime, schema, sql } from '@reziproq/db';
import {
  type AiMode,
  type DemoRegie,
  type DemoRun,
  type DemoRunKey,
  type DemoSignalKey,
  type DemoSignalResult,
  type DemoTimeRequest,
  demoRegieSchema,
  demoSignalResultSchema,
} from '@reziproq/shared';
import { AccountStore, TenantDatabase } from '../../common/database.module.js';
import { MeetingBriefWorker } from '../agents/meeting-brief.worker.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CommitmentFollowupService } from '../commitments/commitment-followup.service.js';
import { HintsWorker } from '../hints/hints.worker.js';
import { ItemHandlers } from '../integrations/item-handlers.js';
import { OpportunitiesWorker } from '../opportunities/opportunities.worker.js';
import { berlinTime } from '../today/berlin.js';
import { TriageWorker } from '../today/triage.worker.js';
import { dueRuns, nextMorningRun } from './demo-clock.js';
import { demoSignals, forwardedItem } from './demo-signals.js';

const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

interface Session {
  userId: string;
  organizationId: string;
}

/**
 * DM-01 (K1-g.1): Demo-Regie. Die Uhr rückt nur vorwärts und führt unterwegs die fälligen Läufe für
 * alle Organisationen der Demo aus, jeden zu seiner Zeit und in zeitlicher Reihenfolge (T1-DM5).
 * Zurücksetzen lädt den Stand „start“ aus dem Seed (T1-DM3). Jede Aktion steht im Protokoll
 * demo_event. Außerhalb des Demo-Mandanten gibt es die Regie nicht (404, T1-DM2).
 */
@Injectable()
export class DemoRegieService {
  private readonly logger = new Logger(DemoRegieService.name);

  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(AccountStore) private readonly accounts: AccountStore,
    @Inject(TriageWorker) private readonly triage: TriageWorker,
    @Inject(CommitmentFollowupService) private readonly followup: CommitmentFollowupService,
    @Inject(HintsWorker) private readonly hints: HintsWorker,
    @Inject(MeetingBriefWorker) private readonly brief: MeetingBriefWorker,
    @Inject(OpportunitiesWorker) private readonly opportunities: OpportunitiesWorker,
    @Inject(ItemHandlers) private readonly handlers: ItemHandlers,
  ) {}

  async state(auth: AuthContext, runs: DemoRun[] = []): Promise<DemoRegie> {
    const session = await this.session(auth);
    const [row] = await this.tenant.run(
      session,
      async (tx) =>
        (
          await tx.execute<{ demo_now: string | Date | null; ai_mode: AiMode }>(
            sql`select demo_now, ai_mode from organization where id = ${session.organizationId}`,
          )
        ).rows,
      { readOnly: true },
    );
    const demoNow = row?.demo_now ? new Date(row.demo_now) : currentTime();
    return demoRegieSchema.parse({
      demoNow: demoNow.toISOString(),
      mode: row?.ai_mode ?? 'live',
      runs,
    });
  }

  /** Neuer Tag (06:00-Lauf), eine Stunde weiter oder auf ein Datum springen (07:30 in Berlin) */
  async advance(auth: AuthContext, request: DemoTimeRequest): Promise<DemoRegie> {
    const session = await this.session(auth);
    const from = (await this.accounts.demoNowOf(session.organizationId)) ?? currentTime();
    const to =
      request.aktion === 'stunde'
        ? new Date(from.getTime() + 3_600_000)
        : request.aktion === 'neuer_tag'
          ? nextMorningRun(from)
          : berlinTime(request.datum, 7, 30);
    if (to <= from) throw new BadRequestException({ statusCode: 400, code: 'nur_vorwaerts' });
    const orgs = await this.tenant.run(
      session,
      async (tx) =>
        (await tx.execute<{ id: string }>(sql`select app_demo_orgs() as id`)).rows.map(
          (row) => row.id,
        ),
      { readOnly: true },
    );
    const runs = dueRuns(from, to);
    for (const run of runs) {
      await this.setClock(session, run.at);
      await this.execute(run.key, orgs, run.at);
    }
    await this.setClock(session, to);
    const done = runs.map((run) => ({ key: run.key, at: run.at.toISOString() }));
    await this.log(
      session,
      `zeit.${request.aktion}`,
      { von: from.toISOString(), bis: to.toISOString(), laeufe: done },
      to,
    );
    return this.state(auth, done);
  }

  /** Zurücksetzen: Stand „start“ für alle Organisationen der Demo (Mo 23.11., 07:30) */
  async reset(auth: AuthContext): Promise<DemoRegie> {
    const session = await this.session(auth);
    try {
      await this.tenant.run(session, (tx) => tx.execute(sql`select app_demo_stand_laden('start')`));
    } catch (error) {
      // Ohne Seed gibt es den Stand nicht: erst pnpm demo:hollmann
      if ((error as { cause?: { code?: string } }).cause?.code === 'P0002') {
        throw new ConflictException({ statusCode: 409, code: 'stand_fehlt' });
      }
      throw error;
    }
    const demoNow = (await this.accounts.demoNowOf(session.organizationId)) ?? currentTime();
    await this.log(session, 'zuruecksetzen', {}, demoNow);
    return this.state(auth);
  }

  /**
   * Signal einspielen (K1-g.4): durch denselben Dienst wie das echte Ereignis (T1-DM4). Jede
   * Auslösung ist eine eigene Mail; ohne die Person der Geschichte gibt es das Signal hier nicht.
   */
  async signal(auth: AuthContext, key: DemoSignalKey): Promise<DemoSignalResult> {
    const session = await this.session(auth);
    const signal = demoSignals[key];
    const handler = this.handlers.get(signal.kind);
    const [forwarder] = await this.tenant.run(
      session,
      async (tx) =>
        (
          await tx.execute<{ email: string }>(sql`
            select email from app_user
            where id = ${signal.forwardedBy} and organization_id = ${session.organizationId}`)
        ).rows,
      { readOnly: true },
    );
    if (!handler || !forwarder) {
      throw new ConflictException({ statusCode: 409, code: 'signal_nicht_im_demo' });
    }
    const outcome = await handler(
      {
        orgId: session.organizationId,
        connectionId: 'demo-regie',
        connectorKey: 'demo',
        scope: 'org',
        userId: null,
        settings: { allowedDomains: [forwarder.email.split('@')[1] ?? ''] },
        actor: null,
      },
      forwardedItem(signal, forwarder.email, `demo-${key}-${randomUUID()}`),
    );
    const result = demoSignalResultSchema.parse({
      key,
      status: outcome.status,
      objectType: outcome.objectType ?? null,
    });
    const demoNow = (await this.accounts.demoNowOf(session.organizationId)) ?? currentTime();
    await this.log(session, `signal.${key}`, result, demoNow);
    return result;
  }

  /** Antworten der KI für alle Organisationen der Demo (Aufzeichnen, Abspielen, Live) */
  async mode(auth: AuthContext, mode: AiMode): Promise<DemoRegie> {
    const session = await this.session(auth);
    await this.tenant.run(session, (tx) => tx.execute(sql`select app_demo_modus_alle(${mode})`));
    const demoNow = (await this.accounts.demoNowOf(session.organizationId)) ?? currentTime();
    await this.log(session, 'modus', { mode }, demoNow);
    return this.state(auth);
  }

  /** Nur im Demo-Mandanten; sonst gibt es die Regie nicht (T1-DM2) */
  private async session(auth: AuthContext): Promise<Session> {
    const orgId = auth.organization?.id;
    if (!orgId || !(await this.accounts.isDemoOrganization(orgId))) throw notFound();
    return { userId: auth.userId, organizationId: orgId };
  }

  private async setClock(session: Session, at: Date) {
    await this.tenant.run(session, (tx) =>
      tx.execute(sql`select app_demo_uhr_setzen(${at.toISOString()}::timestamptz)`),
    );
  }

  /** Ein Lauf für alle Organisationen der Demo; ein Fehler hält die Uhr nicht an (wie im Betrieb) */
  private async execute(key: DemoRunKey, orgs: string[], at: Date) {
    try {
      if (key === 'wertfinder') await this.opportunities.runMonthly(orgs);
      if (key === 'briefing') {
        await this.brief.runDue(orgs, at);
        await this.brief.captureDue(orgs, at);
      }
      if (key === 'nachhalten') await this.followup.runDaily(orgs);
      if (key === 'triage') await this.triage.runDue(orgs);
      if (key === 'hinweise') await this.hints.runDaily(orgs);
    } catch (error) {
      this.logger.warn(
        `Demo-Lauf ${key} ${at.toISOString()}: ${error instanceof Error ? error.message : 'Fehler'}`,
      );
    }
  }

  private async log(session: Session, kind: string, payload: object, demoNow: Date) {
    await this.tenant.run(session, (tx) =>
      tx.insert(schema.demoEvent).values({
        orgId: session.organizationId,
        kind,
        payload,
        actorUserId: session.userId,
        demoNow,
      }),
    );
  }
}
