import { hollmannPeople, supplierPeople } from '@reziproq/db';
import {
  nextActionSchema,
  relationshipSegmentsSchema,
  relationshipsResponseSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { hollmannTimeout, seedHollmannExclusive } from '../../testing/hollmann.js';
import { startTestApp } from '../../testing/test-app.js';

// BZ-01 (K2-b.3): Seite Lieferanten über die echten Dienste, am Seed von Hollmann (Mo 23.11.2026).
// Vorlagen Lieferanten und K2-Segmente; Zahlen aus K2-a.5 und K2-b.2.
describe('BZ-01 Lieferanten im Demo-Mandanten Hollmann (K2-b.3)', () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let release: (() => Promise<void>) | undefined;

  async function call(path: string, subject: string = hollmannPeople.janLuka.id) {
    const response = await fetch(`${app.baseUrl}/api${path}`, {
      headers: { authorization: `Bearer ${await app.signToken({ subject })}` },
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  }
  const list = async (query = '') =>
    relationshipsResponseSchema.parse((await call(`/beziehungen${query}`)).body);
  const segments = async () =>
    relationshipSegmentsSchema.parse((await call('/beziehungen/segmente')).body);
  const mio = (value: number) => Math.round(value * 100_000_000);

  beforeAll(async () => {
    app = await startTestApp();
    release = await seedHollmannExclusive(app.adminDb);
  }, hollmannTimeout);

  afterAll(async () => {
    await release?.();
    await app.close();
  });

  it('T2-01: 16 Beziehungen; nach Aufmerksamkeit stehen Rheintal, Silesia, Kessler oben', async () => {
    const page = await list();
    expect(page.year).toBe(2026);
    expect(page.head).toEqual({
      active: 16,
      spend: [{ amountCents: mio(30.1), currency: 'EUR' }],
      portfolio: 46,
    });
    expect(page.counts).toEqual({ alle: 16, meine: 6, strategisch: 8, offeneZusagen: 11 });
    expect(page.rows).toHaveLength(16);
    expect(page.rows.slice(0, 4).map((row) => row.name)).toEqual([
      'Rheintal Elektronik',
      'Silesia Guss',
      'Kessler Präzision',
      'Pearl River Components',
    ]);
    const [rheintal, silesia, kessler, pearl] = page.rows;
    // Die graue Zeile: der jeweils wichtigste Grund
    expect(rheintal).toMatchObject({
      materialGroup: 'Leiterplatten',
      country: 'DE',
      spend: { amountCents: mio(4.2), currency: 'EUR' },
      reason: { kind: 'overdue', count: 1, title: '8D-Bericht Charge 4711' },
      segment: { name: 'Strategisch' },
      attention: 5,
    });
    expect(silesia?.reason).toEqual({
      kind: 'hint',
      hint: expect.objectContaining({
        ruleKey: 'performance_drop',
        severity: 'high',
        status: 'in_progress',
        metric: 'Liefertreue',
        value: '86 %',
      }),
    });
    expect(kessler).toMatchObject({ reason: { kind: 'disputed' }, disputed: true, attention: 3 });
    expect(pearl).toMatchObject({ reason: { kind: 'unrated' }, segment: null, attention: 2 });
    // Danach nach Spend, ohne Grund (der Vorschlag für Alpen Kunststofftechnik kommt mit K2-e)
    expect(page.rows.slice(4, 8).map((row) => row.name)).toEqual([
      'Lombardia Fonderie',
      'Alpen Sensorik',
      'Moravia Plast',
      'Nordwerk Guss',
    ]);
    expect(page.rows.slice(4).every((row) => row.attention === 0)).toBe(true);
  });

  it('T2-02: Mini-Spiegel Rheintal 90 und 78 %; Pearl River „noch keine Zusagen“', async () => {
    const page = await list();
    const quota = (name: string) => {
      const row = page.rows.find((entry) => entry.name === name);
      return row?.quota ? [row.quota.own.percent, row.quota.counterpart.percent] : null;
    };
    expect(quota('Rheintal Elektronik')).toEqual([90, 78]);
    expect(quota('Pearl River Components')).toBeNull();
    // Die übrigen der Vorlage
    expect(quota('Silesia Guss')).toEqual([100, 60]);
    expect(quota('Kessler Präzision')).toEqual([88, 80]);
    expect(quota('Alpen Kunststofftechnik')).toEqual([100, 92]);
    expect(quota('Lombardia Fonderie')).toEqual([83, 86]);
    expect(quota('Alpen Sensorik')).toEqual([100, 100]);
    expect(quota('Moravia Plast')).toEqual([75, 67]);
    // Gezählt wird nur, was beide Seiten bestätigt haben: Rheintal 7 von 9
    const rheintal = page.rows.find((entry) => entry.name === 'Rheintal Elektronik');
    expect(rheintal?.quota?.counterpart).toEqual({ kept: 7, due: 9, percent: 78 });
  });

  it('Das Wichtigste: zwei Beziehungen deutlich besser; Silesia hakt, Pearl River fehlt, Rheintal Info', async () => {
    const { summary } = await list();
    // Vorlage: „Bei drei Beziehungen …“; ab 10 Punkten Abstand sind es Rheintal und Silesia
    expect(summary.keptBetter).toBe(2);
    expect(summary.unrated).toMatchObject({ name: 'Pearl River Components', largest: true });
    expect(summary.rows.map((row) => row.kind)).toEqual([
      'counterpart_low',
      'unrated',
      'quota_gap',
    ]);
    expect(summary.rows[0]).toMatchObject({
      name: 'Silesia Guss',
      kept: 3,
      due: 5,
      hint: { metric: 'Liefertreue' },
    });
    expect(summary.rows[1]).toMatchObject({
      name: 'Pearl River Components',
      spend: { amountCents: mio(5.64) },
    });
    expect(summary.rows[2]).toMatchObject({
      name: 'Rheintal Elektronik',
      own: 90,
      counterpart: 78,
      overdue: { count: 1, title: '8D-Bericht Charge 4711' },
    });
  });

  it('Mehr Filter: Portfolio nimmt die 30 importierten Lieferanten ohne Anbindung dazu (E-K2-10)', async () => {
    const page = await list('?portfolio=1');
    expect(page.rows).toHaveLength(46);
    expect(page.counts.alle).toBe(46);
    expect(page.rows.filter((row) => row.status === 'draft')).toHaveLength(30);
    // Kopf bleibt: aktive Beziehungen und ihr Spend
    expect(page.head.active).toBe(16);
    expect((await call('/beziehungen?portfolio=ja')).status).toBe(400);
  });

  it('T2-03: Linse Segmente: Felder 9, 8, 9, 12; Kessler strittig; „Ohne Bewertung · 8“', async () => {
    const page = await segments();
    expect(page.model).toMatchObject({
      gridSize: 2,
      impactLabel: 'Versorgungsrisiko',
      qualityLabel: 'Wertbeitrag',
    });
    expect(page.portfolio).toBe(46);
    expect(page.rated).toBe(38);
    expect(page.round).toMatchObject({ name: 'Bewertungsrunde 2027', dueDate: '2026-12-19' });
    // Zeilen nach Versorgungsrisiko absteigend, Spalten nach Wertbeitrag aufsteigend
    expect(page.fields.map((field) => [field.name, field.count])).toEqual([
      ['Entwickeln', 9],
      ['Strategisch', 8],
      ['Hebeln', 9],
      ['Absichern', 12],
    ]);
    expect(page.fields.map((field) => field.spend[0]?.amountCents)).toEqual([
      mio(4.3),
      mio(18.4),
      mio(9.1),
      mio(6.2),
    ]);
    // Aktive Beziehungen zuerst, dann nach Spend
    const names = (key: string) =>
      page.fields.find((field) => field.name === key)?.suppliers.map((supplier) => supplier.name);
    expect(names('Strategisch')?.slice(0, 3)).toEqual([
      'Rheintal Elektronik',
      'Silesia Guss',
      'Nordwerk Guss',
    ]);
    expect(names('Hebeln')?.slice(0, 2)).toEqual(['Lombardia Fonderie', 'Moravia Plast']);
    expect(names('Absichern')?.slice(0, 2)).toEqual(['Alpen Sensorik', 'Baltic Logistics']);
    const entwickeln = page.fields.find((field) => field.name === 'Entwickeln');
    expect(entwickeln?.suppliers.filter((supplier) => supplier.disputed)).toEqual([
      expect.objectContaining({ name: 'Kessler Präzision', status: 'active' }),
    ]);
    expect(page.unrated.count).toBe(8);
    expect(page.unrated.suppliers[0]).toMatchObject({
      name: 'Pearl River Components',
      spend: { amountCents: mio(5.64) },
    });
    expect(page.ratedSpend).toEqual([{ amountCents: mio(38), currency: 'EUR' }]);
  });

  it('Das Wichtigste der Segmente: Strategisch trägt 48 % des bewerteten Spend; Kessler entscheidet über das Segment', async () => {
    const { summary } = await segments();
    expect(summary.top).toMatchObject({ name: 'Strategisch', count: 8, share: 48 });
    expect(summary.disputed).toEqual([
      {
        relationshipId: expect.any(String),
        name: 'Kessler Präzision',
        criterion: { key: 'qualitaet', name: 'Qualität' },
        min: 25,
        max: 100,
        decidesSegment: true,
      },
    ]);
  });

  it('T2-S04: Der Lieferant bekommt weder Liste noch Segmente', async () => {
    const supplier = supplierPeople.kimKaiser.id;
    expect((await call('/beziehungen', supplier)).status).toBe(403);
    expect((await call('/beziehungen/segmente', supplier)).status).toBe(403);
  });

  it('Als Nächstes mit bereich=beziehungen: nur Themen mit Beziehung', async () => {
    const schema = z.object({ next: nextActionSchema.nullable() });
    const global = schema.parse((await call('/start/als-naechstes')).body);
    const scoped = schema.parse((await call('/start/als-naechstes?bereich=beziehungen')).body);
    expect(scoped.next?.scope).toBe('relationships');
    // Am 23.11. hängen alle Fokus-Themen von Jan-Luka an einer Beziehung
    expect(scoped.next?.item.id).toBe(global.next?.item.id);
    expect((await call('/start/als-naechstes?bereich=warengruppen')).status).toBe(400);
  });

  // Zuletzt, weil die Liste der Hinweise alle Regeln neu prüft (wie der tägliche Lauf um 06:30)
  it('ein Lauf der Regeln legt keinen offenen Hinweis an; Liste und Heute bleiben gleich', async () => {
    const before = await list();
    const hints = z
      .object({ hints: z.array(z.object({ ruleKey: z.string(), status: z.string() })) })
      .parse((await call('/hinweise')).body).hints;
    // Die Lagen am 23.11. hat Jan-Luka übernommen; offen ist keine (Drehbuch K1)
    expect(hints.map((entry) => [entry.ruleKey, entry.status]).sort()).toEqual([
      ['performance_drop', 'in_progress'],
      ['supplier_commitment_overdue', 'in_progress'],
      ['unexplained_deviation', 'in_progress'],
    ]);
    const after = await list();
    expect(after.rows).toEqual(before.rows);
    expect(after.rows.find((row) => row.name === 'Silesia Guss')?.reason).toMatchObject({
      kind: 'hint',
      hint: { status: 'in_progress', value: '86 %' },
    });
    const today = z.object({ openFocus: z.number() }).parse((await call('/heute')).body);
    expect(today.openFocus).toBe(3);
  });
});
