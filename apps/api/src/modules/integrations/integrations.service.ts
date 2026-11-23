import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, ne, schema, sql, type TenantTransaction } from '@reziproq/db';
import type { DueItem, Integrations } from '@reziproq/shared';
import { z } from 'zod';
import { IntegrationStore, TenantDatabase } from '../../common/database.module.js';
import { env } from '../../config/env.js';
import { ActivitiesService } from '../activities/activities.service.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { actorIn } from './actor.js';
import { type ConnectorDefinition, connectorOf, connectors } from './connectors.js';
import { FakeProvider, type ProviderItem } from './fake-provider.js';
import { IntegrationQueue, type QueuedJob } from './integration-queue.js';
import { ItemHandlers } from './item-handlers.js';
import { SecretBox } from './secret-box.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const badRequest = (code: string) => new BadRequestException({ statusCode: 400, code });
const conflict = (code: string) => new ConflictException({ statusCode: 409, code });

/** Die Schicht selbst, wenn sie ohne handelnde Person schreibt (Protokoll, Jobs) */
const systemUser = 'system:anbindungen';
const refreshAhead = 15 * 60 * 1000;
const eventLimit = 20;

type ConnectionRow = typeof schema.connection.$inferSelect;

/** Was ein Webhook mitbringen darf, gelesen erst nach der Prüfung der Signatur */
const hookPayloadSchema = z.object({
  items: z
    .array(
      z.object({
        externalId: z.string().min(1).max(200),
        kind: z.string().min(1).max(40),
        relationshipId: z.uuid().nullable().default(null),
        text: z.string().max(5000).default(''),
        // IN-03: Absender, SPF/DKIM und iCalendar-Teil einer Einladung
        data: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .max(500),
});

export const signatureHeader = 'x-reziproq-signature';

/** IN-03: Eingangsadresse eines Kunden, z. B. termine@nordwind-antriebe.reziproq.de */
export function inboundAddressOf(name: string): string {
  const slug =
    name
      .toLocaleLowerCase('de')
      .replaceAll('ä', 'ae')
      .replaceAll('ö', 'oe')
      .replaceAll('ü', 'ue')
      .replaceAll('ß', 'ss')
      .replace(/\b(gmbh|ag|se|kg|co|demo)\b/g, ' ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'kunde';
  return `termine@${slug}.reziproq.de`;
}

/** Signatur eines Webhooks: HMAC-SHA256 über den Rohinhalt, hex, mit Präfix sha256= */
export function signPayload(secret: string, body: Buffer | string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

/** Ein Fehlercode ohne Inhalte; Meldungen der Anbieter können Zugangsdaten enthalten */
function reasonOf(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'object' && response && 'code' in response) {
      return String((response as { code: unknown }).code).slice(0, 60);
    }
    return `http_${error.getStatus()}`;
  }
  if (error instanceof Error && /^[a-z_]{3,60}$/.test(error.message)) return error.message;
  return 'fehler';
}

/**
 * IN-01 Integrationsschicht: Zugänge je Kunde, Abgleiche im Hintergrund und eingehende Webhooks.
 * Daten aus Anbindungen entstehen nur über Domänendienste mit den Rechten der verbindenden Person
 * (can() im Dienst). Zugangsdaten stehen nur verschlüsselt in connection_secret und verlassen die
 * Schicht nur an den Anbieter.
 */
@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);
  /** Nur die Schicht verschlüsselt und entschlüsselt; Tests lesen hierüber das Webhook-Geheimnis */
  readonly box = new SecretBox(env.CONNECTION_SECRET_KEY);

  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(IntegrationStore) private readonly store: IntegrationStore,
    @Inject(ActivitiesService) private readonly activities: ActivitiesService,
    @Inject(FakeProvider) private readonly provider: FakeProvider,
    @Inject(IntegrationQueue) private readonly queue: IntegrationQueue,
    @Inject(ItemHandlers) private readonly handlers: ItemHandlers,
  ) {
    if (this.box.keyRef === 'ephemeral' && env.NODE_ENV !== 'test') {
      this.logger.warn(
        'CONNECTION_SECRET_KEY fehlt: Zugangsdaten gelten nur bis zum Neustart der API.',
      );
    }
  }

  private session(auth: AuthContext) {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return { userId: auth.userId, organizationId: organization.id };
  }

  private isAdmin(auth: AuthContext) {
    return can(auth, 'einstellungen.verwalten');
  }

  // ---------------------------------------------------------------- Lesen

  async overview(auth: AuthContext): Promise<Integrations> {
    const session = this.session(auth);
    if (!this.isAdmin(auth)) throw forbidden();
    return this.tenant.run(session, (tx) => this.overviewIn(tx, session.organizationId), {
      readOnly: true,
    });
  }

  private async overviewIn(tx: TenantTransaction, orgId: string): Promise<Integrations> {
    const rows = await tx
      .select()
      .from(schema.connection)
      .where(
        and(
          eq(schema.connection.orgId, orgId),
          eq(schema.connection.scope, 'org'),
          ne(schema.connection.status, 'revoked'),
        ),
      )
      .orderBy(desc(schema.connection.connectedAt));
    const views = await this.views(tx, rows);
    const events = await tx
      .select({
        id: schema.syncEvent.id,
        connectorKey: schema.connection.connectorKey,
        kind: schema.syncEvent.kind,
        status: schema.syncEvent.status,
        reason: schema.syncEvent.reason,
        createdAt: schema.syncEvent.createdAt,
      })
      .from(schema.syncEvent)
      .innerJoin(schema.connection, eq(schema.connection.id, schema.syncEvent.connectionId))
      .where(and(eq(schema.syncEvent.orgId, orgId), eq(schema.connection.scope, 'org')))
      .orderBy(desc(schema.syncEvent.createdAt), desc(schema.syncEvent.id))
      .limit(eventLimit);
    const list = connectors.map((connector) => {
      const row = rows.find((entry) => entry.connectorKey === connector.key);
      return {
        key: connector.key,
        group: connector.group,
        stage: connector.stage,
        parts: [...connector.parts],
        personal: connector.personal,
        provider: 'fake' as const,
        connection: row ? (views.get(row.id) ?? null) : null,
      };
    });
    const broken = rows.find((row) => row.status === 'error');
    const failing = list.find((entry) => (entry.connection?.lastJob?.itemsFailed ?? 0) > 0);
    const issue = broken
      ? {
          kind: 'error' as const,
          connectorKey: broken.connectorKey as Integrations['connectors'][number]['key'],
          count: 1,
        }
      : failing?.connection?.lastJob
        ? {
            kind: 'failed_items' as const,
            connectorKey: failing.key,
            count: failing.connection.lastJob.itemsFailed,
          }
        : null;
    return {
      connectors: list,
      events: events.map((event) => ({
        ...event,
        connectorKey: event.connectorKey as Integrations['events'][number]['connectorKey'],
        createdAt: event.createdAt.toISOString(),
      })),
      issue,
    };
  }

  async mine(auth: AuthContext) {
    const session = this.session(auth);
    return this.tenant.run(session, (tx) => this.mineIn(tx, auth), { readOnly: true });
  }

  private async mineIn(tx: TenantTransaction, auth: AuthContext) {
    const rows = await tx
      .select()
      .from(schema.connection)
      .where(
        and(
          eq(schema.connection.scope, 'user'),
          eq(schema.connection.userId, auth.userId),
          ne(schema.connection.status, 'revoked'),
        ),
      )
      .orderBy(desc(schema.connection.connectedAt));
    const views = await this.views(tx, rows);
    return {
      connections: rows.flatMap((row) => {
        const view = views.get(row.id);
        return view
          ? [{ connectorKey: row.connectorKey as ConnectorDefinition['key'], connection: view }]
          : [];
      }),
      available: connectors
        .filter((connector) => connector.personal && connector.stage === 1)
        .map((connector) => connector.key),
    };
  }

  private async views(tx: TenantTransaction, rows: ConnectionRow[]) {
    const ids = rows.map((row) => row.id);
    if (ids.length === 0) return new Map();
    const people = await tx
      .select({ id: schema.appUser.id, name: schema.appUser.name })
      .from(schema.appUser)
      .where(
        inArray(
          schema.appUser.id,
          rows.map((row) => row.connectedBy),
        ),
      );
    const jobs = await tx
      .selectDistinctOn([schema.syncJob.connectionId])
      .from(schema.syncJob)
      .where(inArray(schema.syncJob.connectionId, ids))
      .orderBy(
        schema.syncJob.connectionId,
        desc(schema.syncJob.createdAt),
        desc(schema.syncJob.id),
      );
    const hooks = await tx
      .select({
        connectionId: schema.inboundHook.connectionId,
        token: schema.inboundHook.pathToken,
      })
      .from(schema.inboundHook)
      .where(inArray(schema.inboundHook.connectionId, ids));
    return new Map(
      rows.map((row) => {
        const job = jobs.find((entry) => entry.connectionId === row.id);
        const hook = hooks.find((entry) => entry.connectionId === row.id);
        return [
          row.id,
          {
            id: row.id,
            scope: row.scope,
            status: row.status,
            parts: row.parts,
            connectedByName: people.find((person) => person.id === row.connectedBy)?.name ?? '',
            connectedAt: row.connectedAt.toISOString(),
            hookPath: hook ? `/api/anbindungen/eingang/${hook.token}` : null,
            inboundAddress:
              typeof row.settings.address === 'string' ? (row.settings.address as string) : null,
            allowedDomains: Array.isArray(row.settings.allowedDomains)
              ? (row.settings.allowedDomains as string[])
              : [],
            lastJob: job
              ? {
                  status: job.status,
                  itemsIn: job.itemsIn,
                  itemsOk: job.itemsOk,
                  itemsFailed: job.itemsFailed,
                  finishedAt: job.finishedAt?.toISOString() ?? null,
                }
              : null,
          },
        ];
      }),
    );
  }

  // ---------------------------------------------------------------- Verbinden, verwalten, trennen

  /** Verbindet eine Anbindung für die Organisation (nur Admins) oder für die Person selbst. */
  async connect(
    auth: AuthContext,
    key: string,
    input: { scope: 'org' | 'user'; parts?: string[] | undefined },
  ): Promise<void> {
    const session = this.session(auth);
    const connector = connectorOf(key);
    if (!connector) throw notFound();
    if (connector.stage !== 1) throw badRequest('kommt_spaeter');
    if (input.scope === 'org' && !this.isAdmin(auth)) throw forbidden();
    if (input.scope === 'user' && !connector.personal) throw badRequest('nicht_persoenlich');
    const parts = input.parts ?? [...connector.defaultParts];
    if (parts.some((part) => !connector.parts.includes(part))) throw badRequest('teil_unbekannt');
    const userId = input.scope === 'user' ? auth.userId : null;
    // Erst prüfen, dann beim Anbieter anmelden: sonst entsteht ein Zugang ohne Verbindung
    await this.tenant.run(session, async (tx) => {
      const [existing] = await tx
        .select({ id: schema.connection.id })
        .from(schema.connection)
        .where(
          and(
            eq(schema.connection.connectorKey, connector.key),
            eq(schema.connection.scope, input.scope),
            userId
              ? eq(schema.connection.userId, userId)
              : sql`${schema.connection.userId} is null`,
            ne(schema.connection.status, 'revoked'),
          ),
        );
      if (existing) throw conflict('schon_verbunden');
    });
    const granted = await this.provider.authorize(connector);
    await this.tenant.run(session, async (tx) => {
      const [created] = await tx
        .insert(schema.connection)
        .values({
          orgId: session.organizationId,
          connectorKey: connector.key,
          scope: input.scope,
          userId,
          status: 'active',
          parts,
          // IN-03: Eingangsadresse je Kunde; zugelassene Absender pflegt der Admin
          settings:
            connector.key === 'inbound_mail'
              ? { address: inboundAddressOf(auth.organization?.name ?? ''), allowedDomains: [] }
              : {},
          connectedBy: auth.userId,
        })
        .returning({ id: schema.connection.id });
      if (!created) throw new Error('connection_missing');
      const [main] = await tx
        .insert(schema.connectionSecret)
        .values({
          orgId: session.organizationId,
          connectionId: created.id,
          kind: connector.secretKind,
          ciphertext: this.box.seal(granted.token),
          keyRef: this.box.keyRef,
          expiresAt: granted.expiresAt,
        })
        .returning({ id: schema.connectionSecret.id });
      if (!main) throw new Error('secret_missing');
      if (connector.webhook) {
        // Das Geheimnis für die Signatur bekommt nur der Anbieter, nie die Oberfläche. Ist der
        // Zugang selbst ein Webhook-Geheimnis (Eingangsadresse), dient er auch als Signatur.
        let secretRef = main.id;
        if (connector.secretKind !== 'webhook_secret') {
          const [secret] = await tx
            .insert(schema.connectionSecret)
            .values({
              orgId: session.organizationId,
              connectionId: created.id,
              kind: 'webhook_secret',
              ciphertext: this.box.seal(randomBytes(32).toString('base64url')),
              keyRef: this.box.keyRef,
            })
            .returning({ id: schema.connectionSecret.id });
          if (!secret) throw new Error('secret_missing');
          secretRef = secret.id;
        }
        await tx.insert(schema.inboundHook).values({
          orgId: session.organizationId,
          connectionId: created.id,
          pathToken: randomBytes(24).toString('base64url'),
          secretRef,
        });
      }
      await this.log(tx, session.organizationId, created.id, 'out', 'connect', 'applied');
    });
  }

  private async ownConnection(tx: TenantTransaction, auth: AuthContext, id: string) {
    const [row] = await tx.select().from(schema.connection).where(eq(schema.connection.id, id));
    if (!row || row.status === 'revoked') throw notFound();
    // Organisationsweite Verbindungen nur Admins, eigene nur die Person selbst
    if (row.scope === 'org' ? !this.isAdmin(auth) : row.userId !== auth.userId) throw forbidden();
    return row;
  }

  async updateParts(auth: AuthContext, id: string, parts: string[]): Promise<void> {
    const session = this.session(auth);
    await this.tenant.run(session, async (tx) => {
      const row = await this.ownConnection(tx, auth, id);
      const connector = connectorOf(row.connectorKey);
      if (!connector || parts.some((part) => !connector.parts.includes(part))) {
        throw badRequest('teil_unbekannt');
      }
      await tx
        .update(schema.connection)
        .set({ parts: [...new Set(parts)] })
        .where(eq(schema.connection.id, id));
    });
  }

  /** IN-03: zugelassene Absender-Domains der Eingangsadresse (nur Admins) */
  async updateInboundSettings(auth: AuthContext, id: string, allowedDomains: string[]): Promise<void> {
    const session = this.session(auth);
    await this.tenant.run(session, async (tx) => {
      const row = await this.ownConnection(tx, auth, id);
      if (row.connectorKey !== 'inbound_mail') throw badRequest('keine_eingangsadresse');
      await tx
        .update(schema.connection)
        .set({ settings: { ...row.settings, allowedDomains: [...new Set(allowedDomains)] } })
        .where(eq(schema.connection.id, id));
    });
  }

  /**
   * IN-03: Zugang einer Person zu ihrem Kalender (persönliche Verbindung), z. B. um die Agenda in
   * den Termin zu schreiben. null ohne aktive Verbindung. Der Klartext bleibt in der Schicht.
   */
  async withUserToken<T>(
    orgId: string,
    userId: string,
    connectorKey: string,
    work: (token: string) => Promise<T>,
  ): Promise<T | null> {
    const token = await this.tenant.run({ userId: systemUser, organizationId: orgId }, async (tx) => {
      const [row] = await tx
        .select({ secret: schema.connectionSecret })
        .from(schema.connection)
        .innerJoin(
          schema.connectionSecret,
          eq(schema.connectionSecret.connectionId, schema.connection.id),
        )
        .where(
          and(
            eq(schema.connection.connectorKey, connectorKey),
            eq(schema.connection.scope, 'user'),
            eq(schema.connection.userId, userId),
            eq(schema.connection.status, 'active'),
            eq(schema.connectionSecret.kind, 'oauth'),
          ),
        );
      return row ? this.box.open(row.secret.ciphertext, row.secret.keyRef) : null;
    });
    return token ? work(token) : null;
  }

  /** IN-03: Eingangsadresse und zugelassene Absender des Kunden; null ohne aktive Eingangsadresse */
  async inboundMailOf(orgId: string): Promise<{ address: string; allowedDomains: string[] } | null> {
    return this.tenant.run({ userId: systemUser, organizationId: orgId }, async (tx) => {
      const [row] = await tx
        .select({ settings: schema.connection.settings })
        .from(schema.connection)
        .where(
          and(
            eq(schema.connection.connectorKey, 'inbound_mail'),
            eq(schema.connection.scope, 'org'),
            eq(schema.connection.status, 'active'),
          ),
        );
      if (!row || typeof row.settings.address !== 'string') return null;
      return {
        address: row.settings.address,
        allowedDomains: Array.isArray(row.settings.allowedDomains)
          ? (row.settings.allowedDomains as string[])
          : [],
      };
    });
  }

  /** Startet einen Abgleich im Hintergrund; die Antwort kommt sofort. */
  async sync(auth: AuthContext, id: string): Promise<string> {
    const session = this.session(auth);
    const jobId = await this.tenant.run(session, async (tx) => {
      const row = await this.ownConnection(tx, auth, id);
      if (row.status !== 'active') throw conflict('nicht_aktiv');
      const [running] = await tx
        .select({ id: schema.syncJob.id })
        .from(schema.syncJob)
        .where(
          and(
            eq(schema.syncJob.connectionId, id),
            inArray(schema.syncJob.status, ['queued', 'running']),
          ),
        );
      if (running) throw conflict('abgleich_laeuft');
      return this.createJob(tx, session.organizationId, id, 'sync');
    });
    await this.queue.send({ orgId: session.organizationId, jobId });
    return jobId;
  }

  private async createJob(
    tx: TenantTransaction,
    orgId: string,
    connectionId: string,
    kind: string,
  ) {
    const [job] = await tx
      .insert(schema.syncJob)
      .values({ orgId, connectionId, kind })
      .returning({ id: schema.syncJob.id });
    if (!job) throw new Error('job_missing');
    return job.id;
  }

  /**
   * Trennen: widerruft beim Anbieter, löscht die Zugangsdaten sofort und beendet Jobs. Ein
   * laufender Job endet nach dem aktuellen Element. Entstandene Objekte (Notizen) bleiben.
   */
  async disconnect(auth: AuthContext, id: string): Promise<void> {
    const session = this.session(auth);
    const { connector, tokens } = await this.tenant.run(session, async (tx) => {
      const row = await this.ownConnection(tx, auth, id);
      const secrets = await tx
        .delete(schema.connectionSecret)
        .where(eq(schema.connectionSecret.connectionId, id))
        .returning();
      await tx.delete(schema.inboundHook).where(eq(schema.inboundHook.connectionId, id));
      await tx
        .update(schema.connection)
        .set({ status: 'revoked', revokedAt: new Date() })
        .where(eq(schema.connection.id, id));
      await tx
        .update(schema.syncJob)
        .set({ status: 'failed', error: 'getrennt', finishedAt: new Date() })
        .where(and(eq(schema.syncJob.connectionId, id), eq(schema.syncJob.status, 'queued')));
      await this.log(tx, session.organizationId, id, 'out', 'disconnect', 'applied');
      return {
        connector: connectorOf(row.connectorKey),
        tokens: secrets
          .filter((secret) => secret.kind === connectorOf(row.connectorKey)?.secretKind)
          .map((secret) => this.box.open(secret.ciphertext, secret.keyRef)),
      };
    });
    if (!connector) return;
    for (const token of tokens) {
      if (!token) continue;
      // Widerruf beim Anbieter, wo möglich; scheitert er, sind die Zugangsdaten trotzdem gelöscht
      await this.provider.revoke(connector, token).catch(() => undefined);
    }
  }

  // ---------------------------------------------------------------- Abgleich

  /** Läuft im Job (pg-boss). Ein fehlerhaftes Element stoppt den Job nicht. */
  async runJob(job: QueuedJob): Promise<void> {
    const system = { userId: systemUser, organizationId: job.orgId };
    const start = await this.tenant.run(system, async (tx) => {
      const [row] = await tx
        .select({ job: schema.syncJob, connection: schema.connection })
        .from(schema.syncJob)
        .innerJoin(schema.connection, eq(schema.connection.id, schema.syncJob.connectionId))
        .where(eq(schema.syncJob.id, job.jobId));
      if (!row || !['queued', 'running'].includes(row.job.status)) return null;
      if (row.connection.status !== 'active') {
        await this.finish(tx, job.jobId, 'failed', 'getrennt');
        return null;
      }
      await tx
        .update(schema.syncJob)
        .set({ status: 'running', startedAt: new Date() })
        .where(eq(schema.syncJob.id, job.jobId));
      const [secret] = await tx
        .select()
        .from(schema.connectionSecret)
        .where(
          and(
            eq(schema.connectionSecret.connectionId, row.connection.id),
            eq(
              schema.connectionSecret.kind,
              connectorOf(row.connection.connectorKey)?.secretKind ?? 'oauth',
            ),
          ),
        );
      const relationships = await tx.execute<{ id: string; name: string; domains: string[] }>(sql`
        select r.id, coalesce(s.display_name, o.name) as name,
          array(select distinct d.domain from supplier_domain d
            where d.relationship_id = r.id and d.org_id = ${job.orgId} order by d.domain) as domains
        from relationship r
        join organization o on o.id = r.supplier_org_id
        left join relationship_side s on s.relationship_id = r.id and s.org_id = ${job.orgId}
        where r.buyer_org_id = ${job.orgId} and r.status = 'active'
        order by r.created_at, r.id limit 5`);
      return {
        connection: row.connection,
        token: secret ? this.box.open(secret.ciphertext, secret.keyRef) : null,
        relationships: relationships.rows,
        actor: await actorIn(tx, job.orgId, row.connection.connectedBy),
      };
    });
    if (!start) return;
    const connector = connectorOf(start.connection.connectorKey);
    if (!connector || !start.token) {
      await this.fail(job, start.connection.id, 'zugang_ungueltig');
      return;
    }
    let items: ProviderItem[];
    try {
      items =
        job.items ??
        (await this.provider.fetch(
          {
            connector,
            parts: start.connection.parts,
            personal: start.connection.scope === 'user',
            relationships: start.relationships,
          },
          start.token,
        ));
    } catch (error) {
      await this.tenant.run(system, (tx) => this.finish(tx, job.jobId, 'failed', reasonOf(error)));
      return;
    }
    const counts = { itemsIn: 0, itemsOk: 0, itemsFailed: 0 };
    let stopped = false;
    for (const [index, item] of items.entries()) {
      await this.provider.beforeItem?.(index);
      // Nach dem Trennen endet der Job vor dem nächsten Element
      const active = await this.tenant.run(system, async (tx) => {
        const [row] = await tx
          .select({ status: schema.connection.status })
          .from(schema.connection)
          .where(eq(schema.connection.id, start.connection.id));
        return row?.status === 'active';
      });
      if (!active) {
        stopped = true;
        break;
      }
      counts.itemsIn += 1;
      const outcome = await this.applyItem(job, start.connection, connector, start.actor, item);
      if (outcome === 'failed') counts.itemsFailed += 1;
      else counts.itemsOk += 1;
      await this.tenant.run(system, (tx) =>
        tx.update(schema.syncJob).set(counts).where(eq(schema.syncJob.id, job.jobId)),
      );
    }
    await this.tenant.run(system, (tx) =>
      stopped
        ? this.finish(tx, job.jobId, 'failed', 'getrennt')
        : this.finish(tx, job.jobId, 'done', null),
    );
  }

  private async applyItem(
    job: QueuedJob,
    connection: ConnectionRow,
    connector: ConnectorDefinition,
    actor: AuthContext | null,
    item: ProviderItem,
  ): Promise<'applied' | 'ignored' | 'failed'> {
    const connectionId = connection.id;
    const system = { userId: systemUser, organizationId: job.orgId };
    const known = await this.tenant.run(system, async (tx) => {
      const [row] = await tx
        .select({ id: schema.syncEvent.id })
        .from(schema.syncEvent)
        .where(
          and(
            eq(schema.syncEvent.connectionId, connectionId),
            eq(schema.syncEvent.kind, item.kind),
            eq(schema.syncEvent.externalId, item.externalId),
            eq(schema.syncEvent.status, 'applied'),
          ),
        );
      return Boolean(row);
    });
    const record = (
      status: 'applied' | 'ignored' | 'rejected' | 'failed',
      reason: string | null,
      objectId: string | null = null,
    ) =>
      this.tenant.run(system, (tx) =>
        this.log(tx, job.orgId, connectionId, 'in', item.kind, status, {
          jobId: job.jobId,
          externalId: item.externalId,
          reason,
          objectType: objectId ? item.kind : null,
          objectId,
        }),
      );
    if (known) {
      await record('ignored', 'schon_uebernommen');
      return 'ignored';
    }
    if (!connector.items.includes(item.kind as ConnectorDefinition['items'][number])) {
      await record('ignored', 'nicht_abgebildet');
      return 'ignored';
    }
    // Andere Elementarten bildet der Fachbereich ab, der sie angemeldet hat (IN-03: Termine)
    const handler = item.kind === 'note' ? undefined : this.handlers.get(item.kind);
    if (handler) {
      try {
        const outcome = await handler(
          {
            orgId: job.orgId,
            connectionId,
            connectorKey: connector.key,
            scope: connection.scope,
            userId: connection.userId,
            settings: connection.settings,
            actor,
          },
          item,
        );
        await record(outcome.status, outcome.reason ?? null, outcome.objectId ?? null);
        return outcome.status === 'failed' ? 'failed' : outcome.status === 'applied' ? 'applied' : 'ignored';
      } catch (error) {
        await record('failed', reasonOf(error));
        return 'failed';
      }
    }
    try {
      if (!actor) throw new Error('person_fehlt');
      if (!item.relationshipId) throw new Error('beziehung_fehlt');
      // Nur über den Domänendienst, mit can() und den Rechten der verbindenden Person
      const objectId = await this.activities.createNote(actor, item.relationshipId, {
        text: item.text,
        visibility: 'team',
      });
      await record('applied', null, objectId);
      return 'applied';
    } catch (error) {
      await record('failed', reasonOf(error));
      return 'failed';
    }
  }

  private async fail(job: QueuedJob, connectionId: string, reason: string) {
    await this.tenant.run({ userId: systemUser, organizationId: job.orgId }, async (tx) => {
      await tx
        .update(schema.connection)
        .set({ status: 'error' })
        .where(and(eq(schema.connection.id, connectionId), eq(schema.connection.status, 'active')));
      await this.finish(tx, job.jobId, 'failed', reason);
    });
  }

  private async finish(
    tx: TenantTransaction,
    jobId: string,
    status: 'done' | 'failed',
    error: string | null,
  ) {
    await tx
      .update(schema.syncJob)
      .set({ status, error, finishedAt: new Date() })
      .where(eq(schema.syncJob.id, jobId));
  }

  private async log(
    tx: TenantTransaction,
    orgId: string,
    connectionId: string,
    direction: 'in' | 'out',
    kind: string,
    status: 'applied' | 'ignored' | 'rejected' | 'failed',
    extra: {
      jobId?: string;
      externalId?: string;
      reason?: string | null;
      objectType?: string | null;
      objectId?: string | null;
    } = {},
  ) {
    await tx
      .insert(schema.syncEvent)
      .values({ orgId, connectionId, direction, kind, status, ...extra })
      // Zwei Jobs mit demselben Element: nur eines gilt als übernommen
      .onConflictDoNothing();
  }

  /**
   * IN-07: Eine Lieferung über die Import-API erscheint auf der Seite Anbindungen als Abgleich der
   * Import-API, mit Zeilen und Fehlern. Ohne verbundene Import-API bleibt es beim Import.
   */
  async recordDelivery(
    orgId: string,
    counts: { itemsIn: number; itemsOk: number; itemsFailed: number },
  ): Promise<void> {
    await this.tenant.run({ userId: systemUser, organizationId: orgId }, async (tx) => {
      const [connection] = await tx
        .select({ id: schema.connection.id })
        .from(schema.connection)
        .where(
          and(
            eq(schema.connection.connectorKey, 'import_api'),
            eq(schema.connection.scope, 'org'),
            eq(schema.connection.status, 'active'),
          ),
        );
      if (!connection) return;
      const now = new Date();
      await tx.insert(schema.syncJob).values({
        orgId,
        connectionId: connection.id,
        kind: 'delivery',
        status: 'done',
        ...counts,
        startedAt: now,
        finishedAt: now,
      });
      await this.log(
        tx,
        orgId,
        connection.id,
        'in',
        'delivery',
        counts.itemsFailed > 0 ? 'failed' : 'applied',
        counts.itemsFailed > 0 ? { reason: 'zeilen_mit_fehler' } : {},
      );
    });
  }

  // ---------------------------------------------------------------- Webhooks

  /**
   * Eingehender Webhook ohne Login. Erst die Signatur prüfen, dann lesen; sofort antworten und im
   * Job verarbeiten. Falsche Signatur oder unbekannte Adresse: abgelehnt.
   */
  async receive(token: string, signature: string | undefined, raw: Buffer): Promise<boolean> {
    const hook = await this.store.hook(token);
    if (!hook) {
      // Ohne Organisation gibt es kein Protokoll beim Kunden; nur ein Hinweis ohne Inhalte
      this.logger.warn('Webhook an unbekannte Adresse abgelehnt');
      return false;
    }
    const system = { userId: systemUser, organizationId: hook.orgId };
    const verdict = await this.tenant.run(system, async (tx) => {
      const [row] = await tx
        .select({ status: schema.connection.status, secret: schema.connectionSecret })
        .from(schema.inboundHook)
        .innerJoin(schema.connection, eq(schema.connection.id, schema.inboundHook.connectionId))
        .innerJoin(
          schema.connectionSecret,
          eq(schema.connectionSecret.id, schema.inboundHook.secretRef),
        )
        .where(eq(schema.inboundHook.pathToken, token));
      const secret = row ? this.box.open(row.secret.ciphertext, row.secret.keyRef) : null;
      const expected = secret ? Buffer.from(signPayload(secret, raw)) : null;
      const given = Buffer.from(signature ?? '');
      const valid =
        expected !== null && expected.length === given.length && timingSafeEqual(expected, given);
      if (!valid || row?.status !== 'active') {
        await this.log(tx, hook.orgId, hook.connectionId, 'in', 'webhook', 'rejected', {
          reason: valid ? 'nicht_aktiv' : 'signatur_falsch',
        });
        return null;
      }
      // Erst jetzt wird der Inhalt gelesen
      let payload: z.infer<typeof hookPayloadSchema>;
      try {
        payload = hookPayloadSchema.parse(JSON.parse(raw.toString('utf8')));
      } catch {
        await this.log(tx, hook.orgId, hook.connectionId, 'in', 'webhook', 'rejected', {
          reason: 'inhalt_ungueltig',
        });
        return null;
      }
      await tx
        .update(schema.inboundHook)
        .set({ lastSeenAt: new Date() })
        .where(eq(schema.inboundHook.pathToken, token));
      const jobId = await this.createJob(tx, hook.orgId, hook.connectionId, 'webhook');
      return { jobId, items: payload.items };
    });
    if (!verdict) return false;
    await this.queue.send({ orgId: hook.orgId, jobId: verdict.jobId, items: verdict.items });
    return true;
  }

  // ---------------------------------------------------------------- Erneuern

  /** Organisationen mit aktiven Verbindungen, nur IDs (für den Job „Erneuern“) */
  organizations(): Promise<string[]> {
    return this.store.organizations();
  }

  /**
   * Erneuert Zugangsdaten, die bald ablaufen. Scheitert das, wechselt die Verbindung auf error;
   * die Person bekommt auf der Startseite die Aufgabe „Verbindung erneuern“.
   */
  async refreshDue(orgId: string, now = new Date()): Promise<number> {
    const system = { userId: systemUser, organizationId: orgId };
    const due = await this.tenant.run(system, (tx) =>
      tx
        .select({ secret: schema.connectionSecret, connectorKey: schema.connection.connectorKey })
        .from(schema.connectionSecret)
        .innerJoin(
          schema.connection,
          eq(schema.connection.id, schema.connectionSecret.connectionId),
        )
        .where(
          and(
            eq(schema.connection.status, 'active'),
            eq(schema.connectionSecret.kind, 'oauth'),
            sql`${schema.connectionSecret.expiresAt} < ${new Date(now.getTime() + refreshAhead)}`,
          ),
        ),
    );
    let renewed = 0;
    for (const { secret, connectorKey } of due) {
      const connector = connectorOf(connectorKey);
      const token = this.box.open(secret.ciphertext, secret.keyRef);
      let fresh: Awaited<ReturnType<FakeProvider['refresh']>> | null = null;
      if (connector && token) {
        fresh = await this.provider.refresh(connector, token).catch(() => null);
      }
      await this.tenant.run(system, async (tx) => {
        if (!fresh) {
          await tx
            .update(schema.connection)
            .set({ status: 'error' })
            .where(eq(schema.connection.id, secret.connectionId));
          await this.log(tx, orgId, secret.connectionId, 'out', 'token_refresh', 'failed', {
            reason: 'erneuern_fehlgeschlagen',
          });
          return;
        }
        await tx
          .update(schema.connectionSecret)
          .set({
            ciphertext: this.box.seal(fresh.token),
            keyRef: this.box.keyRef,
            expiresAt: fresh.expiresAt,
            rotatedAt: new Date(),
          })
          .where(eq(schema.connectionSecret.id, secret.id));
        await this.log(tx, orgId, secret.connectionId, 'out', 'token_refresh', 'applied');
        renewed += 1;
      });
    }
    return renewed;
  }

  /** Startseite: Verbindungen mit Fehler; eigene für jede Person, die der Organisation für Admins */
  async dueItems(auth: AuthContext): Promise<DueItem[]> {
    const organization = auth.organization;
    if (!organization?.buyer) return [];
    const admin = this.isAdmin(auth);
    const rows = await this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      (tx) =>
        tx
          .select({
            id: schema.connection.id,
            key: schema.connection.connectorKey,
            scope: schema.connection.scope,
            userId: schema.connection.userId,
          })
          .from(schema.connection)
          .where(eq(schema.connection.status, 'error')),
      { readOnly: true },
    );
    const today = new Date().toISOString().slice(0, 10);
    return rows
      .filter((row) => (row.scope === 'org' ? admin : row.userId === auth.userId))
      .map((row) => ({
        id: `connection-${row.id}`,
        kind: 'connection_renew' as const,
        supplier: '',
        detail: row.key,
        dueDate: today,
        href: row.scope === 'org' ? '/einstellungen/anbindungen' : '/profil#verbindungen',
      }));
  }
}
