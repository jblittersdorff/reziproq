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
  schema,
  seedDefaultCatalog,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  appliesTo,
  type FormatItem,
  type PlaybookCatalog,
  type PlaybookPreview,
  playbookCatalogSchema,
  playbookPreviewSchema,
  type RuleItem,
  type SaveFormatItem,
  type SaveRuleItem,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import { formatCatalogAudit, ruleCatalogAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

type RuleRow = typeof schema.ruleCatalogItem.$inferSelect;
type FormatRow = typeof schema.formatCatalogItem.$inferSelect;

const toRule = (row: RuleRow): RuleItem => ({
  id: row.id,
  kind: row.kind,
  group: row.group,
  title: row.title,
  description: row.description,
  counterpartId: row.counterpartId,
  minImpactLevel: row.minImpactLevel,
});

const toFormat = (row: FormatRow): FormatItem => ({
  id: row.id,
  name: row.name,
  purpose: row.purpose,
  level: row.level,
  cadence: row.cadence,
  minImpactLevel: row.minImpactLevel,
  forQualityLevels: [...row.forQualityLevels].sort(),
});

/** Felder für den Verlauf, in den Namen der Spalten. */
const ruleAudit = (
  row: Pick<RuleRow, 'kind' | 'group' | 'title' | 'counterpartId' | 'minImpactLevel'>,
) => ({
  kind: row.kind,
  group: row.group,
  title: row.title,
  counterpart_id: row.counterpartId,
  min_impact_level: row.minImpactLevel,
});
const formatAudit = (
  row: Pick<FormatRow, 'name' | 'level' | 'cadence' | 'minImpactLevel' | 'forQualityLevels'>,
) => ({
  name: row.name,
  level: row.level,
  cadence: row.cadence,
  min_impact_level: row.minImpactLevel,
  for_quality_levels: row.forQualityLevels,
});

/**
 * PLB-01: Kataloge für Spielregeln und Formate. Der Standardkatalog kommt beim ersten Zugriff
 * einmalig in die Organisation. Jedes Recht soll einer Pflicht gegenüberstehen; die Verbindung
 * gilt in beide Richtungen und wird hier gepflegt.
 */
@Injectable()
export class PlaybookService {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  private run<T>(
    auth: AuthContext,
    work: (tx: TenantTransaction, organization: AccountOrganization) => Promise<T>,
  ) {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await seedDefaultCatalog(tx, organization.id);
      return work(tx, organization);
    });
  }

  private async read(tx: TenantTransaction, organizationId: string) {
    const rules = await tx
      .select()
      .from(schema.ruleCatalogItem)
      .where(eq(schema.ruleCatalogItem.orgId, organizationId))
      .orderBy(asc(schema.ruleCatalogItem.position), asc(schema.ruleCatalogItem.createdAt));
    const formats = await tx
      .select()
      .from(schema.formatCatalogItem)
      .where(eq(schema.formatCatalogItem.orgId, organizationId))
      .orderBy(asc(schema.formatCatalogItem.position), asc(schema.formatCatalogItem.createdAt));
    return { rules: rules.map(toRule), formats: formats.map(toFormat) };
  }

  catalog(auth: AuthContext): Promise<PlaybookCatalog> {
    return this.run(auth, async (tx, organization) =>
      playbookCatalogSchema.parse({
        ...(await this.read(tx, organization.id)),
        canManage: can(auth, 'spielregeln.verwalten'),
      }),
    );
  }

  /** Die Gegenseite muss im eigenen Katalog liegen und die andere Art haben. */
  private async checkCounterpart(
    tx: TenantTransaction,
    organizationId: string,
    input: SaveRuleItem,
    selfId: string | null,
  ) {
    if (!input.counterpartId) return;
    const [partner] = await tx
      .select({ id: schema.ruleCatalogItem.id, kind: schema.ruleCatalogItem.kind })
      .from(schema.ruleCatalogItem)
      .where(
        and(
          eq(schema.ruleCatalogItem.id, input.counterpartId),
          eq(schema.ruleCatalogItem.orgId, organizationId),
        ),
      );
    if (!partner || partner.id === selfId || partner.kind === input.kind) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'invalid_counterpart',
        message: 'Die Gegenseite muss ein Eintrag der anderen Art im eigenen Katalog sein.',
      });
    }
  }

  /** Verbindung in beide Richtungen: alte Partner lösen, neuen Partner auf diesen Eintrag zeigen lassen. */
  private async link(
    tx: TenantTransaction,
    organizationId: string,
    id: string,
    partner: string | null,
  ) {
    const own = eq(schema.ruleCatalogItem.orgId, organizationId);
    await tx
      .update(schema.ruleCatalogItem)
      .set({ counterpartId: null })
      .where(
        and(
          own,
          eq(schema.ruleCatalogItem.counterpartId, id),
          partner ? sql`${schema.ruleCatalogItem.id} <> ${partner}` : undefined,
        ),
      );
    if (!partner) return;
    await tx
      .update(schema.ruleCatalogItem)
      .set({ counterpartId: null })
      .where(
        and(
          own,
          sql`${schema.ruleCatalogItem.id} = (select counterpart_id from rule_catalog_item where id = ${partner})`,
          sql`${schema.ruleCatalogItem.id} <> ${id}`,
        ),
      );
    await tx
      .update(schema.ruleCatalogItem)
      .set({ counterpartId: id })
      .where(and(own, eq(schema.ruleCatalogItem.id, partner)));
  }

  saveRule(auth: AuthContext, id: string | null, input: SaveRuleItem): Promise<PlaybookCatalog> {
    if (!can(auth, 'spielregeln.verwalten')) throw forbidden();
    return this.run(auth, async (tx, organization) => {
      await this.checkCounterpart(tx, organization.id, input, id);
      const actor = await actorOf(tx, auth, organization.id);
      await auditedChange(tx, actor, ruleCatalogAudit, async () => {
        const values = {
          kind: input.kind,
          group: input.group,
          title: input.title,
          description: input.description,
          counterpartId: input.counterpartId,
          minImpactLevel: input.minImpactLevel,
        };
        if (id) {
          const [before] = await tx
            .select()
            .from(schema.ruleCatalogItem)
            .where(
              and(
                eq(schema.ruleCatalogItem.id, id),
                eq(schema.ruleCatalogItem.orgId, organization.id),
              ),
            )
            .for('update');
          if (!before) throw notFound();
          await tx
            .update(schema.ruleCatalogItem)
            .set(values)
            .where(eq(schema.ruleCatalogItem.id, id));
          await this.link(tx, organization.id, id, input.counterpartId);
          return {
            objectId: id,
            relationshipId: null,
            action: 'updated' as const,
            before: ruleAudit(before),
            after: ruleAudit(values),
            result: undefined,
          };
        }
        const [{ position = 0 } = {}] = await tx
          .select({
            position: sql<number>`coalesce(max(${schema.ruleCatalogItem.position}), 0)::int`,
          })
          .from(schema.ruleCatalogItem)
          .where(eq(schema.ruleCatalogItem.orgId, organization.id));
        const [row] = await tx
          .insert(schema.ruleCatalogItem)
          .values({ ...values, orgId: organization.id, position: position + 1 })
          .returning({ id: schema.ruleCatalogItem.id });
        if (!row) throw new Error('Eintrag nicht angelegt');
        await this.link(tx, organization.id, row.id, input.counterpartId);
        return {
          objectId: row.id,
          relationshipId: null,
          action: 'created' as const,
          after: ruleAudit(values),
          result: undefined,
        };
      });
      return playbookCatalogSchema.parse({
        ...(await this.read(tx, organization.id)),
        canManage: true,
      });
    });
  }

  saveFormat(
    auth: AuthContext,
    id: string | null,
    input: SaveFormatItem,
  ): Promise<PlaybookCatalog> {
    if (!can(auth, 'spielregeln.verwalten')) throw forbidden();
    return this.run(auth, async (tx, organization) => {
      const actor = await actorOf(tx, auth, organization.id);
      const values = {
        name: input.name,
        purpose: input.purpose,
        level: input.level,
        cadence: input.cadence,
        minImpactLevel: input.minImpactLevel,
        forQualityLevels: [...input.forQualityLevels].sort(),
      };
      await auditedChange(tx, actor, formatCatalogAudit, async () => {
        if (id) {
          const [before] = await tx
            .select()
            .from(schema.formatCatalogItem)
            .where(
              and(
                eq(schema.formatCatalogItem.id, id),
                eq(schema.formatCatalogItem.orgId, organization.id),
              ),
            )
            .for('update');
          if (!before) throw notFound();
          await tx
            .update(schema.formatCatalogItem)
            .set(values)
            .where(eq(schema.formatCatalogItem.id, id));
          return {
            objectId: id,
            relationshipId: null,
            action: 'updated' as const,
            before: formatAudit(before),
            after: formatAudit(values),
            result: undefined,
          };
        }
        const [{ position = 0 } = {}] = await tx
          .select({
            position: sql<number>`coalesce(max(${schema.formatCatalogItem.position}), 0)::int`,
          })
          .from(schema.formatCatalogItem)
          .where(eq(schema.formatCatalogItem.orgId, organization.id));
        const [row] = await tx
          .insert(schema.formatCatalogItem)
          .values({ ...values, orgId: organization.id, position: position + 1 })
          .returning({ id: schema.formatCatalogItem.id });
        if (!row) throw new Error('Format nicht angelegt');
        return {
          objectId: row.id,
          relationshipId: null,
          action: 'created' as const,
          after: formatAudit(values),
          result: undefined,
        };
      });
      return playbookCatalogSchema.parse({
        ...(await this.read(tx, organization.id)),
        canManage: true,
      });
    });
  }

  /** Was ein Lieferant dieses Typs bekäme; Name des Typs aus dem aktiven Segmentmodell. */
  preview(auth: AuthContext, impactLevel: number, qualityLevel: number): Promise<PlaybookPreview> {
    return this.run(auth, async (tx, organization) => {
      const { rules, formats } = await this.read(tx, organization.id);
      const [type] = await tx
        .select({ name: schema.segmentType.name })
        .from(schema.segmentType)
        .innerJoin(schema.segmentModel, eq(schema.segmentModel.id, schema.segmentType.modelId))
        .where(
          and(
            eq(schema.segmentModel.orgId, organization.id),
            eq(schema.segmentModel.status, 'active'),
            eq(schema.segmentType.impactLevel, impactLevel),
            eq(schema.segmentType.qualityLevel, qualityLevel),
          ),
        );
      return playbookPreviewSchema.parse({
        impactLevel,
        qualityLevel,
        typeName: type?.name ?? null,
        rules: rules.filter((rule) => appliesTo(rule, impactLevel, qualityLevel)),
        formats: formats.filter((format) => appliesTo(format, impactLevel, qualityLevel)),
      });
    });
  }
}
