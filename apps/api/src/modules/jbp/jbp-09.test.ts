import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  auditResponseSchema,
  kpiDetailSchema,
  kpiImportPreviewSchema,
  meetingDetailSchema,
  scorecardViewSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/JBP-09.md: zwölf Monatswerte in einem Import, fehlerhafte Zeilen markiert;
// nur die verantwortliche Seite erfasst; Verlauf für beide; Stand mit Toleranz des Kunden; live im
// Termin. Die Berechnung des Stands testet packages/shared/src/scorecard.test.ts.
describe('JBP-09 Ist-Werte der Kennzahlen', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = { sro: `jbp09-sro-${run}`, admin: `jbp09-admin-${run}`, kam: `jbp09-kam-${run}` };
  const buyer = `/suppliers/${rel}/jbp/scorecard`;
  const supplier = `/kunden/${rel}/jbp/scorecard`;
  let meetingId = '';
  let buyerKpi = '';
  let supplierKpi = '';

  const call = async (user: string, method: string, url: string, body?: unknown) => {
    const response = await fetch(`${testApp.baseUrl}/api${url}`, {
      method,
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: user })}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  };
  const upload = async (user: string, url: string, csv: string) => {
    const form = new FormData();
    form.append('file', new Blob([csv], { type: 'text/csv' }), 'werte.csv');
    const response = await fetch(`${testApp.baseUrl}/api${url}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await testApp.signToken({ subject: user })}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as unknown };
  };
  const kpi = (name: string, ownerUserId: string) => ({
    name,
    unit: '%',
    direction: 'higher',
    baseline: '80',
    target: '100',
    targetDate: '2099-12-31',
    ownerUserId,
    benefitFor: 'both',
    initiativeId: null,
  });

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `JBP9-OEM ${run}` },
      { id: orgs.supplier, name: `JBP9-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const person = (
      id: string,
      name: string,
      organizationId: string,
      orgRole: 'admin' | 'member',
    ) => ({
      id,
      name,
      email: `${id}@example.com`,
      organizationId,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.sro, 'Sara Ost', orgs.oem, 'member'),
        person(users.admin, 'Ada Admin', orgs.oem, 'admin'),
        person(users.kam, 'Kim Kaiser', orgs.supplier, 'admin'),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db
      .insert(schema.relationshipMember)
      .values({ relationshipId: rel, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' });
    const created = (
      await call(users.sro, 'POST', `/suppliers/${rel}/jbp`, {
        startsAt: '2099-01-15T09:00:00Z',
        location: null,
        locale: 'de',
      })
    ).body as { meeting: { id: string } };
    meetingId = created.meeting.id;
    await call(users.sro, 'POST', `${buyer}/kennzahlen`, kpi('Liefertreue', users.sro));
    await call(users.kam, 'POST', `${supplier}/kennzahlen`, kpi('Kapazität', users.kam));
    const view = scorecardViewSchema.parse((await call(users.sro, 'GET', buyer)).body);
    buyerKpi = view.kpis.find((entry) => entry.name === 'Liefertreue')?.id as string;
    supplierKpi = view.kpis.find((entry) => entry.name === 'Kapazität')?.id as string;
  });

  afterAll(async () => {
    await db.execute(sql`delete from jbp where relationship_id = ${rel}`);
    await db.execute(sql`delete from meeting where relationship_id = ${rel}`);
    await db.execute(sql`delete from scorecard_setting where org_id = ${orgs.oem}`);
    await db.execute(sql`delete from insight_summary where org_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from model_call where org_id in ${Object.values(orgs)}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('zwölf Monatswerte in einem Schritt; fehlerhafte Zeilen sind markiert', async () => {
    const months = Array.from(
      { length: 12 },
      (_, index) => `2099-${String(index + 1).padStart(2, '0')}`,
    );
    const good = [
      'Kennzahl;Monat;Wert',
      ...months.map((month, index) => `Liefertreue;${month};${80 + index},5`),
    ].join('\n');
    const bad = `${good}\nUnbekannt;2099-01;90\nLiefertreue;13.2099;90\nLiefertreue;2099-02;viel\nKapazität;2099-03;70\nLiefertreue;2099-01;81`;
    const preview = kpiImportPreviewSchema.parse(
      (await upload(users.sro, `${buyer}/import/vorschau`, bad)).body,
    );
    expect(preview).toMatchObject({ valid: 12, invalid: 5 });
    expect(preview.rows.slice(12).map((row) => row.errors)).toEqual([
      ['kennzahl_unbekannt'],
      ['monat_ungueltig'],
      ['wert_ungueltig'],
      ['kennzahl_andere_seite'],
      ['doppelt'],
    ]);
    // Mit Fehlern wird nichts übernommen.
    expect((await upload(users.sro, `${buyer}/import`, bad)).status).toBe(400);
    expect(
      kpiDetailSchema.parse((await call(users.sro, 'GET', `${buyer}/kennzahlen/${buyerKpi}`)).body)
        .values,
    ).toEqual([]);
    const applied = kpiImportPreviewSchema.parse(
      (await upload(users.sro, `${buyer}/import`, good)).body,
    );
    expect(applied.valid).toBe(12);
    const detail = kpiDetailSchema.parse(
      (await call(users.kam, 'GET', `${supplier}/kennzahlen/${buyerKpi}`)).body,
    );
    expect(detail.values).toHaveLength(12);
    expect(detail.values[0]).toMatchObject({ period: '2099-12-01', source: 'csv' });
    expect(Number(detail.values[0]?.value)).toBe(91.5);
  });

  it('nur die verantwortliche Seite erfasst Werte', async () => {
    const foreign = await call(users.kam, 'POST', `${supplier}/kennzahlen/${buyerKpi}/werte`, {
      month: '2099-05',
      value: '1',
    });
    expect(foreign.status).toBe(403);
    const own = await call(users.kam, 'POST', `${supplier}/kennzahlen/${supplierKpi}/werte`, {
      month: '2099-05',
      value: '60',
    });
    expect(own.status).toBe(201);
    // Ein neuer Wert für denselben Monat ersetzt den alten.
    const replaced = kpiDetailSchema.parse(
      (
        await call(users.kam, 'POST', `${supplier}/kennzahlen/${supplierKpi}/werte`, {
          month: '2099-05',
          value: '95',
        })
      ).body,
    );
    expect(replaced.values.map((row) => Number(row.value))).toEqual([95]);
  });

  it('der Verlauf je Kennzahl ist für beide Seiten sichtbar', async () => {
    for (const [user, extra] of [
      [users.sro, ''],
      [users.kam, `&relationship_id=${rel}`],
    ] as const) {
      const history = auditResponseSchema.parse(
        (await call(user, 'GET', `/audit?object_type=kpi_value&object_id=${supplierKpi}${extra}`))
          .body,
      );
      expect(history.entries.map((entry) => entry.changes.value)).toEqual([
        { from: '60', to: '95' },
        { from: null, to: '60' },
      ]);
    }
  });

  it('der Stand folgt der Toleranz des Kunden, auf beiden Seiten gleich', async () => {
    // Kapazität: Basis 80 zum Start, im Mai 2099 liegt die Linie nahe am Ziel 100; 95 ist knapp.
    const track = async (user: string, base: string) =>
      scorecardViewSchema
        .parse((await call(user, 'GET', base)).body)
        .kpis.find((entry) => entry.id === supplierKpi)?.track;
    expect(await track(users.sro, buyer)).toBe('close');
    expect(await track(users.kam, supplier)).toBe('close');
    expect(
      (await call(users.sro, 'PUT', '/scorecard/settings', { tolerancePercent: 2 })).status,
    ).toBe(403);
    expect(
      (await call(users.admin, 'PUT', '/scorecard/settings', { tolerancePercent: 2 })).status,
    ).toBe(200);
    expect(await track(users.sro, buyer)).toBe('off');
    expect(await track(users.kam, supplier)).toBe('off');
    expect(
      scorecardViewSchema.parse((await call(users.kam, 'GET', supplier)).body).tolerancePercent,
    ).toBe(2);
  });

  it('AW-01: der Käufer sieht eine Aussage zum Stand der Kennzahlen, der Lieferant nie', async () => {
    // Frühere Abrufe mit anderem Stand: innerhalb einer Stunde zeigt die Seite sonst nur den Beleg
    await db.execute(sql`delete from insight_summary where org_id = ${orgs.oem}`);
    const own = scorecardViewSchema.parse((await call(users.sro, 'GET', buyer)).body);
    expect(own.statement?.headline).toMatch(/^\d von \d Kennzahlen mit .+ sind auf Kurs\.$/);
    expect(own.statement?.body).toMatch(/Am weitesten hinter Plan liegt .+\./);
    const theirs = scorecardViewSchema.parse((await call(users.kam, 'GET', supplier)).body);
    expect(theirs.statement ?? null).toBeNull();
  });

  it('die Scorecard erscheint mit Ist-Werten live im Termin', async () => {
    const detail = meetingDetailSchema.parse(
      (await call(users.kam, 'GET', `/kunden/${rel}/termine/${meetingId}`)).body,
    );
    const section = detail.live.sections.find((entry) => entry.key === 'scorecard');
    expect(section?.items.map((item) => [item.title, item.status])).toEqual([
      ['Liefertreue', 'off'],
      ['Kapazität', 'off'],
    ]);
  });
});
