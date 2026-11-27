import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, asc, currentTime, desc, eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  calculateSegment,
  type DisputedSegment,
  hintEvidenceSchema,
  type Money,
  type RelationshipHint,
  type RelationshipSegments,
  type RelationshipStatus,
  type RelationshipsQuery,
  type RelationshipsResponse,
  relationshipSegmentsSchema,
  relationshipsResponseSchema,
  type SideQuote,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { HintsService } from '../hints/hints.service.js';
import { PortfolioService } from '../portfolio/portfolio.service.js';
import { readFilters } from '../suppliers/suppliers.service.js';
import { berlinDate } from '../today/berlin.js';
import {
  type PortfolioEntry,
  type RowInput,
  rankRows,
  segmentFields,
  shareOf,
  strongestHints,
  summaryOf,
  totalsOf,
} from './relationship-rules.js';

// BZ-01 (K2-b.3): Seite Lieferanten mit den Linsen Liste und Segmente. Liest nur, in der
// Mandanten-Session der Käuferorganisation; Row-Level Security prüft jede Zeile.

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });

const uuidArray = (values: string[]) => sql`${`{${values.join(',')}}`}::uuid[]`;

interface Base {
  relationshipId: string;
  status: RelationshipStatus;
  name: string;
  country: string | null;
  isFocus: boolean;
  materialGroup: string | null;
  isMine: boolean;
}

/** Alle Beziehungen der Käuferorganisation: aktiv, Entwurf und beendet (PLT-03) */
async function readBase(tx: TenantTransaction, orgId: string, userId: string): Promise<Base[]> {
  const rows = await tx.execute<{
    id: string;
    status: RelationshipStatus;
    name: string;
    country: string | null;
    is_focus: boolean;
    material_group: string | null;
    is_mine: boolean;
  }>(sql`
    select r.id, r.status, coalesce(side.display_name, o.name) as name, o.country,
      coalesce(side.is_focus, false) as is_focus,
      (select g.name from relationship_material_group rg
        join material_group g on g.id = rg.material_group_id
        where rg.relationship_id = r.id and rg.is_primary order by g.name limit 1) as material_group,
      exists (select 1 from relationship_member m where m.relationship_id = r.id
        and m.org_id = r.buyer_org_id and m.user_id = ${userId}) as is_mine
    from relationship r
    join organization o on o.id = r.supplier_org_id
    left join relationship_side side on side.relationship_id = r.id and side.org_id = r.buyer_org_id
    where r.buyer_org_id = ${orgId}`);
  return rows.rows.map((row) => ({
    relationshipId: row.id,
    status: row.status,
    name: row.name,
    country: row.country,
    isFocus: row.is_focus,
    materialGroup: row.material_group,
    isMine: row.is_mine,
  }));
}

/** Ist-Spend des Jahres je Beziehung; bei mehreren Währungen die größte */
export async function readSpend(tx: TenantTransaction, orgId: string, year: number) {
  const rows = await tx.execute<{ relationship_id: string; currency: string; amount: string }>(sql`
    select s.relationship_id, s.currency, sum(s.amount_cents)::text as amount
    from relationship_spend s join relationship r on r.id = s.relationship_id
    where r.buyer_org_id = ${orgId} and s.year = ${year} and s.kind = 'actual'
    group by s.relationship_id, s.currency`);
  const spend = new Map<string, Money>();
  for (const row of rows.rows) {
    const amountCents = Number(row.amount);
    const current = spend.get(row.relationship_id);
    if (!current || amountCents > current.amountCents) {
      spend.set(row.relationship_id, { amountCents, currency: row.currency });
    }
  }
  return spend;
}

/**
 * Segment (Ist) und Soll-Typ aus der jüngsten Gesamtentscheidung, mit den Namen der Typen ihrer
 * Modellversion
 */
export async function readSegments(tx: TenantTransaction, orgId: string) {
  const decisions = await tx.execute<{
    relationship_id: string;
    impact: number;
    quality: number;
    soll_impact: number;
    soll_quality: number;
    model_version: number;
  }>(sql`
    select distinct on (d.relationship_id) d.relationship_id, d.ist_impact_level as impact,
      d.ist_quality_level as quality, d.soll_impact_level as soll_impact,
      d.soll_quality_level as soll_quality, d.model_version
    from segment_decision d join relationship r on r.id = d.relationship_id
    where r.buyer_org_id = ${orgId} and d.scope = 'total'
    order by d.relationship_id, d.version desc`);
  const types = await tx
    .select({
      version: schema.segmentModel.version,
      impactLevel: schema.segmentType.impactLevel,
      qualityLevel: schema.segmentType.qualityLevel,
      name: schema.segmentType.name,
    })
    .from(schema.segmentType)
    .innerJoin(schema.segmentModel, eq(schema.segmentModel.id, schema.segmentType.modelId))
    .where(eq(schema.segmentModel.orgId, orgId));
  const names = new Map(
    types.map((type) => [`${type.version}:${type.impactLevel}-${type.qualityLevel}`, type.name]),
  );
  const named = (version: number, key: string) => ({
    key,
    name: names.get(`${version}:${key}`) ?? key,
  });
  const segments = new Map<
    string,
    { ist: { key: string; name: string }; soll: { key: string; name: string } }
  >();
  for (const row of decisions.rows) {
    segments.set(row.relationship_id, {
      ist: named(row.model_version, `${row.impact}-${row.quality}`),
      soll: named(row.model_version, `${row.soll_impact}-${row.soll_quality}`),
    });
  }
  // WG-18: je Warengruppe die jüngste Entscheidung
  const categories = await tx.execute<{
    relationship_id: string;
    material_group_id: string;
    impact: number;
    quality: number;
    model_version: number;
  }>(sql`
    select distinct on (d.relationship_id, d.material_group_id) d.relationship_id,
      d.material_group_id, d.ist_impact_level as impact, d.ist_quality_level as quality,
      d.model_version
    from segment_decision d join relationship r on r.id = d.relationship_id
    where r.buyer_org_id = ${orgId} and d.scope = 'category' and d.material_group_id is not null
    order by d.relationship_id, d.material_group_id, d.version desc`);
  const byCategory = new Map<string, { materialGroupId: string; key: string; name: string }[]>();
  for (const row of categories.rows) {
    byCategory.set(row.relationship_id, [
      ...(byCategory.get(row.relationship_id) ?? []),
      {
        materialGroupId: row.material_group_id,
        ...named(row.model_version, `${row.impact}-${row.quality}`),
      },
    ]);
  }
  return { segments, byCategory };
}

/** Business Units und Warengruppen je Beziehung, für „Mehr Filter“ (NAV-12) */
async function readAssignments(tx: TenantTransaction, orgId: string) {
  const units = await tx.execute<{ relationship_id: string; ids: string[] }>(sql`
    select rb.relationship_id, array_agg(rb.business_unit_id::text order by rb.business_unit_id) as ids
    from relationship_business_unit rb join relationship r on r.id = rb.relationship_id
    where r.buyer_org_id = ${orgId} group by rb.relationship_id`);
  const groups = await tx.execute<{ relationship_id: string; ids: string[] }>(sql`
    select rg.relationship_id, array_agg(rg.material_group_id::text order by rg.material_group_id) as ids
    from relationship_material_group rg join relationship r on r.id = rg.relationship_id
    where r.buyer_org_id = ${orgId} group by rg.relationship_id`);
  return {
    units: new Map(units.rows.map((row) => [row.relationship_id, row.ids])),
    groups: new Map(groups.rows.map((row) => [row.relationship_id, row.ids])),
  };
}

/** Offene und überfällige Zusagen je Beziehung, beide Seiten; Entwürfe zählen nicht */
async function readCommitments(tx: TenantTransaction, orgId: string, today: string) {
  const rows = await tx.execute<{
    relationship_id: string;
    open: number;
    overdue: number;
    overdue_title: string | null;
  }>(sql`
    select c.relationship_id,
      count(*) filter (where c.status = 'open')::int as open,
      count(*) filter (where c.status = 'open' and c.due_on < ${today}::date)::int as overdue,
      (array_agg(c.title order by c.due_on, c.id)
        filter (where c.status = 'open' and c.due_on < ${today}::date))[1] as overdue_title
    from commitment c join relationship r on r.id = c.relationship_id
    where r.buyer_org_id = ${orgId} and c.confirm_state <> 'draft'
    group by c.relationship_id`);
  return new Map(rows.rows.map((row) => [row.relationship_id, row]));
}

/** Mini-Spiegel (ZQ-01 Regel 2): Quote je Seite im Jahr, nur beidseitig bestätigte Zusagen */
async function readQuotas(tx: TenantTransaction, orgId: string, year: number) {
  const rows = await tx.execute<{
    relationship_id: string;
    side: 'buyer' | 'supplier';
    kept: number;
    due: number;
  }>(sql`
    select q.relationship_id, q.side, q.kept, q.due from commitment_rate q
    join relationship r on r.id = q.relationship_id
    where r.buyer_org_id = ${orgId} and q.year = ${year}`);
  const quote = (kept: number, due: number): SideQuote => ({
    kept,
    due,
    percent: due === 0 ? null : Math.round((kept / due) * 100),
  });
  const quotas = new Map<string, { own: SideQuote; counterpart: SideQuote }>();
  for (const row of rows.rows) {
    const entry = quotas.get(row.relationship_id) ?? {
      own: quote(0, 0),
      counterpart: quote(0, 0),
    };
    // Die Seite gibt es nur für Käufer; eure Seite ist die des Käufers
    if (row.side === 'buyer') entry.own = quote(row.kept, row.due);
    else entry.counterpart = quote(row.kept, row.due);
    quotas.set(row.relationship_id, entry);
  }
  for (const [relationshipId, entry] of quotas) {
    if (entry.own.due === 0 && entry.counterpart.due === 0) quotas.delete(relationshipId);
  }
  return quotas;
}

@Injectable()
export class RelationshipsService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(PortfolioService) private readonly portfolio: PortfolioService,
    @Inject(HintsService) private readonly hints: HintsService,
  ) {}

  /** Nur für Käufer: Der Lieferant sieht weder Bewertung noch Segment (T2-S04). */
  private run<T>(auth: AuthContext, work: (tx: TenantTransaction, orgId: string) => Promise<T>) {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      (tx) => work(tx, organization.id),
      { readOnly: true },
    );
  }

  /** Strittig nach SEG-07: alle Bewertungen der Runde da, nach der letzten Entscheidung, weit auseinander */
  private async disputedIn(tx: TenantTransaction, orgId: string) {
    return new Set(
      (await this.portfolio.deviationsIn(tx, orgId)).map((entry) => entry.relationshipId),
    );
  }

  /** Linse Liste: Kopf, Zahlen der Chips, Zeilen nach Aufmerksamkeit und „Das Wichtigste“ */
  async list(auth: AuthContext, query: RelationshipsQuery): Promise<RelationshipsResponse> {
    const today = berlinDate(currentTime());
    const year = Number(today.slice(0, 4));
    return this.run(auth, async (tx, orgId) => {
      const base = await readBase(tx, orgId, auth.userId);
      const spend = await readSpend(tx, orgId, year);
      const { segments, byCategory } = await readSegments(tx, orgId);
      const assignments = await readAssignments(tx, orgId);
      const commitments = await readCommitments(tx, orgId, today);
      const quotas = await readQuotas(tx, orgId, year);
      const disputed = await this.disputedIn(tx, orgId);
      const hints = can(auth, 'hinweise.sehen')
        ? strongestHints(
            (await this.hints.activeIn(tx, auth, orgId)).map((row) => {
              const evidence = hintEvidenceSchema.safeParse(row.evidence ?? {});
              const values = evidence.success ? (evidence.data.values ?? []) : [];
              return {
                id: row.id,
                relationshipId: row.relationshipId,
                score: row.score,
                ruleKey: row.ruleKey,
                severity: row.severity,
                status: row.status as RelationshipHint['status'],
                title: row.title,
                metric: evidence.success ? (evidence.data.metric ?? null) : null,
                value: values.at(-1)?.value ?? null,
              };
            }),
          )
        : new Map<string, RelationshipHint>();

      const inputs: RowInput[] = base.map((entry) => {
        const open = commitments.get(entry.relationshipId);
        return {
          ...entry,
          spend: spend.get(entry.relationshipId) ?? null,
          segment: segments.get(entry.relationshipId)?.ist ?? null,
          targetType: segments.get(entry.relationshipId)?.soll ?? null,
          businessUnitIds: assignments.units.get(entry.relationshipId) ?? [],
          materialGroupIds: assignments.groups.get(entry.relationshipId) ?? [],
          categorySegments: byCategory.get(entry.relationshipId) ?? [],
          disputed: disputed.has(entry.relationshipId),
          quota: quotas.get(entry.relationshipId) ?? null,
          openCommitments: open?.open ?? 0,
          overdue:
            open && open.overdue > 0
              ? { count: open.overdue, title: open.overdue_title ?? '' }
              : null,
          hint: hints.get(entry.relationshipId) ?? null,
        };
      });
      const active = inputs.filter((input) => input.status === 'active');
      // E-K2-10: die Liste zeigt aktive Beziehungen, mit „Portfolio“ auch die Entwürfe; beendete
      // nur mit „Beendete zeigen“ (PLT-03)
      const shown = inputs.filter(
        (input) =>
          input.status === 'active' ||
          (input.status === 'draft' && query.portfolio) ||
          (input.status === 'ended' && query.beendet),
      );
      return relationshipsResponseSchema.parse({
        year,
        head: {
          active: active.length,
          spend: totalsOf(active.map((input) => input.spend)),
          portfolio: inputs.filter((input) => input.status !== 'ended').length,
        },
        counts: {
          alle: shown.length,
          meine: shown.filter((input) => input.isMine).length,
          strategisch: shown.filter((input) => input.isFocus).length,
          offeneZusagen: shown.filter((input) => input.openCommitments > 0).length,
        },
        rows: rankRows(shown),
        // Das Wichtigste spricht über die laufenden Beziehungen, nicht über beendete
        summary: summaryOf(shown.filter((input) => input.status !== 'ended')),
        filters: await readFilters(tx),
      });
    });
  }

  /** Linse Segmente: Matrix des aktiven Modells über das ganze Portfolio, ohne Bewertung, Spend */
  async segments(auth: AuthContext): Promise<RelationshipSegments> {
    const year = Number(berlinDate(currentTime()).slice(0, 4));
    return this.run(auth, async (tx, orgId) => {
      const [stored] = await tx
        .select({
          id: schema.segmentModel.id,
          version: schema.segmentModel.version,
          gridSize: schema.segmentModel.gridSize,
          impactLabel: schema.segmentModel.impactLabel,
          qualityLabel: schema.segmentModel.qualityLabel,
          lowMax: schema.segmentModel.lowMax,
          midMax: schema.segmentModel.midMax,
        })
        .from(schema.segmentModel)
        .where(and(eq(schema.segmentModel.orgId, orgId), eq(schema.segmentModel.status, 'active')));
      const model = stored
        ? { ...stored, gridSize: stored.gridSize === 2 ? (2 as const) : (3 as const) }
        : null;
      const types = model
        ? await tx
            .select({
              impactLevel: schema.segmentType.impactLevel,
              qualityLevel: schema.segmentType.qualityLevel,
              name: schema.segmentType.name,
              description: schema.segmentType.description,
            })
            .from(schema.segmentType)
            .where(eq(schema.segmentType.modelId, model.id))
        : [];
      const base = await readBase(tx, orgId, auth.userId);
      const spend = await readSpend(tx, orgId, year);
      const { segments } = await readSegments(tx, orgId);
      const disputed = await this.disputedIn(tx, orgId);

      // Das Portfolio: aktive Beziehungen und Entwürfe, ohne beendete
      const entries: PortfolioEntry[] = base
        .filter((entry) => entry.status !== 'ended')
        .map((entry) => ({
          relationshipId: entry.relationshipId,
          name: entry.name,
          status: entry.status,
          spend: spend.get(entry.relationshipId) ?? null,
          disputed: disputed.has(entry.relationshipId),
          segmentKey: segments.get(entry.relationshipId)?.ist.key ?? null,
        }));
      const { fields, unrated } = segmentFields(types, entries);
      const ratedSpend = totalsOf(fields.flatMap((field) => field.suppliers.map((s) => s.spend)));
      const size = model?.gridSize ?? 3;
      const top = fields.find((field) => field.impactLevel === size && field.qualityLevel === size);

      const [round] = await tx
        .select({
          id: schema.segmentationRound.id,
          name: schema.segmentationRound.name,
          dueDate: schema.segmentationRound.dueDate,
        })
        .from(schema.segmentationRound)
        .where(
          and(
            eq(schema.segmentationRound.orgId, orgId),
            eq(schema.segmentationRound.status, 'open'),
          ),
        )
        .orderBy(desc(schema.segmentationRound.createdAt))
        .limit(1);

      return relationshipSegmentsSchema.parse({
        year,
        model: model
          ? {
              id: model.id,
              version: model.version,
              gridSize: model.gridSize,
              impactLabel: model.impactLabel,
              qualityLabel: model.qualityLabel,
            }
          : null,
        portfolio: entries.length,
        rated: fields.reduce((sum, field) => sum + field.count, 0),
        ratedSpend,
        round: round ?? null,
        fields,
        unrated: {
          count: unrated.length,
          spend: totalsOf(unrated.map((supplier) => supplier.spend)),
          suppliers: unrated,
        },
        summary: {
          top: top
            ? {
                key: top.key,
                name: top.name,
                count: top.count,
                spend: top.spend,
                share: shareOf(top.spend, ratedSpend),
              }
            : null,
          disputed: model
            ? await this.disputedDetails(
                tx,
                { ...model, types },
                entries.filter((entry) => entry.disputed),
              )
            : [],
        },
      });
    });
  }

  /**
   * Klären (Vorlage K2-Segmente): je strittigem Lieferanten das Kriterium mit der größten Spanne
   * der Bewertenden in der jüngsten Runde, und ob niedrigster und höchster Wert ein anderes Segment
   * ergäben; die übrigen Kriterien zählen mit ihrem Mittel.
   */
  private async disputedDetails(
    tx: TenantTransaction,
    model: {
      id: string;
      gridSize: 2 | 3;
      lowMax: number;
      midMax: number;
      types: { impactLevel: number; qualityLevel: number; name: string; description: string }[];
    },
    suppliers: { relationshipId: string; name: string }[],
  ): Promise<DisputedSegment[]> {
    if (suppliers.length === 0) return [];
    const criteria = (
      await tx
        .select({
          key: schema.segmentCriterion.key,
          name: schema.segmentCriterion.name,
          axis: schema.segmentCriterion.axis,
          description: schema.segmentCriterion.description,
          weight: schema.segmentCriterion.weight,
          position: schema.segmentCriterion.position,
        })
        .from(schema.segmentCriterion)
        .where(eq(schema.segmentCriterion.modelId, model.id))
        .orderBy(asc(schema.segmentCriterion.position))
    ).map((criterion) => ({ ...criterion, weight: Number(criterion.weight) }));
    const values = await tx.execute<{
      relationship_id: string;
      criterion_key: string;
      min: number;
      max: number;
      mean: number;
    }>(sql`
      with latest as (
        select distinct on (a.relationship_id) a.relationship_id, a.round_id
        from rating_assignment a join segmentation_round sr on sr.id = a.round_id
        where a.relationship_id = any(${uuidArray(suppliers.map((s) => s.relationshipId))})
          and sr.status in ('open', 'closed') and sr.scope = 'portfolio'
        order by a.relationship_id, sr.created_at desc
      )
      select a.relationship_id, v.criterion_key, min(v.ist)::float8 as min,
        max(v.ist)::float8 as max, avg(v.ist)::float8 as mean
      from latest l
      join rating_assignment a on a.relationship_id = l.relationship_id
        and a.round_id = l.round_id and a.status = 'submitted'
      join rating v on v.assignment_id = a.id
      where v.ist is not null
      group by a.relationship_id, v.criterion_key`);

    const segmentWith = (scores: Record<string, number>) => {
      try {
        const { type } = calculateSegment({ ...model, criteria, types: model.types }, scores);
        return `${type.impactLevel}-${type.qualityLevel}`;
      } catch {
        // Fehlt ein Kriterium oder stimmen die Gewichte nicht, lässt sich nichts ableiten
        return null;
      }
    };
    return suppliers.flatMap((supplier) => {
      const own = values.rows.filter((row) => row.relationship_id === supplier.relationshipId);
      const widest = [...own].sort((a, b) => b.max - b.min - (a.max - a.min))[0];
      const criterion = criteria.find((entry) => entry.key === widest?.criterion_key);
      if (!widest || !criterion) return [];
      const means = Object.fromEntries(own.map((row) => [row.criterion_key, row.mean]));
      const low = segmentWith({ ...means, [criterion.key]: widest.min });
      const high = segmentWith({ ...means, [criterion.key]: widest.max });
      return [
        {
          relationshipId: supplier.relationshipId,
          name: supplier.name,
          criterion: { key: criterion.key, name: criterion.name },
          min: widest.min,
          max: widest.max,
          decidesSegment: low !== null && high !== null && low !== high,
        },
      ];
    });
  }
}
