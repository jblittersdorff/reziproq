import { Body, Controller, ForbiddenException, Get, Inject, Put } from '@nestjs/common';
import { auditedChange, schema, sql } from '@reziproq/db';
import { type ActionReminderSetting, actionReminderSettingSchema } from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { actorOf } from '../audit/actor.js';
import { orgSettingAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { readReminderDays } from './action-settings.js';

/** QBR-04: Wie viele Tage vor der Frist erinnert wird; Admins beider Seiten, je Organisation. */
@Controller('massnahmen/einstellungen')
export class ActionSettingsController {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  private organization(auth: AuthContext) {
    if (!auth.organization) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    }
    return auth.organization;
  }

  @Get()
  @Requires('einstellungen.verwalten')
  get(@CurrentUser() auth: AuthContext): Promise<ActionReminderSetting> {
    const organization = this.organization(auth);
    return this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      async (tx) => ({
        reminderDays: await readReminderDays(tx, organization.id),
      }),
    );
  }

  @Put()
  @Requires('einstellungen.verwalten')
  update(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(actionReminderSettingSchema)) body: ActionReminderSetting,
  ): Promise<ActionReminderSetting> {
    const organization = this.organization(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const before = await readReminderDays(tx, organization.id);
      const actor = await actorOf(tx, auth, organization.id);
      await auditedChange(tx, actor, orgSettingAudit, async () => {
        await tx
          .insert(schema.orgSetting)
          .values({
            orgId: organization.id,
            key: 'action_reminder_days',
            value: body.reminderDays,
            updatedBy: auth.userId,
          })
          .onConflictDoUpdate({
            target: [schema.orgSetting.orgId, schema.orgSetting.key],
            set: { value: body.reminderDays, updatedBy: auth.userId, updatedAt: sql`now()` },
          });
        return {
          objectId: organization.id,
          relationshipId: null,
          action: 'updated' as const,
          before: { action_reminder_days: before },
          after: { action_reminder_days: body.reminderDays },
          result: undefined,
        };
      });
      return { reminderDays: body.reminderDays };
    });
  }
}
