import { and, eq, schema, type TenantTransaction } from '@reziproq/db';
import { defaultActionReminderDays } from '@reziproq/shared';

/** Erinnerungstage der Organisation der Session (QBR-04); ohne Eintrag der Standard. */
export async function readReminderDays(tx: TenantTransaction, orgId: string): Promise<number> {
  const [row] = await tx
    .select({ value: schema.orgSetting.value })
    .from(schema.orgSetting)
    .where(
      and(eq(schema.orgSetting.orgId, orgId), eq(schema.orgSetting.key, 'action_reminder_days')),
    );
  return typeof row?.value === 'number' ? row.value : defaultActionReminderDays;
}
