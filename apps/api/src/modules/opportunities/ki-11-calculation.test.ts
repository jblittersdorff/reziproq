import { randomUUID } from 'node:crypto';
import type { OpportunityInput } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp } from '../../testing/test-app.js';
import { calculateOpportunities, calculateOpportunity } from './calculation.js';
import { opportunityConfidence } from './confidence.js';

const asOf = '2026-11-22';
const context = { asOf, relationshipId: randomUUID() };
const own = (value: string, observedOn = '2026-07-01'): OpportunityInput => ({
  low: value,
  high: value,
  source: {
    kind: 'own_data',
    reference: {
      objectType: 'scorecard',
      objectId: randomUUID(),
      relationshipId: context.relationshipId,
      observedOn,
    },
  },
});
const assumption = (low: string, high = low): OpportunityInput => ({
  low,
  high,
  source: { kind: 'template_assumption' },
});
const publicIndex = (value: string): OpportunityInput => ({
  low: value,
  high: value,
  source: {
    kind: 'public_source',
    citations: [
      {
        url: 'https://index-one.example.test/october',
        publisher: 'Index One',
        publishedOn: '2026-10-31',
      },
      {
        url: 'https://index-two.example.test/october',
        publisher: 'Index Two',
        publishedOn: '2026-10-31',
      },
    ],
  },
});

describe('KI-11 Sicherheit', () => {
  it('stuft aktuelle eigene Eingaben und verlinkte Lieferantenangaben als hoch ein', () => {
    const supplier = own('10', '2025-11-22');
    if (supplier.source.kind !== 'own_data') throw new Error('Testquelle fehlt.');
    expect(
      opportunityConfidence(
        [
          own('100'),
          { ...supplier, source: { kind: 'supplier_input', reference: supplier.source.reference } },
        ],
        asOf,
      ),
    ).toEqual({ level: 'high', reason: 'fresh_internal' });
  });

  it('stuft Vorlagenannahmen und zwei unabhängige öffentliche Quellen als mittel ein', () => {
    expect(opportunityConfidence([own('100'), assumption('0.4', '0.6')], asOf).level).toBe(
      'medium',
    );
    expect(opportunityConfidence([publicIndex('100')], asOf).level).toBe('medium');
  });

  it('wendet die niedrigste Stufe bei Hochrechnung oder lückenhafter Abdeckung an', () => {
    expect(
      opportunityConfidence([assumption('0.4', '0.6'), own('100')], asOf, { extrapolated: true }),
    ).toEqual({ level: 'low', reason: 'extrapolation' });
    expect(
      opportunityConfidence([own('100')], asOf, {
        extrapolated: false,
        observedParts: 8,
        totalParts: 23,
      }),
    ).toEqual({ level: 'low', reason: 'insufficient_coverage' });
  });

  it('stuft eine einzelne öffentliche Quelle, alte Daten und Nutzerannahmen als niedrig ein', () => {
    const idx = publicIndex('100');
    if (idx.source.kind !== 'public_source') throw new Error('Testquelle fehlt.');
    const [citation] = idx.source.citations;
    if (!citation) throw new Error('Testquelle fehlt.');
    expect(
      opportunityConfidence(
        [assumption('0.6'), { ...idx, source: { kind: 'public_source', citations: [citation] } }],
        asOf,
      ),
    ).toEqual({ level: 'low', reason: 'single_public_source' });
    expect(opportunityConfidence([own('100', '2025-11-21')], asOf)).toEqual({
      level: 'low',
      reason: 'stale_data',
    });
    expect(
      opportunityConfidence([{ low: '1', high: '2', source: { kind: 'user_assumption' } }], asOf),
    ).toEqual({ level: 'low', reason: 'user_assumption' });
  });
});

describe('KI-11 versionierte Berechnung', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  beforeAll(async () => {
    testApp = await startTestApp();
  });
  afterAll(async () => {
    await testApp?.close();
  });

  it('rechnet Prognose und Weitergabe als Cent-Spannen nach der Referenz', async () => {
    const facts = {
      forecast_accuracy: own('0.72'),
      setups_per_year: own('56'),
      cost_per_setup_cents: own('420000'),
      avoidable_setups: assumption('0.6', '0.8'),
      supplier_inventory_cents: own('61000000'),
      inventory_reduction: assumption('0.4', '0.6'),
      capital_rate: assumption('0.09'),
      pass_through: assumption('0.5'),
    };
    const result = await testApp.adminDb.transaction((tx) =>
      calculateOpportunity(tx, 'forecast_sharing', facts, context),
    );
    expect(result).toEqual({
      kind: 'opportunity',
      version: 1,
      effect: 'ebit',
      buyer: { low: 8154000, high: 11055000 },
      supplier: { low: 16308000, high: 22110000 },
      confidence: { level: 'medium', reason: 'template_assumption' },
    });
  });

  it('rechnet die Indexklausel auf den vertraglich erfassten Kostenanteil', async () => {
    const result = await testApp.adminDb.transaction((tx) =>
      calculateOpportunity(
        tx,
        'index_clause',
        {
          base_index: publicIndex('100'),
          current_index: publicIndex('88'),
          material_share: own('0.18'),
          eligible_annual_cost_cents: own('300000000'),
        },
        context,
      ),
    );
    expect(result).toMatchObject({
      kind: 'opportunity',
      buyer: { low: 6480000, high: 6480000 },
      effect: 'ebit',
    });
  });

  it('nutzt bestehende PNL-Rechenregeln und kennzeichnet fehlende Eingaben ausdrücklich', async () => {
    const results = await testApp.adminDb.transaction((tx) =>
      calculateOpportunities(
        tx,
        {
          logistics_bundling: {
            inputs: {
              unit_cost_before: own('250'),
              unit_cost_after: own('200'),
              quantity: own('4000'),
              utilization: own('0.8'),
            },
          },
          volume_bundling: {
            inputs: {
              supplier_share: own('0.5'),
              bundled_quantity: own('1000'),
              price_old: own('150'),
              price_new: own('150'),
            },
          },
        },
        context,
      ),
    );
    expect(results).toHaveLength(9);
    expect(results.filter((result) => result.kind === 'gap')).toHaveLength(7);
    expect(results.find((result) => result.template === 'logistics_bundling')).toMatchObject({
      kind: 'opportunity',
      buyer: { low: 200000, high: 200000 },
      confidence: { level: 'high' },
    });
    expect(results.find((result) => result.template === 'volume_bundling')).toEqual({
      template: 'volume_bundling',
      kind: 'no_effect',
    });
  });

  it('weist Zahlen einer anderen Lieferantenbeziehung zurück', async () => {
    const foreign = own('300000000');
    if (foreign.source.kind !== 'own_data') throw new Error('Testquelle fehlt.');
    foreign.source.reference.relationshipId = randomUUID();
    const result = await testApp.adminDb.transaction((tx) =>
      calculateOpportunity(
        tx,
        'index_clause',
        {
          base_index: publicIndex('100'),
          current_index: publicIndex('88'),
          material_share: own('0.18'),
          eligible_annual_cost_cents: foreign,
        },
        context,
      ),
    );
    expect(result).toEqual({ kind: 'gap', missing: ['eligible_annual_cost_cents'] });
  });

  it('bildet einen fehlenden Kostenbezug und einen Index von null als Datenlücke ab', async () => {
    const result = await testApp.adminDb.transaction((tx) =>
      calculateOpportunity(
        tx,
        'index_clause',
        {
          base_index: publicIndex('0'),
          current_index: publicIndex('88'),
          material_share: own('0.18'),
        },
        context,
      ),
    );
    expect(result).toEqual({ kind: 'gap', missing: ['base_index', 'eligible_annual_cost_cents'] });
  });
});
