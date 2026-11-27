import { hollmann, hollmannPeople, hollmannSuppliers, supplierPeople } from '@reziproq/db';
import { akteSharedSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hollmannTimeout, seedHollmannExclusive } from '../../testing/hollmann.js';
import { startTestApp } from '../../testing/test-app.js';

// AK-01 (K2-c.1): Akte Rheintal, Sicht Gemeinsam, gegen die echte API im Demo-Mandanten Hollmann
// (Mo 23.11.2026, Demo-Uhr), nach der Vorlage L-Ueberblick. Nur die Käuferseite.

const rheintal = hollmannSuppliers.find((entry) => entry.key === 'rheintal');
if (!rheintal) throw new Error('Rheintal fehlt im Seed');

describe('AK-01 Akte, Sicht Gemeinsam (Hollmann, Rheintal)', () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let release: (() => Promise<void>) | undefined;

  async function call(path: string, subject: string = hollmannPeople.janLuka.id) {
    const response = await fetch(`${app.baseUrl}/api${path}`, {
      headers: { authorization: `Bearer ${await app.signToken({ subject })}` },
    });
    return { status: response.status, body: (await response.json()) as unknown };
  }

  beforeAll(async () => {
    app = await startTestApp();
    release = await seedHollmannExclusive(app.adminDb);
  }, hollmannTimeout);

  afterAll(async () => {
    try {
      await release?.();
    } finally {
      await app.close();
    }
  });

  it('Spiegel 90 zu 78 %, sechs offene Zusagen nach Frist mit Seite, Person, Herkunft und Stand', async () => {
    const response = await call(`/beziehungen/${rheintal.relationshipId}/gemeinsam`);
    expect(response.status).toBe(200);
    const akte = akteSharedSchema.parse(response.body);
    expect(akte.counterpart).toBe('Rheintal Elektronik');
    expect(akte.quota).toEqual({
      own: { kept: 9, due: 10, percent: 90 },
      counterpart: { kept: 7, due: 9, percent: 78 },
    });
    expect(
      akte.commitments.map((entry) => [entry.title, entry.side, entry.ownerName, entry.state]),
    ).toEqual([
      ['8D-Bericht Charge 4711', 'supplier', 'Nils Ott', 'overdue'],
      ['Beitrag Machbarkeit Lieferzeit', 'supplier', 'Tom Weber', 'open'],
      ['Prognose monatlich teilen', 'buyer', 'Ida Roth', 'open'],
      ['Musterteile Starrflex liefern', 'supplier', 'Kim Kaiser', 'awaiting_counterpart'],
      ['Prognose 2028 teilen', 'buyer', 'Ida Roth', 'open'],
      ['Abnahmeplan SMT-Linie', 'supplier', 'Kim Kaiser', 'open'],
    ]);
    const byTitle = new Map(akte.commitments.map((entry) => [entry.title, entry]));
    expect(byTitle.get('Prognose monatlich teilen')).toMatchObject({
      origin: 'feedback',
      measure: 'monatlich ab 15.12.',
    });
    expect(byTitle.get('Musterteile Starrflex liefern')?.enteredBy).toBe('buyer');
    expect(byTitle.get('Abnahmeplan SMT-Linie')).toMatchObject({ origin: 'plan', planYear: 2026 });
    expect(akte.kept).toEqual({
      count: 16,
      last: { title: 'Abrufmengen 6 Monate im Voraus', side: 'buyer' },
    });
  });

  it('Scorecard mit Kennzahlen Oktober, Stand je Kennzahl und Unterschriften beider Seiten', async () => {
    const akte = akteSharedSchema.parse(
      (await call(`/beziehungen/${rheintal.relationshipId}/gemeinsam`)).body,
    );
    expect(akte.scorecard).toMatchObject({
      status: 'signed',
      signed: { own: true, counterpart: true },
      period: '2026-10-01',
    });
    expect(
      akte.scorecard?.kpis.map((kpi) => [
        kpi.name,
        kpi.ownerSide,
        kpi.latest?.value ?? null,
        kpi.track,
      ]),
    ).toEqual([
      ['Liefertreue', 'supplier', '94.0000', 'close'],
      ['Reklamationen je Mio. Teile', 'supplier', '28.0000', 'on_track'],
      ['Prognosetreue', 'buyer', '72.0000', 'off'],
      ['Durchlaufzeit Musterteile', 'supplier', null, null],
    ]);
  });

  it('Nächste Wochen, Plan, Team beider Seiten; der Lieferant bekommt die Akte des Käufers nicht', async () => {
    const akte = akteSharedSchema.parse(
      (await call(`/beziehungen/${rheintal.relationshipId}/gemeinsam`)).body,
    );
    expect(
      akte.weeks.map((entry) => (entry.kind === 'meeting' ? entry.title : `Frist ${entry.title}`)),
    ).toEqual([
      'Abstimmung Musterteile Starrflex',
      'Frist Beitrag Machbarkeit Lieferzeit',
      'JBP Rheintal 2027',
      'Frist Prognose monatlich teilen',
      'Frist Musterteile Starrflex liefern',
    ]);
    expect(akte.plan).toMatchObject({ status: 'approved', year: 2026 });
    expect(akte.team.own.map((member) => member.name)).toContain(hollmannPeople.janLuka.name);
    expect(
      (await call(`/beziehungen/${rheintal.relationshipId}/gemeinsam`, supplierPeople.kimKaiser.id))
        .status,
    ).toBe(403);
    expect((await call(`/beziehungen/${hollmann.org.id}/gemeinsam`)).status).toBe(404);
  });
});
