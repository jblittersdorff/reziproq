import { UnprocessableEntityException } from '@nestjs/common';
import { and, eq, inArray, schema, sql, type TenantTransaction } from '@reziproq/db';
import { type AiDraft, type DraftSource, draftSourceSchema } from '@reziproq/shared';
import { z } from 'zod';

type DraftValues = typeof schema.aiDraft.$inferInsert;
type DraftRow = typeof schema.aiDraft.$inferSelect;
type SourceInput = Omit<DraftSource, 'id'>;

const claimsInput = z
  .array(
    z.object({
      text: z.string().trim().min(1),
      sources: z
        .array(
          draftSourceSchema
            .omit({ id: true })
            .refine((source) =>
              source.kind === 'own_data'
                ? source.objectType !== null && source.objectId !== null
                : source.url !== null,
            ),
        )
        .nonempty(),
    }),
  )
  .nonempty();

export function ownDraftSource(
  objectType: string,
  objectId: string,
  title: string,
  publishedAt: string | null = null,
): SourceInput {
  return { kind: 'own_data', objectType, objectId, title, publishedAt, excerpt: null, url: null };
}

/** KI-03: Entwurf und Belege entstehen zusammen in der bereits autorisierten Fachtransaktion. */
export async function createBuyerDraft(
  tx: TenantTransaction,
  draft: DraftValues,
  evidence: { text: string; sources: SourceInput[] }[],
) {
  const result = claimsInput.safeParse(evidence);
  if (!result.success) {
    throw new UnprocessableEntityException({ statusCode: 422, code: 'entwurf_ohne_quelle' });
  }
  const claims = result.data.map(({ text }, index) => ({ key: String(index + 1), text }));
  const [saved] = await tx
    .insert(schema.aiDraft)
    .values({ ...draft, claims })
    .returning({
      id: schema.aiDraft.id,
    });
  if (!saved) throw new Error('Entwurf nicht angelegt');
  await tx.insert(schema.aiSource).values(
    result.data.flatMap(({ sources }, index) =>
      sources.map((source) => ({
        ...source,
        orgId: draft.orgId,
        draftId: saved.id,
        claimKey: String(index + 1),
        targetType: draft.objectType,
        targetId: draft.objectId,
      })),
    ),
  );
  return saved.id;
}

export type DraftEvidence = Pick<AiDraft, 'claims' | 'decidedBy'>;

export async function draftEvidence(tx: TenantTransaction, rows: DraftRow[]) {
  const draftIds = rows.filter((row) => row.claims !== null).map((row) => row.id);
  if (!draftIds.length) return (_row: DraftRow): DraftEvidence => ({});
  const source = schema.aiSource;
  const sources = await tx
    .select()
    .from(source)
    .innerJoin(
      schema.aiDraft,
      and(eq(source.draftId, schema.aiDraft.id), eq(source.orgId, schema.aiDraft.orgId)),
    )
    .where(and(inArray(schema.aiDraft.id, draftIds), sql`${source.claimKey} is not null`))
    .orderBy(source.id);
  const byDraft = new Map<string, (typeof sources)[number]['ai_source'][]>();
  for (const { ai_source: entry, ai_draft: draft } of sources) {
    const list = byDraft.get(draft.id) ?? [];
    list.push(entry);
    byDraft.set(draft.id, list);
  }
  const people = rows.flatMap((row) => (row.claims && row.decidedBy ? [row.decidedBy] : []));
  const actors = new Map(
    people.length
      ? (
          await tx
            .select({
              id: schema.appUser.id,
              name: schema.appUser.name,
            })
            .from(schema.appUser)
            .where(inArray(schema.appUser.id, people))
        ).map(({ id, name }) => [id, name])
      : [],
  );
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  return (row: DraftRow): DraftEvidence => {
    const claims = row.claims?.map((claim) => {
      const references = (byDraft.get(row.id) ?? [])
        .filter((entry) => entry.claimKey === claim.key)
        .map((entry) => draftSourceSchema.parse(entry));
      return {
        ...claim,
        sources: references,
        thinlySupported:
          (references.length === 1 && references[0]?.kind === 'public') ||
          (references.length > 0 &&
            references.every(
              (entry) => entry.publishedAt !== null && entry.publishedAt < cutoffDate,
            )),
      };
    });
    const [first, ...rest] = claims ?? [];
    if (!first) return {};
    return {
      claims: [first, ...rest],
      decidedBy: row.decidedBy ? (actors.get(row.decidedBy) ?? null) : null,
    };
  };
}

export function draftDecision(row: DraftRow): Pick<AiDraft, 'decision' | 'dismissReason'> {
  if (row.claims === null) return {};
  return {
    decision:
      row.status === 'draft'
        ? 'open'
        : row.status === 'discarded'
          ? 'dismissed'
          : row.edited
            ? 'edited'
            : 'adopted',
    dismissReason: row.dismissReason,
  };
}
