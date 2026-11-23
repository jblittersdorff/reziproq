import { and, eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import type { InsightStatement, ScorecardView } from '@reziproq/shared';
import type { InsightFact, InsightSummaryService } from '../ai-gateway/insight-summary.service.js';
import type { JbpScope } from './jbp.service.js';

async function supplierName(tx: TenantTransaction, scope: JbpScope) {
  const [row] = await tx
    .select({
      name: sql<string>`coalesce(${schema.relationshipSide.displayName}, ${schema.organization.name})`,
    })
    .from(schema.relationship)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.relationship.supplierOrgId))
    .leftJoin(
      schema.relationshipSide,
      and(
        eq(schema.relationshipSide.relationshipId, schema.relationship.id),
        eq(schema.relationshipSide.orgId, scope.orgId),
      ),
    )
    .where(eq(schema.relationship.id, scope.relationshipId));
  return row?.name ?? '';
}

/**
 * AW-01 Plan · Scorecard: Aussage aus dem Stand der Kennzahlen (auf Kurs, knapp, nicht auf Kurs)
 * und der Unterschrift. Ohne Kennzahl mit Stand keine Aussage; nur auf der Käuferseite.
 */
export async function scorecardStatement(
  summaries: InsightSummaryService,
  scope: JbpScope,
  view: ScorecardView,
): Promise<InsightStatement | null> {
  if (scope.side !== 'buyer') return null;
  const tracked = view.kpis.filter((kpi) => kpi.track !== null);
  if (tracked.length === 0) return null;
  const onTrack = tracked.filter((kpi) => kpi.track === 'on_track').length;
  const off = tracked.filter((kpi) => kpi.track === 'off');
  const close = tracked.filter((kpi) => kpi.track === 'close');
  const [worst] = [...off, ...close];
  const name = await supplierName(scope.tx, scope);
  const source = 'Scorecard im JBP';
  const signed = view.status === 'signed' ? 'unterschrieben' : 'noch nicht unterschrieben';
  const facts: InsightFact[] = [
    { key: 'supplier', label: 'Lieferant', display: name, source: 'Lieferant' },
    {
      key: 'onTrack',
      label: 'Kennzahlen auf Kurs',
      display: `${onTrack} von ${tracked.length}`,
      source,
    },
    { key: 'off', label: 'Nicht auf Kurs', display: String(off.length), source },
    { key: 'status', label: 'Unterschrift', display: signed, source },
  ];
  if (worst) facts.push({ key: 'worst', label: 'Hinter Plan', display: worst.name, source });
  const result = await summaries.summarize(scope.tx, scope.auth, {
    pageKey: 'supplier_scorecard',
    scopeType: 'relationship',
    scopeId: scope.relationshipId,
    period: `v${view.version}`,
    facts,
    fallback: {
      headline: `${onTrack} von ${tracked.length} Kennzahlen mit ${name} sind auf Kurs.`,
      body: [
        ...(worst ? [`Am weitesten hinter Plan liegt ${worst.name}.`] : []),
        `Die Scorecard ist ${signed}.`,
      ].join(' '),
    },
    knownNames: [name],
  });
  return result.statement;
}
