import { GoneException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  and,
  auditedChange,
  currentTime,
  desc,
  eq,
  layerRegister,
  schema,
  sql,
  type TenantSession,
  type TenantTransaction,
} from '@reziproq/db';
import { type DataExportList, dataExportListSchema, dataExportValidHours } from '@reziproq/shared';
import { strToU8, zipSync } from 'fflate';
import { TenantDatabase } from '../../common/database.module.js';
import { dataExportAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CustomersService } from '../customers/customers.service.js';
import { EmailService } from '../email/email.service.js';

const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

/** Was der Job braucht, um in der Mandanten-Session der Organisation zu arbeiten. */
export interface DataExportJob {
  exportId: string;
  orgId: string;
  userId: string;
}

type Row = Record<string, unknown>;

/** Tabellen der eigenen Organisation: alles im Register außer globalen und dem Export selbst. */
export function exportTables(): string[] {
  return Object.entries(layerRegister)
    .filter(([table, entry]) => entry.kind !== 'global' && table !== 'data_export')
    .map(([table]) => table)
    .sort();
}

/**
 * Gehört die Zeile der eigenen Organisation? Geteilte Zeilen über owner_org_id, private über
 * org_id bzw. organization_id; eine Beziehung gehört beiden Seiten. Tabellen ohne solche Spalte
 * sind über ihre Eltern geschützt, RLS zeigt dort nur Eigenes.
 */
export function ownRow(table: string, row: Row, orgId: string): boolean {
  if (table === 'relationship') return row.buyer_org_id === orgId || row.supplier_org_id === orgId;
  if ('owner_org_id' in row) return row.owner_org_id === orgId;
  if ('org_id' in row) return row.org_id === orgId;
  if ('organization_id' in row) return row.organization_id === orgId;
  return true;
}

function csvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text =
    value instanceof Date
      ? value.toISOString()
      : Buffer.isBuffer(value)
        ? value.toString('base64')
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);
  return /[",\n\r;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(columns: string[], rows: Row[]): string {
  const lines = [columns.join(',')];
  for (const row of rows) lines.push(columns.map((column) => csvValue(row[column])).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

/**
 * QS-03: Gesamtexport der eigenen Organisation. Ein Admin fordert ihn an; der Job liest jede
 * Tabelle in der Mandanten-Session der Organisation (Lieferanten zusätzlich im Kontext jedes
 * Kunden), behält nur eigene Zeilen und legt eine ZIP-Datei ab: je Tabelle eine CSV, dazu
 * spalten.json. Danach geht eine Mail mit Link an die anfordernde Person. Nach 24 Stunden gibt es
 * die Datei nicht mehr.
 */
@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(CustomersService) private readonly customers: CustomersService,
    @Inject(EmailService) private readonly emails: EmailService,
  ) {}

  private session(auth: AuthContext): TenantSession {
    const organization = auth.organization;
    if (!organization) throw notFound();
    return { userId: auth.userId, organizationId: organization.id };
  }

  async list(auth: AuthContext, now = currentTime()): Promise<DataExportList> {
    const rows = await this.tenant.run(this.session(auth), (tx) =>
      tx
        .select({
          id: schema.dataExport.id,
          status: schema.dataExport.status,
          createdAt: schema.dataExport.createdAt,
          finishedAt: schema.dataExport.finishedAt,
          expiresAt: schema.dataExport.expiresAt,
          fileName: schema.dataExport.fileName,
        })
        .from(schema.dataExport)
        .orderBy(desc(schema.dataExport.createdAt))
        .limit(5),
    );
    return dataExportListSchema.parse({
      exports: rows.map((row) => ({
        id: row.id,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        finishedAt: row.finishedAt?.toISOString() ?? null,
        expiresAt: row.expiresAt?.toISOString() ?? null,
        fileName: row.fileName,
        downloadable: row.status === 'done' && row.expiresAt !== null && row.expiresAt > now,
      })),
    });
  }

  /** Anfordern: legt den Auftrag an; der Job übernimmt. */
  async request(auth: AuthContext): Promise<DataExportJob> {
    const session = this.session(auth);
    const customerOrgIds = [
      ...new Set((await this.customers.customersOf(auth)).map((entry) => entry.buyerOrgId)),
    ];
    const [row] = await this.tenant.run(session, (tx) =>
      tx
        .insert(schema.dataExport)
        .values({
          orgId: session.organizationId as string,
          requestedBy: auth.userId,
          customerOrgIds,
        })
        .returning({ id: schema.dataExport.id }),
    );
    if (!row) throw new Error('Export nicht angelegt');
    return { exportId: row.id, orgId: session.organizationId as string, userId: auth.userId };
  }

  /** Herunterladen: nur fertig und nur 24 Stunden lang. */
  async download(auth: AuthContext, exportId: string, now = currentTime()) {
    const [row] = await this.tenant.run(this.session(auth), (tx) =>
      tx.select().from(schema.dataExport).where(eq(schema.dataExport.id, exportId)),
    );
    if (row?.status !== 'done' || !row.file || !row.fileName) throw notFound();
    if (!row.expiresAt || row.expiresAt <= now) {
      throw new GoneException({ statusCode: 410, code: 'export_abgelaufen' });
    }
    return { fileName: row.fileName, buffer: row.file };
  }

  /** Der Job: Datei bauen, ablegen, Mail schreiben. */
  async process(job: DataExportJob, now = currentTime()): Promise<void> {
    const session: TenantSession = { userId: job.userId, organizationId: job.orgId };
    const [claimed] = await this.tenant.run(session, (tx) =>
      tx
        .update(schema.dataExport)
        .set({ status: 'running' })
        .where(and(eq(schema.dataExport.id, job.exportId), eq(schema.dataExport.status, 'pending')))
        .returning({ customerOrgIds: schema.dataExport.customerOrgIds }),
    );
    if (!claimed) return;
    try {
      const files = await this.collect(job, claimed.customerOrgIds);
      const fileName = `reziproq-export-${now.toISOString().slice(0, 10)}.zip`;
      const zip = Buffer.from(zipSync(files, { level: 6 }));
      const expiresAt = new Date(now.getTime() + dataExportValidHours * 60 * 60 * 1000);
      await this.tenant.run(session, async (tx) => {
        const recipient = await this.recipient(tx, job.userId);
        await auditedChange(
          tx,
          { userId: job.userId, name: recipient?.name ?? job.userId, organizationId: job.orgId },
          dataExportAudit,
          async () => {
            await tx
              .update(schema.dataExport)
              .set({ status: 'done', file: zip, fileName, expiresAt, finishedAt: now })
              .where(eq(schema.dataExport.id, job.exportId));
            return {
              relationshipId: null,
              objectId: job.exportId,
              action: 'updated' as const,
              before: { status: 'running' },
              after: { status: 'done' },
              ...(recipient
                ? {
                    email: this.emails.prepare({
                      template: 'export_ready',
                      locale: recipient.locale,
                      recipient: recipient.email,
                      ...(recipient.firstName ? { firstName: recipient.firstName } : {}),
                      title: fileName,
                      deadline: expiresAt.toISOString().slice(0, 16).replace('T', ' '),
                      link: '/einstellungen/export',
                    }),
                  }
                : {}),
              result: null,
            };
          },
        );
      });
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : 'Gesamtexport fehlgeschlagen');
      await this.tenant.run(session, (tx) =>
        tx
          .update(schema.dataExport)
          .set({ status: 'failed', finishedAt: now })
          .where(eq(schema.dataExport.id, job.exportId)),
      );
    }
  }

  private async recipient(tx: TenantTransaction, userId: string) {
    const [row] = await tx
      .select({
        email: schema.appUser.email,
        locale: schema.appUser.locale,
        name: schema.appUser.name,
        givenName: schema.appUser.givenName,
      })
      .from(schema.appUser)
      .where(eq(schema.appUser.id, userId));
    if (!row) return null;
    return {
      email: row.email,
      name: row.name,
      locale: row.locale ?? 'de',
      firstName: row.givenName ?? row.name.split(' ')[0] ?? null,
    };
  }

  /**
   * Alle Tabellen der Organisation, ohne die Ebenen zu umgehen: eine Session ohne und je eine im
   * Kontext jedes Kunden; gleiche Zeilen zählen einmal.
   */
  private async collect(job: DataExportJob, customerOrgIds: string[]) {
    const sessions: TenantSession[] = [
      { userId: job.userId, organizationId: job.orgId },
      ...customerOrgIds.map((customer) => ({
        userId: job.userId,
        organizationId: job.orgId,
        customerOrganizationId: customer,
      })),
    ];
    const tables = exportTables();
    const rows = new Map<string, Map<string, Row>>(tables.map((table) => [table, new Map()]));
    const columns = new Map<string, { name: string; type: string; nullable: boolean }[]>();
    for (const session of sessions) {
      await this.tenant.run(
        session,
        async (tx) => {
          for (const table of tables) {
            if (!/^[a-z_]+$/.test(table)) throw new Error(`Ungültiger Tabellenname ${table}`);
            const result = await tx.execute<Row>(sql.raw(`select * from "${table}"`));
            const bucket = rows.get(table) as Map<string, Row>;
            for (const row of result.rows) {
              if (!ownRow(table, row, job.orgId)) continue;
              const key = 'id' in row ? String(row.id) : JSON.stringify(row);
              bucket.set(key, row);
            }
            if (!columns.has(table)) {
              const described = await tx.execute<{
                column_name: string;
                data_type: string;
                is_nullable: string;
              }>(
                sql`select column_name, data_type, is_nullable from information_schema.columns
                    where table_schema = 'public' and table_name = ${table}
                    order by ordinal_position`,
              );
              columns.set(
                table,
                described.rows.map((column) => ({
                  name: column.column_name,
                  type: column.data_type,
                  nullable: column.is_nullable === 'YES',
                })),
              );
            }
          }
        },
        { readOnly: true },
      );
    }
    const files: Record<string, Uint8Array> = {};
    const description: Record<string, { rows: number; columns: unknown }> = {};
    for (const table of tables) {
      const tableColumns = columns.get(table) ?? [];
      const tableRows = [...(rows.get(table)?.values() ?? [])];
      files[`${table}.csv`] = strToU8(
        toCsv(
          tableColumns.map((column) => column.name),
          tableRows,
        ),
      );
      description[table] = { rows: tableRows.length, columns: tableColumns };
    }
    files['spalten.json'] = strToU8(
      JSON.stringify({ organization: job.orgId, tables: description }, null, 2),
    );
    return files;
  }
}
