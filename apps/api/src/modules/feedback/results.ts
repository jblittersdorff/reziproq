import { and, asc, eq, inArray, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  type SurveyDimension,
  type SurveyDimensionResult,
  type SurveyFunction,
  type SurveyResults,
  type SurveySide,
  type SurveyTrend,
  sortByGap,
  surveyDimensions,
  surveyGap,
} from '@reziproq/shared';

// PUL-03: Ergebnisse einer aufgedeckten Welle aus survey_result und survey_free_text. Beide Seiten
// lesen dieselben Zeilen; nur die Freitexte zeigen jeweils die der anderen Seite.

type ResultRow = typeof schema.surveyResult.$inferSelect;

const mean = (value: string | null) => (value === null ? null : Number(value));

/** Deckt auf, wenn die Bedingungen erfüllt sind (app_survey_reveal); gibt zurück, ob aufgedeckt. */
export async function revealIfDue(tx: TenantTransaction, waveId: string): Promise<boolean> {
  const result = await tx.execute<{ revealed: boolean }>(
    sql`select app_survey_reveal(${waveId}) as revealed`,
  );
  return result.rows[0]?.revealed === true;
}

function dimensionsOf(rows: ResultRow[]): SurveyDimensionResult[] {
  const byKey = (side: SurveySide, dimension: SurveyDimension) =>
    rows.find((row) => row.side === side && row.dimension === dimension);
  return sortByGap(
    surveyDimensions
      .filter((dimension) => rows.some((row) => row.dimension === dimension))
      .map((dimension) => {
        const buyer = byKey('buyer', dimension);
        const supplier = byKey('supplier', dimension);
        const pair = (row: ResultRow | undefined) => ({
          ist: mean(row?.istMean ?? null),
          soll: mean(row?.sollMean ?? null),
        });
        return {
          dimension,
          resultId: (buyer ?? supplier)?.id ?? null,
          buyer: pair(buyer),
          supplier: pair(supplier),
          delta: surveyGap(mean(buyer?.istMean ?? null), mean(supplier?.istMean ?? null)),
        };
      }),
  );
}

/** Größte Lücke einer Welle für Liste, Lieferantenplan und JBP-Vorbereitung. */
export async function topGapOf(tx: TenantTransaction, waveId: string) {
  const rows = await tx
    .select()
    .from(schema.surveyResult)
    .where(
      and(
        eq(schema.surveyResult.waveId, waveId),
        sql`${schema.surveyResult.function} is null`,
        sql`${schema.surveyResult.questionKey} is null`,
      ),
    );
  const [top] = dimensionsOf(rows);
  return top && top.delta !== null ? { dimension: top.dimension, delta: top.delta } : null;
}

export async function resultsOf(
  tx: TenantTransaction,
  waveId: string,
  ownSide: SurveySide,
  revealedAt: Date,
  canCreateAction: boolean,
): Promise<SurveyResults> {
  const rows = await tx
    .select()
    .from(schema.surveyResult)
    .where(eq(schema.surveyResult.waveId, waveId));
  const overall = rows.filter((row) => row.function === null && row.questionKey === null);
  const dimensions = dimensionsOf(overall);
  const questionRows = rows.filter((row) => row.function === null && row.questionKey !== null);
  const questionKeys = [...new Set(questionRows.map((row) => row.questionKey as string))];
  const questions = questionKeys.map((key) => {
    const buyer = questionRows.find((row) => row.questionKey === key && row.side === 'buyer');
    const supplier = questionRows.find((row) => row.questionKey === key && row.side === 'supplier');
    const any = (buyer ?? supplier) as ResultRow;
    return {
      key,
      dimension: any.dimension as SurveyDimension,
      labelDe: any.labelDe ?? key,
      labelEn: any.labelEn ?? key,
      buyer: { ist: mean(buyer?.istMean ?? null), soll: mean(buyer?.sollMean ?? null) },
      supplier: { ist: mean(supplier?.istMean ?? null), soll: mean(supplier?.sollMean ?? null) },
      delta: surveyGap(mean(buyer?.istMean ?? null), mean(supplier?.istMean ?? null)),
    };
  });
  const functionRows = rows.filter((row) => row.function !== null);
  const functions = [...new Set(functionRows.map((row) => row.function as SurveyFunction))].map(
    (fn) => {
      const mine = functionRows.filter((row) => row.function === fn);
      const sideOf = (side: SurveySide) => {
        const own = mine.filter((row) => row.side === side);
        return own.length > 0 ? { n: own[0]?.n ?? 0, dimensions: dimensionsOf(own) } : null;
      };
      return {
        function: fn,
        buyer: sideOf('buyer'),
        supplier: sideOf('supplier'),
        dimensions: dimensionsOf(mine),
      };
    },
  );
  const texts = await tx
    .select({ text: schema.surveyFreeText.text })
    .from(schema.surveyFreeText)
    .where(
      and(
        eq(schema.surveyFreeText.waveId, waveId),
        eq(schema.surveyFreeText.side, ownSide === 'buyer' ? 'supplier' : 'buyer'),
      ),
    )
    .orderBy(asc(schema.surveyFreeText.position));
  // PUL-06: Maßnahmen aus Lücken dieser Welle; RLS zeigt interne nur der eigenen Seite.
  const overallIds = overall.map((row) => row.id);
  const actions =
    overallIds.length === 0
      ? []
      : await tx
          .select({ action: schema.action, dimension: schema.surveyResult.dimension })
          .from(schema.action)
          .innerJoin(schema.surveyResult, eq(schema.surveyResult.id, schema.action.sourceId))
          .where(
            and(
              eq(schema.action.sourceType, 'feedback_gap'),
              inArray(schema.action.sourceId, overallIds),
            ),
          )
          .orderBy(asc(schema.action.dueDate));
  const ownOrg = await tx.execute<{ id: string }>(sql`select app_current_organization_id() as id`);
  const count = (side: SurveySide) => overall.find((row) => row.side === side)?.n ?? 0;
  return {
    revealedAt: revealedAt.toISOString(),
    responses: { buyer: count('buyer'), supplier: count('supplier') },
    dimensions,
    topGaps: dimensions.filter((entry) => entry.delta !== null).slice(0, 3),
    functions,
    questions: sortByGap(questions),
    freeTexts: texts.map((row) => row.text),
    actions: actions.map(({ action, dimension }) => ({
      id: action.id,
      title: action.title,
      dimension: dimension as SurveyDimension,
      status: action.status,
      visibility: action.visibility,
      own: action.ownerOrgId === ownOrg.rows[0]?.id,
      ownerName: action.ownerName,
      dueDate: action.dueDate,
    })),
    canCreateAction,
  };
}

/** PUL-06: Verlauf je Art ab zwei aufgedeckten Wellen, älteste zuerst; Puls und Jahr getrennt. */
export async function trendsOf(
  tx: TenantTransaction,
  waves: { id: string; kind: 'pulse' | 'annual'; revealedAt: Date | null }[],
): Promise<SurveyTrend[]> {
  const revealed = waves
    .filter((wave): wave is typeof wave & { revealedAt: Date } => wave.revealedAt !== null)
    .sort((a, b) => a.revealedAt.getTime() - b.revealedAt.getTime());
  const trends: SurveyTrend[] = [];
  for (const kind of ['pulse', 'annual'] as const) {
    const ofKind = revealed.filter((wave) => wave.kind === kind);
    if (ofKind.length < 2) continue;
    const rows = await tx
      .select()
      .from(schema.surveyResult)
      .where(
        and(
          inArray(
            schema.surveyResult.waveId,
            ofKind.map((wave) => wave.id),
          ),
          sql`${schema.surveyResult.function} is null`,
          sql`${schema.surveyResult.questionKey} is null`,
        ),
      );
    const series = (dimension: SurveyDimension, side: SurveySide) =>
      ofKind.map((wave) =>
        mean(
          rows.find(
            (row) => row.waveId === wave.id && row.side === side && row.dimension === dimension,
          )?.istMean ?? null,
        ),
      );
    trends.push({
      kind,
      waves: ofKind.map((wave) => ({ id: wave.id, revealedAt: wave.revealedAt.toISOString() })),
      dimensions: surveyDimensions
        .filter((dimension) => rows.some((row) => row.dimension === dimension))
        .map((dimension) => ({
          dimension,
          buyer: series(dimension, 'buyer'),
          supplier: series(dimension, 'supplier'),
        })),
    });
  }
  return trends;
}
