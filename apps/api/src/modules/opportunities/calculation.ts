import { sql, type TenantTransaction } from '@reziproq/db';
import {
  type Lever,
  type OpportunityInput,
  type OpportunityTemplateKey,
  opportunityInputSchema,
  opportunityTemplateKeys,
} from '@reziproq/shared';
import {
  currentMarketCitations,
  type OpportunityCoverage,
  opportunityConfidence,
} from './confidence.js';

type Unit = 'cents' | 'quantity' | 'rate' | 'index';
export type Field = { key: string; unit: Unit };
const field = (key: string, unit: Unit): Field => ({ key, unit });
const percentile = (key: string) => field(key, 'rate');
const cents = (key: string) => field(key, 'cents');
const quantity = (key: string) => field(key, 'quantity');

const catalog = {
  forecast_sharing: {
    fields: [
      percentile('forecast_accuracy'),
      quantity('setups_per_year'),
      cents('cost_per_setup_cents'),
      percentile('avoidable_setups'),
      cents('supplier_inventory_cents'),
      percentile('inventory_reduction'),
      percentile('capital_rate'),
      percentile('pass_through'),
    ],
    effect: 'ebit',
  },
  market_standard: {
    fields: [
      quantity('eligible_quantity'),
      cents('unit_price_cents'),
      percentile('unit_price_reduction'),
    ],
    effect: 'ebit',
  },
  consignment: {
    fields: [
      cents('eligible_buyer_inventory_cents'),
      quantity('annual_draws'),
      cents('annual_storage_cost_cents'),
    ],
    effect: 'cash',
  },
  volume_bundling: {
    fields: [
      percentile('supplier_share'),
      quantity('bundled_quantity'),
      cents('price_old'),
      cents('price_new'),
    ],
    effect: 'ebit',
  },
  quality_costs: {
    fields: [
      quantity('defects_before'),
      cents('cost_per_defect'),
      quantity('defects_after'),
      cents('supplier_cost_per_defect_cents'),
    ],
    effect: 'ebit',
  },
  logistics_bundling: {
    fields: [
      cents('unit_cost_before'),
      cents('unit_cost_after'),
      quantity('quantity'),
      percentile('utilization'),
    ],
    effect: 'ebit',
  },
  index_clause: {
    fields: [
      field('base_index', 'index'),
      field('current_index', 'index'),
      percentile('material_share'),
      cents('eligible_annual_cost_cents'),
    ],
    effect: 'ebit',
  },
  capacity_shortage: {
    fields: [
      percentile('market_utilization'),
      quantity('own_demand'),
      percentile('supplier_share'),
      cents('weekly_loss_cents'),
    ],
    effect: 'cost_avoidance',
  },
  tariffs: {
    fields: [
      percentile('tariff_before'),
      percentile('tariff_after'),
      cents('affected_customs_value_cents'),
    ],
    effect: 'cost_avoidance',
  },
} as const satisfies Record<
  OpportunityTemplateKey,
  { fields: readonly Field[]; effect: 'ebit' | 'cash' | 'cost_avoidance' }
>;

/** Eingaben einer Vorlage mit Einheit, in der Reihenfolge des Rechenwegs */
export const templateFields = (key: OpportunityTemplateKey): readonly Field[] =>
  catalog[key].fields;
export const templateEffect = (key: OpportunityTemplateKey) => catalog[key].effect;
export const templateVersion = 1;

/** leverValueSchema begrenzt Dezimalwerte auf sechs Nachkommastellen. */
function scaled(value: string) {
  const [whole = '0', fraction = ''] = value.replace(/^-/, '').split('.');
  const magnitude = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
  return value.startsWith('-') ? -magnitude : magnitude;
}

function valid(input: OpportunityInput, unit: Unit) {
  const low = scaled(input.low);
  const high = scaled(input.high);
  if (low < 0n || high < low) return false;
  switch (unit) {
    case 'cents':
      return /^\d+$/.test(input.low) && /^\d+$/.test(input.high);
    case 'rate':
      return high <= 1_000_000n;
    case 'index':
      return low > 0n;
    case 'quantity':
      return true;
  }
}

function corners(fields: readonly Field[], inputs: Record<string, OpportunityInput>) {
  let bounds: Record<string, string>[] = [{}];
  for (const { key } of fields) {
    const input = inputs[key];
    if (!input) throw new Error('Eingabewert fehlt nach der Prüfung.');
    const values = [...new Set([input.low, input.high])];
    bounds = bounds.flatMap((bound) => values.map((value) => ({ ...bound, [key]: value })));
  }
  return bounds;
}

/** Die vorhandene PNL-Formel bleibt die einzige Rechenregel für diesen Hebel. */
function pnlFormula(lever: Lever, baseline: Record<string, string>, month: Record<string, string>) {
  const object = (fields: Record<string, string>) => {
    const args = Object.entries(fields).flatMap(([name, key]) => [
      sql`${name}::text`,
      sql`corner -> ${key}`,
    ]);
    return sql`jsonb_build_object(${sql.join(args, sql`, `)})`;
  };
  return sql`app_lever_amount(${lever}, 1, ${object(baseline)}, ${object(month)})`;
}

const n = (key: string) => sql`(corner ->> ${key})::numeric`;
const none = sql`null::numeric`;

/** Rechnungen aus den Hebelvorlagen. Gesparte Kosten und Weitergabe werden je Seite ausgewiesen. */
function formulas(key: OpportunityTemplateKey) {
  switch (key) {
    case 'forecast_sharing': {
      const gross = sql`(${n('setups_per_year')} * ${n('cost_per_setup_cents')} * ${n('avoidable_setups')}
        + ${n('supplier_inventory_cents')} * ${n('inventory_reduction')} * ${n('capital_rate')})`;
      return { buyer: sql`${gross} * ${n('pass_through')}`, supplier: gross };
    }
    case 'market_standard':
      return {
        buyer: sql`${n('eligible_quantity')} * ${n('unit_price_cents')} * ${n('unit_price_reduction')}`,
        supplier: none,
      };
    case 'consignment':
      return {
        buyer: sql`${n('eligible_buyer_inventory_cents')}`,
        supplier: sql`-${n('annual_storage_cost_cents')}`,
      };
    case 'volume_bundling':
      return {
        buyer: pnlFormula(
          'price',
          { price_old: 'price_old' },
          { price_new: 'price_new', quantity: 'bundled_quantity' },
        ),
        supplier: none,
      };
    case 'quality_costs': {
      const amount = (key: string) =>
        pnlFormula(
          'quality',
          { defects_before: 'defects_before', cost_per_defect: key },
          { defects_after: 'defects_after' },
        );
      return {
        buyer: amount('cost_per_defect'),
        supplier: amount('supplier_cost_per_defect_cents'),
      };
    }
    case 'logistics_bundling':
      return {
        buyer: pnlFormula(
          'logistics',
          { unit_cost_before: 'unit_cost_before' },
          { unit_cost_after: 'unit_cost_after', quantity: 'quantity' },
        ),
        supplier: none,
      };
    case 'index_clause':
      return {
        buyer: sql`${n('eligible_annual_cost_cents')} * ${n('material_share')} *
        (1 - ${n('current_index')} / ${n('base_index')})`,
        supplier: none,
      };
    case 'tariffs':
      return {
        buyer: sql`${n('affected_customs_value_cents')} * (${n('tariff_before')} - ${n('tariff_after')})`,
        supplier: none,
      };
    case 'capacity_shortage':
      // Bedarf und Marktquote allein beziffern weder die Wochen ohne Lieferung noch deren Risiko.
      return null;
  }
}

interface AssessmentContext {
  relationshipId: string;
  asOf: string;
}

function usable(input: OpportunityInput, field: Field, context: AssessmentContext) {
  if (!valid(input, field.unit)) return false;
  const { source } = input;
  if (source.kind === 'own_data' || source.kind === 'supplier_input') {
    return (
      source.reference.relationshipId === context.relationshipId &&
      source.reference.observedOn <= context.asOf
    );
  }
  if (source.kind === 'public_source') {
    return currentMarketCitations(source, context.asOf).length > 0;
  }
  return true;
}

function missingFields(
  fields: readonly Field[],
  inputs: Record<string, OpportunityInput>,
  context: AssessmentContext,
) {
  return fields
    .filter((field) => {
      const input = opportunityInputSchema.safeParse(inputs[field.key]);
      return !input.success || !usable(input.data, field, context);
    })
    .map((field) => field.key);
}

/** PNL liefert bigint. Ein Überschreiten des Wertebereichs darf keine andere Vorlage zurückrollen. */
const outsideRange = (error: unknown) => {
  if (typeof error !== 'object' || error === null) return false;
  const dbError = error as { code?: string; cause?: { code?: string } };
  return dbError.code === '22003' || dbError.cause?.code === '22003';
};

/** Min und Max werden über alle Ecken berechnet, auch für negative Preis- und Zolländerungen. */
export async function calculateOpportunity(
  tx: TenantTransaction,
  key: OpportunityTemplateKey,
  inputs: Record<string, OpportunityInput>,
  context: AssessmentContext,
  coverage?: OpportunityCoverage,
) {
  const template = catalog[key];
  const missing = missingFields(template.fields, inputs, context);
  if (missing.length) return { kind: 'gap' as const, missing };
  const formula = formulas(key);
  if (!formula) return { kind: 'gap' as const, missing: ['capacity_shortfall_risk'] };
  const points = corners(template.fields, inputs);
  const result = await tx
    .transaction((inner) =>
      inner.execute<{
        buyer_low: string;
        buyer_high: string;
        supplier_low: string | null;
        supplier_high: string | null;
      }>(sql`
    select min(round(buyer))::text as buyer_low, max(round(buyer))::text as buyer_high,
           min(round(supplier))::text as supplier_low, max(round(supplier))::text as supplier_high
    from (select ${formula.buyer} as buyer, ${formula.supplier} as supplier
          from jsonb_array_elements(${JSON.stringify(points)}::jsonb) as corners(corner)) results
  `),
    )
    .catch((error) => {
      if (outsideRange(error)) return null;
      throw error;
    });
  if (!result) return { kind: 'gap' as const, missing: ['amount_out_of_range'] };

  const row = result.rows[0];
  if (!row) throw new Error('Rechenweg ohne Ergebnis.');
  const buyer = { low: Number(row.buyer_low), high: Number(row.buyer_high) };
  const supplier =
    row.supplier_low === null || row.supplier_high === null
      ? null
      : { low: Number(row.supplier_low), high: Number(row.supplier_high) };
  const amounts = [buyer.low, buyer.high, ...(supplier ? [supplier.low, supplier.high] : [])];
  if (!amounts.every(Number.isSafeInteger))
    return { kind: 'gap' as const, missing: ['amount_out_of_range'] };
  if (buyer.high <= 0 && (supplier?.high ?? 0) <= 0) return { kind: 'no_effect' as const };
  const get = (field: Field) => {
    const input = inputs[field.key];
    if (!input) throw new Error('Eingabewert fehlt nach der Prüfung.');
    return input;
  };
  const [first, ...rest] = template.fields.map(get);
  if (!first) throw new Error('Hebelvorlage ohne Eingaben.');
  return {
    kind: 'opportunity' as const,
    buyer,
    supplier,
    effect: template.effect,
    version: 1,
    confidence: opportunityConfidence([first, ...rest], context.asOf, coverage),
  };
}

/** Jede Vorlage liefert ein Potenzial, eine Datenlücke oder eine Rechnung ohne positive Wirkung. */
export async function calculateOpportunities(
  tx: TenantTransaction,
  facts: Partial<
    Record<
      OpportunityTemplateKey,
      { inputs: Record<string, OpportunityInput>; coverage?: OpportunityCoverage }
    >
  >,
  context: AssessmentContext,
) {
  const results = [];
  // PostgreSQL verwendet für alle Berechnungen dieselbe Mandanten-Transaktion.
  for (const template of opportunityTemplateKeys) {
    const fact = facts[template];
    const result = await calculateOpportunity(
      tx,
      template,
      fact?.inputs ?? {},
      context,
      fact?.coverage,
    );
    results.push({ template, ...result });
  }
  return results;
}
