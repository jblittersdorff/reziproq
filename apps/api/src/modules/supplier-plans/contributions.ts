import { and, asc, eq, schema, type TenantTransaction } from '@reziproq/db';
import type { PlanContribution } from '@reziproq/shared';

/** Alle Beiträge eines Plans samt Bezug und Person, nach Frist sortiert. */
export async function readContributions(
  tx: TenantTransaction,
  relationshipId: string,
  planId: string,
  contributionId?: string,
): Promise<PlanContribution[]> {
  const rows = await tx
    .select({
      id: schema.planContribution.id,
      businessUnitId: schema.businessUnit.id,
      businessUnitName: schema.businessUnit.name,
      materialGroupId: schema.materialGroup.id,
      materialGroupName: schema.materialGroup.name,
      assigneeUserId: schema.planContribution.assigneeUserId,
      assigneeName: schema.appUser.name,
      dueDate: schema.planContribution.dueDate,
      status: schema.planContribution.status,
      doneAt: schema.planContribution.doneAt,
    })
    .from(schema.planContribution)
    .innerJoin(schema.appUser, eq(schema.appUser.id, schema.planContribution.assigneeUserId))
    .leftJoin(
      schema.businessUnit,
      eq(schema.businessUnit.id, schema.planContribution.businessUnitId),
    )
    .leftJoin(
      schema.materialGroup,
      eq(schema.materialGroup.id, schema.planContribution.materialGroupId),
    )
    .where(
      and(
        eq(schema.planContribution.planId, planId),
        eq(schema.planContribution.relationshipId, relationshipId),
        contributionId ? eq(schema.planContribution.id, contributionId) : undefined,
      ),
    )
    .orderBy(asc(schema.planContribution.dueDate), asc(schema.planContribution.createdAt));
  return rows.map((row) => ({
    id: row.id,
    businessUnit:
      row.businessUnitId && row.businessUnitName
        ? { id: row.businessUnitId, name: row.businessUnitName }
        : null,
    materialGroup:
      row.materialGroupId && row.materialGroupName
        ? { id: row.materialGroupId, name: row.materialGroupName }
        : null,
    assignee: { userId: row.assigneeUserId, name: row.assigneeName },
    dueDate: row.dueDate,
    status: row.status,
    doneAt: row.doneAt ? row.doneAt.toISOString() : null,
  }));
}

export function summarizeContributions(items: PlanContribution[]) {
  return {
    done: items.filter((item) => item.status === 'done').length,
    total: items.length,
    items,
  };
}
