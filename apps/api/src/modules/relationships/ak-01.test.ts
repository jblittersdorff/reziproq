import {
  eq,
  hollmann,
  hollmannPeople,
  hollmannSuppliers,
  schema,
  supplierPeople,
} from '@reziproq/db';
import {
  agentsResponseSchema,
  akteCounterpartSchema,
  akteHeadSchema,
  akteSharedSchema,
  meetingBriefSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountStore } from '../../common/database.module.js';
import { hollmannTimeout, seedHollmannExclusive } from '../../testing/hollmann.js';
import { startTestApp } from '../../testing/test-app.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { MeetingBriefService } from '../meetings/meeting-brief.service.js';

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

  it('Kopf: Name, Segment, Fokus, Warengruppen mit Lead der Haupt-Warengruppe, Spend 2026', async () => {
    const response = await call(`/beziehungen/${rheintal.relationshipId}`);
    expect(response.status).toBe(200);
    const head = akteHeadSchema.parse(response.body);
    expect(head).toMatchObject({
      name: 'Rheintal Elektronik',
      status: 'active',
      segment: { name: 'Strategisch' },
      isFocus: true,
      year: 2026,
      spend: { amountCents: 420_000_000, currency: 'EUR' },
    });
    // Vorlage: „Leiterplatten, Baugruppen, Kabelsätze · Lead Sara Ost“; im Seed nur die eine (G-9)
    expect(head.materialGroups).toEqual(['Leiterplatten']);
    expect(head.lead).toBe('Sara Ost');
    // Der nächste wichtige Termin ist das JBP am 04.12. („Briefing JBP“), nicht die Abstimmung heute
    expect(head.nextMeeting).toMatchObject({ type: 'jbp', title: 'JBP Rheintal 2027' });
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
    // K2-c.5: Spielregeln „Strategisch“, geteilt am 15.10.; sie gelten ab dem Teilen
    expect(akte.rules).toEqual({
      typeName: 'Strategisch',
      status: 'shared',
      since: '2026-10-15T11:00:00.000Z',
      unshared: false,
    });
    expect(akte.team.own.map((member) => member.name)).toContain(hollmannPeople.janLuka.name);
    // Vom Lieferanten nur die geteilten Mitglieder: Kim Kaiser als Sponsorin (Vorlage L-Ueberblick)
    expect(akte.team.counterpart).toEqual([{ name: 'Kim Kaiser', teamRole: 'sponsor' }]);
    expect(
      (await call(`/beziehungen/${rheintal.relationshipId}/gemeinsam`, supplierPeople.kimKaiser.id))
        .status,
    ).toBe(403);
    expect((await call(`/beziehungen/${hollmann.org.id}/gemeinsam`)).status).toBe(404);
  });

  it('Von Rheintal (K2-c.4): nur was Rheintal geteilt hat, neueste zuerst, je Kennzahl der jüngste Wert', async () => {
    const response = await call(`/beziehungen/${rheintal.relationshipId}/geteilt`);
    expect(response.status).toBe(200);
    const view = akteCounterpartSchema.parse(response.body);
    expect(view.counterpart).toBe('Rheintal Elektronik');
    // Kommentar von Nils Ott am JBP (18.11.), Kennzahlen Oktober von Tom Weber (04.11.), Unterschrift
    // von Kim Kaiser (08.12.2025); die Prognosetreue gehört Hollmann und fehlt
    expect(view.items.map((item) => [item.kind, item.personName])).toEqual([
      ['comment', supplierPeople.nilsOtt.name],
      ['kpi_value', supplierPeople.tomWeber.name],
      ['kpi_value', supplierPeople.tomWeber.name],
      ['signature', supplierPeople.kimKaiser.name],
    ]);
    const [comment, ...rest] = view.items;
    expect(comment).toMatchObject({ objectType: 'meeting', context: 'JBP Rheintal 2027' });
    expect(comment?.kind === 'comment' && comment.body).toContain('Kapazitätsplanung 2028');
    expect(
      rest.flatMap((item) =>
        item.kind === 'kpi_value' ? [[item.name, item.period, item.value, item.awaitingOwn]] : [],
      ),
    ).toEqual(
      expect.arrayContaining([
        ['Liefertreue', '2026-10-01', '94.0000', false],
        ['Reklamationen je Mio. Teile', '2026-10-01', '28.0000', false],
      ]),
    );
    expect(view.items.at(-1)).toMatchObject({ kind: 'signature', planYear: 2026 });
    // K2-c.5: Spielregeln „Strategisch“, am 15.10. geteilt, mit den Pflichten von Rheintal
    expect(view.obligations).toMatchObject({ version: 1, typeName: 'Strategisch' });
    expect(view.obligations?.items.map((item) => [item.title.de, item.cadence])).toEqual([
      ['Kapazität jedes Quartal melden', 'quarterly'],
      ['Liefertreue monatlich melden', 'monthly'],
      ['Prozessänderungen vorher ankündigen', null],
      ['Kostenstruktur bei Preisanpassungen offenlegen', null],
      ['Vorschläge zu Verfahren und Werkstoffen', 'semiannual'],
    ]);
    expect(
      (await call(`/beziehungen/${rheintal.relationshipId}/geteilt`, supplierPeople.kimKaiser.id))
        .status,
    ).toBe(403);
    expect((await call(`/beziehungen/${hollmann.org.id}/geteilt`)).status).toBe(404);
  });

  it('K2-c.6a: Das Briefing zum JBP aus dem Seed ist aktuell; „Briefing JBP“ öffnet es ohne neuen Lauf', async () => {
    const head = akteHeadSchema.parse((await call(`/beziehungen/${rheintal.relationshipId}`)).body);
    const meetingId = head.nextMeeting?.id ?? '';
    const brief = meetingBriefSchema.parse(
      (await call(`/suppliers/${rheintal.relationshipId}/termine/${meetingId}/briefing`)).body,
    );
    // Der Seed trägt die Prüfsumme seiner Eingaben (packages/db/src/hollmann-morgen.ts, Lauf des
    // Briefings). Ändert sich der Seed von Rheintal, nennt dieser Vergleich den neuen Wert.
    const membership = await app.app.get(AccountStore).membershipOf(hollmannPeople.janLuka.id);
    const auth: AuthContext = {
      userId: hollmannPeople.janLuka.id,
      accessToken: '',
      orgRole: membership?.orgRole ?? null,
      isControlling: membership?.isControlling ?? false,
      isOperator: false,
      tokenRoles: [],
      organization: membership?.organization ?? null,
    };
    const current = await app.app
      .get(MeetingBriefService)
      .checksumFor(auth, rheintal.relationshipId, meetingId);
    const [run] = await app.adminDb
      .select({ checksum: schema.agentRun.inputChecksum })
      .from(schema.agentRun)
      .where(eq(schema.agentRun.id, brief.freshness.runId ?? ''));
    expect(run?.checksum, 'Prüfsumme des Briefing-Laufs im Seed').toBe(current);
    expect(brief.freshness).toMatchObject({ unchanged: true, running: false });
    // Die API startet ohne Änderung keinen neuen Lauf (KI-07)
    const agents = agentsResponseSchema.parse((await call('/ki/agenten')).body);
    const agent = agents.agents.find((entry) => entry.key === 'meeting_brief');
    const start = await fetch(`${app.baseUrl}/api/ki/agenten/${agent?.id}/starten`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await app.signToken({ subject: hollmannPeople.janLuka.id })}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ relationshipId: rheintal.relationshipId, meetingId, isTest: false }),
    });
    expect(start.status).toBe(409);
    expect(((await start.json()) as { code: string }).code).toBe('briefing_aktuell');
  });
});
