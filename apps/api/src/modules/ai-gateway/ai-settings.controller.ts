import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { and, auditedChange, currentTime, desc, eq, schema, sql } from '@reziproq/db';
import {
  type AiSettings,
  type AiSettingsResponse,
  type AiUsage,
  aiSettingsSchema,
  centsFromMicrocents,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { actorOf } from '../audit/actor.js';
import { orgSettingAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { aiSettingKeys, readAiSettings } from './ai-settings.js';
import { InsightSummaryService } from './insight-summary.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });

/** Nur Käufer; der Lieferant sieht weder Einstellungen noch Verbrauch (KI-01). */
function buyerOrganization(auth: AuthContext) {
  if (!auth.organization?.buyer) throw forbidden();
  return auth.organization;
}

/** KI-01: Einstellungen KI. Ändern und sehen darf, wer die Organisation verwaltet (Admin). */
@Controller('einstellungen/ki')
export class AiSettingsController {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  @Get()
  @Requires('einstellungen.verwalten')
  get(@CurrentUser() auth: AuthContext): Promise<AiSettingsResponse> {
    const organization = buyerOrganization(auth);
    if (!can(auth, 'einstellungen.verwalten')) throw forbidden();
    return this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      async (tx) => {
        const types = await tx
          .select({
            impact: schema.segmentType.impactLevel,
            quality: schema.segmentType.qualityLevel,
            name: schema.segmentType.name,
          })
          .from(schema.segmentType)
          .innerJoin(schema.segmentModel, eq(schema.segmentModel.id, schema.segmentType.modelId))
          .where(eq(schema.segmentModel.status, 'active'))
          .orderBy(desc(schema.segmentType.impactLevel), desc(schema.segmentType.qualityLevel));
        return {
          settings: await readAiSettings(tx, organization.id),
          euOnly: true as const,
          canEdit: auth.orgRole === 'admin',
          segmentTypes: types.map((type) => ({
            key: `${type.impact}-${type.quality}`,
            name: type.name,
          })),
        };
      },
      { readOnly: true },
    );
  }

  @Put()
  @Requires('einstellungen.verwalten')
  update(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(aiSettingsSchema)) body: AiSettings,
  ): Promise<AiSettingsResponse> {
    const organization = buyerOrganization(auth);
    if (!can(auth, 'einstellungen.verwalten') || auth.orgRole !== 'admin') throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const before = await readAiSettings(tx, organization.id);
      const actor = await actorOf(tx, auth, organization.id);
      const changed = (Object.keys(aiSettingKeys) as (keyof AiSettings)[]).filter(
        (field) => JSON.stringify(before[field]) !== JSON.stringify(body[field]),
      );
      if (changed.length > 0) {
        await auditedChange(tx, actor, orgSettingAudit, async () => {
          for (const field of changed) {
            const value = body[field];
            await tx
              .insert(schema.orgSetting)
              .values({
                orgId: organization.id,
                key: aiSettingKeys[field],
                value,
                updatedBy: auth.userId,
              })
              .onConflictDoUpdate({
                target: [schema.orgSetting.orgId, schema.orgSetting.key],
                set: { value, updatedBy: auth.userId, updatedAt: sql`app_now()` },
              });
          }
          const pick = (settings: AiSettings) =>
            Object.fromEntries(changed.map((field) => [aiSettingKeys[field], settings[field]]));
          return {
            objectId: organization.id,
            relationshipId: null,
            action: 'updated' as const,
            before: pick(before),
            after: pick(body),
            result: undefined,
          };
        });
      }
      return { settings: body, euOnly: true as const, canEdit: true };
    });
  }
}

/** KI-01: Kontingent des Monats für alle Käufer; die Aufteilung je Funktion nur für Admins. */
@Controller('ki/kontingent')
export class AiUsageController {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  @Get()
  @Requires('start.sehen')
  get(@CurrentUser() auth: AuthContext): Promise<AiUsage> {
    const organization = buyerOrganization(auth);
    return this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      async (tx) => {
        const settings = await readAiSettings(tx, organization.id);
        const rows = await tx
          .select({
            feature: schema.modelCall.feature,
            calls: sql<string>`count(*) filter (where ${schema.modelCall.outcome} = 'ok')`,
            microcents: sql<string>`coalesce(sum(${schema.modelCall.costMicrocents}), 0)`,
          })
          .from(schema.modelCall)
          .where(
            and(
              eq(schema.modelCall.orgId, organization.id),
              sql`${schema.modelCall.createdAt} >= date_trunc('month', app_now())`,
            ),
          )
          .groupBy(schema.modelCall.feature)
          .orderBy(sql`3 desc`);
        const totalMicrocents = rows.reduce((sum, row) => sum + Number(row.microcents), 0);
        return {
          month: currentTime().toISOString().slice(0, 7),
          budgetMonthCents: settings.budgetMonthCents,
          usedCents: centsFromMicrocents(totalMicrocents),
          calls: rows.reduce((sum, row) => sum + Number(row.calls), 0),
          byFeature:
            auth.orgRole === 'admin'
              ? rows.map((row) => ({
                  feature: row.feature,
                  calls: Number(row.calls),
                  costCents: centsFromMicrocents(Number(row.microcents)),
                }))
              : null,
        };
      },
      { readOnly: true },
    );
  }
}

/** AW-01: „Stimmt nicht“ zu einer Aussage; nur die eigene Aussage der Person. */
@Controller('aussagen')
export class InsightReportController {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(InsightSummaryService) private readonly summaries: InsightSummaryService,
  ) {}

  @Post(':id/stimmt-nicht')
  @Requires('wirkung.sehen')
  @HttpCode(204)
  async report(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    const organization = buyerOrganization(auth);
    const found = await this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      (tx) => this.summaries.report(tx, auth, id),
    );
    if (!found) throw new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
  }
}
