import { and, eq, inArray, schema, type TenantTransaction } from '@reziproq/db';
import { type AiSettings, aiSettingsSchema, defaultAiSettings } from '@reziproq/shared';

/** Schlüssel in org_setting je Feld der Einstellungen KI (KI-01) */
export const aiSettingKeys = {
  publicResearch: 'ai_public_research',
  sourceKinds: 'ai_source_kinds',
  budgetMonthCents: 'ai_budget_month_cents',
  budgetRunCents: 'ai_budget_run_cents',
  maxSteps: 'ai_max_steps',
  customAgentRoles: 'ai_custom_agent_roles',
  customAgentApproval: 'ai_custom_agent_approval',
  agentBudgetOverrides: 'ai_agent_budget_overrides',
  valueFinderSegments: 'ai_value_finder_segments',
  valueAssumptions: 'ai_value_assumptions',
  workers: 'ai_workers',
} as const satisfies Record<keyof AiSettings, string>;

/** Einstellungen der Organisation; fehlende oder ungültige Werte nehmen den Startwert. */
export async function readAiSettings(tx: TenantTransaction, orgId: string): Promise<AiSettings> {
  const rows = await tx
    .select({ key: schema.orgSetting.key, value: schema.orgSetting.value })
    .from(schema.orgSetting)
    .where(
      and(
        eq(schema.orgSetting.orgId, orgId),
        inArray(schema.orgSetting.key, Object.values(aiSettingKeys)),
      ),
    );
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const merged = Object.fromEntries(
    Object.entries(aiSettingKeys).map(([field, key]) => [
      field,
      key in stored ? stored[key] : defaultAiSettings[field as keyof AiSettings],
    ]),
  );
  const parsed = aiSettingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : defaultAiSettings;
}
