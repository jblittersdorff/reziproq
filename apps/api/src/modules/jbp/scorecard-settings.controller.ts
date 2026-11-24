import { Body, Controller, ForbiddenException, Get, Inject, Put } from '@nestjs/common';
import { auditedChange, currentTime, eq, schema } from '@reziproq/db';
import {
  defaultKpiTolerance,
  type ScorecardSetting,
  scorecardSettingSchema,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { actorOf } from '../audit/actor.js';
import { scorecardSettingAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';

/** JBP-09: Ab wie viel Prozent Rückstand eine Kennzahl „nicht auf Kurs“ ist; je Kunde. */
@Controller('scorecard/settings')
export class ScorecardSettingsController {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  private organization(auth: AuthContext) {
    if (!auth.organization?.buyer) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    }
    return auth.organization;
  }

  @Get()
  @Requires('einstellungen.verwalten')
  get(@CurrentUser() auth: AuthContext): Promise<ScorecardSetting> {
    const organization = this.organization(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const [row] = await tx
        .select({ tolerancePercent: schema.scorecardSetting.tolerancePercent })
        .from(schema.scorecardSetting)
        .where(eq(schema.scorecardSetting.orgId, organization.id));
      return { tolerancePercent: row?.tolerancePercent ?? defaultKpiTolerance };
    });
  }

  @Put()
  @Requires('einstellungen.verwalten')
  update(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(scorecardSettingSchema)) body: ScorecardSetting,
  ): Promise<ScorecardSetting> {
    const organization = this.organization(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const [before] = await tx
        .select()
        .from(schema.scorecardSetting)
        .where(eq(schema.scorecardSetting.orgId, organization.id));
      const actor = await actorOf(tx, auth, organization.id);
      await auditedChange(tx, actor, scorecardSettingAudit, async () => {
        if (before) {
          await tx
            .update(schema.scorecardSetting)
            .set({ tolerancePercent: body.tolerancePercent, updatedAt: currentTime() })
            .where(eq(schema.scorecardSetting.id, before.id));
        } else {
          await tx
            .insert(schema.scorecardSetting)
            .values({ orgId: organization.id, tolerancePercent: body.tolerancePercent });
        }
        return {
          objectId: organization.id,
          relationshipId: null,
          action: 'updated' as const,
          before: { tolerance_percent: before?.tolerancePercent ?? defaultKpiTolerance },
          after: { tolerance_percent: body.tolerancePercent },
          result: undefined,
        };
      });
      return { tolerancePercent: body.tolerancePercent };
    });
  }
}
