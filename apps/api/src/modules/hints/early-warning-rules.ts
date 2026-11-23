import { and, desc, eq, inArray, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  type AnyHintRuleKey,
  defaultHintThresholds,
  type EarlyWarningRuleKey,
  type HintEvidence,
  type HintSeverity,
} from '@reziproq/shared';

// KI-16: Regeln der Frühwarnung. Wie FS-01 rechnet nur der Code; ein Modell legt keine Hinweise
// an. Jeder Fund trägt Schwere, Titel, Beleg und nächsten Schritt; der fingerprint enthält die
// Schwere, damit ein verworfener Hinweis zurückkommt, wenn die Lage schlimmer wird.

export interface EarlyWarningFinding {
  ruleKey: EarlyWarningRuleKey;
  relationshipId: string | null;
  subject?: string;
  fingerprint: string;
  severity: HintSeverity;
  title: string;
  /** Werte für den Satz in der Oberfläche (Deutsch und Englisch) */
  detail: Record<string, string | number>;
  evidence: HintEvidence;
  suggestedAction: string;
}

export type Thresholds = { [K in EarlyWarningRuleKey]: Record<string, number> };

/** Gefundene öffentliche Meldung; ohne Datum oder zu alt wird sie verworfen. */
export interface PublicEvent {
  relationshipId: string;
  kind:
    | 'insolvency'
    | 'plant_closure'
    | 'short_time_work'
    | 'takeover'
    | 'sanction'
    | 'recall'
    | 'none';
  title: string;
  sources: { title: string; url: string; publisher: string; publishedOn: string | null }[];
}

export interface EarlyWarningContext {
  tx: TenantTransaction;
  orgId: string;
  today: string;
  enabled: Record<string, boolean>;
  thresholds: Thresholds;
  /** Fokus je Beziehung */
  focus: Set<string>;
  relationshipIds: string[];
  /** Meldungen aus der öffentlichen Recherche; ohne Recherche leer (KI-01) */
  publicEvents: PublicEvent[];
}

const eventNames: Record<PublicEvent['kind'], string> = {
  insolvency: 'Insolvenz',
  plant_closure: 'Werksschließung',
  short_time_work: 'Kurzarbeit',
  takeover: 'Übernahme',
  sanction: 'Sanktion',
  recall: 'Rückruf',
  none: '',
};

const number = (value: number) =>
  new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(value);
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** Schwellen der Organisation über den Startwerten */
export function thresholdsOf(stored: unknown): Thresholds {
  const own = (stored && typeof stored === 'object' ? stored : {}) as Record<
    string,
    Record<string, number>
  >;
  return Object.fromEntries(
    Object.entries(defaultHintThresholds).map(([key, base]) => [
      key,
      { ...base, ...(own[key] ?? {}) },
    ]),
  ) as unknown as Thresholds;
}

export async function evaluateEarlyWarning(
  context: EarlyWarningContext,
): Promise<EarlyWarningFinding[]> {
  const { tx, today, relationshipIds: ids, thresholds } = context;
  const on = (key: EarlyWarningRuleKey) => context.enabled[key] !== false;
  const findings: EarlyWarningFinding[] = [];
  if (ids.length === 0) return findings;

  // performance_drop: Kennzahl n Monate in Folge unter Ziel und schlechter werdend
  if (on('performance_drop')) {
    const months = thresholds.performance_drop.months ?? 3;
    const kpis = await tx
      .select({
        id: schema.scorecardKpi.id,
        relationshipId: schema.scorecardKpi.relationshipId,
        name: schema.scorecardKpi.name,
        unit: schema.scorecardKpi.unit,
        direction: schema.scorecardKpi.direction,
        target: schema.scorecardKpi.target,
      })
      .from(schema.scorecardKpi)
      .where(inArray(schema.scorecardKpi.relationshipId, ids));
    for (const kpi of kpis) {
      const values = await tx
        .select({ period: schema.kpiValue.period, value: schema.kpiValue.value })
        .from(schema.kpiValue)
        .where(eq(schema.kpiValue.kpiId, kpi.id))
        .orderBy(desc(schema.kpiValue.period))
        .limit(months);
      if (values.length < months) continue;
      const series = [...values]
        .reverse()
        .map((row) => ({ period: row.period, value: Number(row.value) }));
      const target = Number(kpi.target);
      const below = (value: number) =>
        kpi.direction === 'higher' ? value < target : value > target;
      const worse = (a: number, b: number) => (kpi.direction === 'higher' ? b < a : b > a);
      const first = series[0];
      const last = series.at(-1);
      if (
        !first ||
        !last ||
        !series.every((row) => below(row.value)) ||
        !worse(first.value, last.value)
      )
        continue;
      const severity: HintSeverity = context.focus.has(kpi.relationshipId) ? 'high' : 'medium';
      findings.push({
        ruleKey: 'performance_drop',
        relationshipId: kpi.relationshipId,
        subject: kpi.id,
        fingerprint: severity,
        severity,
        title: `„${kpi.name}“ seit ${months} Monaten unter Ziel und schlechter`,
        detail: { kpi: kpi.name, months },
        evidence: {
          metric: kpi.name,
          unit: kpi.unit,
          values: series.map((row) => ({
            label: row.period.slice(0, 7),
            value: `${number(row.value)} ${kpi.unit}`,
          })),
          threshold: `Ziel ${number(target)} ${kpi.unit}`,
          period: `${series[0]?.period.slice(0, 7)} bis ${last.period.slice(0, 7)}`,
          refs: [{ objectType: 'scorecard_kpi', objectId: kpi.id, title: kpi.name }],
        },
        suggestedAction: 'Maßnahme anlegen',
      });
    }
  }

  // supplier_commitment_overdue: Zusagen des Lieferanten mehr als n Tage überfällig
  if (on('supplier_commitment_overdue')) {
    const { days, highDays } = thresholds.supplier_commitment_overdue;
    const overdue = await tx
      .select({
        id: schema.commitment.id,
        relationshipId: schema.commitment.relationshipId,
        title: schema.commitment.title,
        dueOn: schema.commitment.dueOn,
      })
      .from(schema.commitment)
      .where(
        and(
          inArray(schema.commitment.relationshipId, ids),
          eq(schema.commitment.side, 'supplier'),
          eq(schema.commitment.status, 'open'),
          sql`${schema.commitment.dueOn} < (${today}::date - ${days ?? 14}::int)`,
        ),
      );
    const byRelationship = new Map<string, typeof overdue>();
    for (const row of overdue)
      byRelationship.set(row.relationshipId, [
        ...(byRelationship.get(row.relationshipId) ?? []),
        row,
      ]);
    for (const [relationshipId, rows] of byRelationship) {
      const longest = Math.max(...rows.map((row) => daysBetween(row.dueOn, today)));
      const severity: HintSeverity = longest >= (highDays ?? 45) ? 'high' : 'medium';
      findings.push({
        ruleKey: 'supplier_commitment_overdue',
        relationshipId,
        fingerprint: `${severity}|${rows.length}`,
        severity,
        detail: { count: rows.length, days: longest },
        title:
          rows.length === 1
            ? 'Eine Zusage des Lieferanten ist überfällig'
            : `${rows.length} Zusagen des Lieferanten sind überfällig`,
        evidence: {
          metric: 'Überfällige Zusagen des Lieferanten',
          values: rows.map((row) => ({
            label: row.title,
            value: `${daysBetween(row.dueOn, today)} Tage`,
          })),
          threshold: `mehr als ${days ?? 14} Tage`,
          refs: rows.map((row) => ({
            objectType: 'commitment',
            objectId: row.id,
            title: row.title,
          })),
        },
        suggestedAction: 'Zusage nachfassen',
      });
    }
  }

  // dependency: Anteil am Spend einer Warengruppe ab n und kein zweiter Lieferant mit Spend
  if (on('dependency')) {
    const share = thresholds.dependency.share ?? 0.6;
    const rows = await tx.execute<{
      material_group_id: string;
      group_name: string;
      relationship_id: string;
      amount: string;
      total: string;
      suppliers: string;
      year: number;
    }>(sql`
      with latest as (
        select s.material_group_id, max(s.year) as year from relationship_spend s
        join relationship r on r.id = s.relationship_id and r.buyer_org_id = ${context.orgId}
        where s.material_group_id is not null and s.kind = 'actual' and s.year <= extract(year from ${today}::date)
        group by s.material_group_id
      ), spend as (
        select s.material_group_id, s.relationship_id, sum(s.amount_cents) as amount, l.year
        from relationship_spend s join latest l on l.material_group_id = s.material_group_id and l.year = s.year
        where s.kind = 'actual' group by s.material_group_id, s.relationship_id, l.year
      )
      select sp.material_group_id, g.name as group_name, sp.relationship_id, sp.amount::text, sp.year,
        (sum(sp.amount) over (partition by sp.material_group_id))::text as total,
        (count(*) over (partition by sp.material_group_id))::text as suppliers
      from spend sp join material_group g on g.id = sp.material_group_id`);
    for (const row of rows.rows) {
      if (!ids.includes(row.relationship_id)) continue;
      const total = Number(row.total);
      const part = total > 0 ? Number(row.amount) / total : 0;
      if (part < share || Number(row.suppliers) > 1) continue;
      findings.push({
        ruleKey: 'dependency',
        relationshipId: row.relationship_id,
        subject: row.material_group_id,
        fingerprint: 'medium',
        severity: 'medium',
        detail: { group: row.group_name, share: Math.round(part * 100) },
        title: `Abhängig in ${row.group_name}: ${Math.round(part * 100)} % des Spends, kein zweiter Lieferant`,
        evidence: {
          metric: `Anteil am Spend ${row.group_name}`,
          values: [{ label: String(row.year), value: `${Math.round(part * 100)} %` }],
          threshold: `ab ${Math.round(share * 100)} % ohne zweiten Lieferanten`,
          refs: [
            {
              objectType: 'material_group',
              objectId: row.material_group_id,
              title: row.group_name,
            },
          ],
        },
        suggestedAction: 'Zweitlieferant prüfen',
      });
    }
  }

  // feedback_drop: Gesamtwert des Feedbacks fällt gegenüber der vorigen Welle um n
  if (on('feedback_drop')) {
    const drop = thresholds.feedback_drop.drop ?? 0.1;
    const waves = await tx.execute<{
      relationship_id: string;
      wave_id: string;
      created_at: string;
      mean: string;
    }>(sql`
      select r.relationship_id, r.wave_id, w.created_at::text, avg(r.ist_mean)::text as mean
      from survey_result r join survey_wave w on w.id = r.wave_id
      where r.relationship_id in ${ids} and r.function is null and r.question_key is null and r.ist_mean is not null
      group by r.relationship_id, r.wave_id, w.created_at order by r.relationship_id, w.created_at desc`);
    const byRelationship = new Map<string, typeof waves.rows>();
    for (const row of waves.rows)
      byRelationship.set(row.relationship_id, [
        ...(byRelationship.get(row.relationship_id) ?? []),
        row,
      ]);
    for (const [relationshipId, list] of byRelationship) {
      const [latest, previous] = list;
      if (!latest || !previous) continue;
      const now = Number(latest.mean);
      const before = Number(previous.mean);
      if (before <= 0 || (before - now) / before < drop) continue;
      findings.push({
        ruleKey: 'feedback_drop',
        relationshipId,
        subject: latest.wave_id,
        fingerprint: 'medium',
        severity: 'medium',
        detail: { before: Math.round(before * 10) / 10, now: Math.round(now * 10) / 10 },
        title: `Feedback fällt von ${number(before)} auf ${number(now)}`,
        evidence: {
          metric: 'Gesamtwert Feedback',
          values: [
            { label: 'vorige Welle', value: number(before) },
            { label: 'letzte Welle', value: number(now) },
          ],
          threshold: `Rückgang ab ${Math.round(drop * 100)} %`,
          refs: [{ objectType: 'survey_wave', objectId: latest.wave_id, title: 'Feedback-Welle' }],
        },
        suggestedAction: 'Lieferant prüfen',
      });
    }
  }

  // public_event: Meldung mit Datum, höchstens n Tage alt; hoch ab zwei unabhängigen Quellen
  if (on('public_event')) {
    const maxDays = thresholds.public_event.days ?? 30;
    for (const event of context.publicEvents) {
      if (event.kind === 'none' || !ids.includes(event.relationshipId)) continue;
      const dated = event.sources.filter(
        (source): source is typeof source & { publishedOn: string } =>
          source.publishedOn !== null &&
          source.publishedOn <= today &&
          daysBetween(source.publishedOn, today) <= maxDays,
      );
      if (dated.length === 0) continue;
      const publishers = new Set(dated.map((source) => source.publisher.toLowerCase()));
      const severity: HintSeverity = publishers.size >= 2 ? 'high' : 'medium';
      findings.push({
        ruleKey: 'public_event',
        relationshipId: event.relationshipId,
        subject: event.kind,
        fingerprint: severity,
        severity,
        detail: { event: event.kind, headline: event.title, sources: dated.length },
        title: `${eventNames[event.kind]}: ${event.title}`,
        evidence: {
          metric: eventNames[event.kind],
          sources: dated.map((source) => ({
            title: source.title,
            url: source.url,
            publishedOn: source.publishedOn,
          })),
          threshold: `höchstens ${maxDays} Tage alt`,
        },
        suggestedAction: 'Lieferant prüfen',
      });
    }
  }
  return findings;
}

/** Schwere und nächster Schritt der Regeln aus FS-01 (KI-16: unverändert, nur ergänzt) */
export const fs01Severity: Partial<
  Record<AnyHintRuleKey, { severity: HintSeverity; action: string }>
> = {
  buyer_commitments_overdue: { severity: 'medium', action: 'Annehmen' },
  unexplained_deviation: { severity: 'medium', action: 'Annehmen' },
  cadence_missed: { severity: 'medium', action: 'Annehmen' },
  plan_missing: { severity: 'medium', action: 'Annehmen' },
};

const severityWeight: Record<HintSeverity, number> = { high: 3, medium: 2, low: 1 };

/**
 * score = Gewicht der Schwere × Anteil des Lieferanten am Spend × Gewicht des Segments; Fokus
 * zählt doppelt. Ganzzahlig (× 10.000), ohne Beziehung mit Mindestanteil 1 %.
 */
export function scoreOf(input: {
  severity: HintSeverity;
  spendShare: number;
  impactLevel: number | null;
  focus: boolean;
}) {
  const segment = input.impactLevel === 3 ? 2 : input.impactLevel === 2 ? 1.5 : 1;
  const share = Math.max(0.01, input.spendShare);
  return Math.round(
    severityWeight[input.severity] * share * segment * (input.focus ? 2 : 1) * 10_000,
  );
}

const daysBefore = (today: string, days: number) =>
  new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);

/**
 * Feste Testmeldungen des lokalen Anbieters (wie die Marktsignale in KI-11), nur außerhalb der
 * Produktion: Für den Test-Lieferanten eine Kurzarbeit mit zwei unabhängigen Quellen,
 * dazu eine veraltete und eine undatierte Meldung, die nie zum Hinweis werden.
 */
export function fakePublicEvents(
  relationships: { id: string; name: string }[],
  today: string,
): PublicEvent[] {
  return relationships
    .filter((relationship) => relationship.name.startsWith('Test-Lieferant'))
    .flatMap((relationship) => [
      {
        relationshipId: relationship.id,
        kind: 'short_time_work' as const,
        title: 'Kurzarbeit im Werk angekündigt',
        sources: [
          {
            title: 'Regionalzeitung: Kurzarbeit angekündigt',
            url: 'https://regional.example.test/kurzarbeit',
            publisher: 'Regionalzeitung',
            publishedOn: daysBefore(today, 5),
          },
          {
            title: 'Wirtschaftsdienst: Werk fährt Schichten zurück',
            url: 'https://wirtschaft.example.test/schichten',
            publisher: 'Wirtschaftsdienst',
            publishedOn: daysBefore(today, 4),
          },
        ],
      },
      {
        relationshipId: relationship.id,
        kind: 'takeover' as const,
        title: 'Alte Meldung zu einer Übernahme',
        sources: [
          {
            title: 'Archiv',
            url: 'https://archiv.example.test/uebernahme',
            publisher: 'Archiv',
            publishedOn: daysBefore(today, 90),
          },
        ],
      },
      {
        relationshipId: relationship.id,
        kind: 'recall' as const,
        title: 'Undatierte Meldung zu einem Rückruf',
        sources: [
          {
            title: 'Forum',
            url: 'https://forum.example.test/rueckruf',
            publisher: 'Forum',
            publishedOn: null,
          },
        ],
      },
    ]);
}
