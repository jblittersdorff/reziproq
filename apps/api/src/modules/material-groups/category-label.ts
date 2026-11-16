import { and, eq, inArray, schema, type TenantTransaction } from '@reziproq/db';
import { type CategoryLabel, categoryLabelSchema, defaultCategoryLabel } from '@reziproq/shared';

/** WG-01: Bezeichnung der Warengruppe dieser Organisation; ohne Einstellung „Warengruppe(n)“. */
export async function readCategoryLabel(
  tx: TenantTransaction,
  orgId: string,
): Promise<CategoryLabel> {
  const rows = await tx
    .select({ key: schema.orgSetting.key, value: schema.orgSetting.value })
    .from(schema.orgSetting)
    .where(
      and(
        eq(schema.orgSetting.orgId, orgId),
        inArray(schema.orgSetting.key, ['category_label_singular', 'category_label_plural']),
      ),
    );
  const of = (key: string) => rows.find((row) => row.key === key)?.value;
  const parsed = categoryLabelSchema.safeParse({
    singular: of('category_label_singular') ?? defaultCategoryLabel.singular,
    plural: of('category_label_plural') ?? defaultCategoryLabel.plural,
  });
  return parsed.success ? parsed.data : defaultCategoryLabel;
}
