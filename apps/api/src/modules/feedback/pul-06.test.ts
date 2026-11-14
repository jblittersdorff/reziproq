import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { actionListSchema, surveyWaveDetailSchema, surveyWavesSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/PUL-06.md: Maßnahme aus einer Lücke mit richtiger Quelle in der Liste und im
// Abschnitt der Welle; beide Seiten sehen denselben Abschnitt, interne nur die eigene Seite;
// Verlauf ab zwei Wellen mit den richtigen Werten, Puls und Jahres-Feedback getrennt.
describe('PUL-06 Maßnahmen aus Lücken und Verlauf', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = { sro: `pul06-sro-${run}`, kam: `pul06-kam-${run}` };
  const waves = {
    pulse1: randomUUID(),
    pulse2: randomUUID(),
    annual1: randomUUID(),
  };
  const resultIds: Record<string, string> = {};

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
  /** Aufgedeckte Welle mit Ergebnissen, direkt angelegt (die Rechnung testet PUL-03). */
  const revealedWave = async (
    id: string,
    kind: 'pulse' | 'annual',
    revealedAt: string,
    values: Record<string, [number, number]>,
  ) => {
    await db.insert(schema.surveyWave).values({
      id,
      relationshipId: rel,
      ownerOrgId: orgs.oem,
      visibility: 'shared',
      templateId: randomUUID(),
      templateVersion: 1,
      kind,
      dueDate: '2026-01-31',
      buyerClosedAt: new Date(revealedAt),
      supplierClosedAt: new Date(revealedAt),
      revealedAt: new Date(revealedAt),
      createdBy: users.sro,
      createdByName: 'Sara Ost',
    });
    for (const [dimension, [buyer, supplier]] of Object.entries(values)) {
      for (const [side, ist] of [
        ['buyer', buyer],
        ['supplier', supplier],
      ] as const) {
        const [row] = await db
          .insert(schema.surveyResult)
          .values({
            waveId: id,
            relationshipId: rel,
            ownerOrgId: orgs.oem,
            visibility: 'shared',
            side,
            dimension,
            istMean: String(ist),
            sollMean: '4.50',
            n: 3,
          })
          .returning({ id: schema.surveyResult.id });
        if (side === 'buyer') resultIds[`${id}:${dimension}`] = row?.id as string;
      }
    }
  };
  const action = (title: string, visibility: 'shared' | 'internal', sourceId: string) => ({
    action: {
      title,
      description: null,
      visibility,
      ownerSide: 'buyer',
      ownerUserId: users.sro,
      ownerName: null,
      dueDate: '2099-06-30',
    },
    sourceType: 'feedback_gap',
    sourceId,
  });

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `PUL6-OEM ${run}` },
      { id: orgs.supplier, name: `PUL6-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const user = (id: string, organizationId: string, orgRole: 'admin' | 'member') => ({
      id,
      name: id,
      email: `${id}@example.com`,
      organizationId,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([user(users.sro, orgs.oem, 'member'), user(users.kam, orgs.supplier, 'admin')]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db
      .insert(schema.relationshipMember)
      .values({ relationshipId: rel, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' });
    await revealedWave(waves.pulse1, 'pulse', '2026-03-31T10:00:00Z', {
      trust: [4, 3],
      transparency: [4.2, 3.0],
    });
    await revealedWave(waves.pulse2, 'pulse', '2026-09-30T10:00:00Z', {
      trust: [4.1, 3.5],
      transparency: [4.1, 3.6],
    });
    await revealedWave(waves.annual1, 'annual', '2026-06-30T10:00:00Z', {
      trust: [3, 3],
    });
  });

  afterAll(async () => {
    await db.execute(sql`delete from action where relationship_id = ${rel}`);
    await db.execute(sql`delete from survey_result where relationship_id = ${rel}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('eine Maßnahme aus einer Lücke trägt die Quelle und erscheint in der Liste und bei der Welle', async () => {
    const source = resultIds[`${waves.pulse2}:transparency`] as string;
    const detail = surveyWaveDetailSchema.parse(
      (await call(users.sro, 'GET', `/suppliers/${rel}/feedback/${waves.pulse2}`)).body,
    );
    expect(detail.results?.canCreateAction).toBe(true);
    expect(
      detail.results?.dimensions.find((entry) => entry.dimension === 'transparency')?.resultId,
    ).toBe(source);
    expect(
      (
        await call(
          users.sro,
          'POST',
          `/suppliers/${rel}/massnahmen`,
          action('Prognose teilen', 'shared', source),
        )
      ).status,
    ).toBe(201);
    const list = actionListSchema.parse(
      (await call(users.sro, 'GET', `/suppliers/${rel}/massnahmen`)).body,
    );
    expect(list.actions.find((entry) => entry.title === 'Prognose teilen')).toMatchObject({
      sourceType: 'feedback_gap',
      sourceId: source,
      sourceDimension: 'transparency',
    });
    const after = surveyWaveDetailSchema.parse(
      (await call(users.sro, 'GET', `/suppliers/${rel}/feedback/${waves.pulse2}`)).body,
    );
    expect(
      after.results?.actions.map((entry) => [entry.title, entry.dimension, entry.status]),
    ).toEqual([['Prognose teilen', 'transparency', 'open']]);
    // Eine fremde oder unpassende Quelle lehnt die API ab.
    expect(
      (
        await call(
          users.sro,
          'POST',
          `/suppliers/${rel}/massnahmen`,
          action('X', 'shared', randomUUID()),
        )
      ).status,
    ).toBe(400);
  });

  it('beide Seiten sehen denselben Abschnitt; interne Maßnahmen nur die eigene Seite', async () => {
    const source = resultIds[`${waves.pulse2}:trust`] as string;
    expect(
      (
        await call(
          users.sro,
          'POST',
          `/suppliers/${rel}/massnahmen`,
          action('Zweitquelle prüfen', 'internal', source),
        )
      ).status,
    ).toBe(201);
    const own = surveyWaveDetailSchema.parse(
      (await call(users.sro, 'GET', `/suppliers/${rel}/feedback/${waves.pulse2}`)).body,
    ).results;
    const theirs = surveyWaveDetailSchema.parse(
      (await call(users.kam, 'GET', `/kunden/${rel}/feedback/${waves.pulse2}`)).body,
    ).results;
    expect(own?.actions.map((entry) => entry.title).sort()).toEqual([
      'Prognose teilen',
      'Zweitquelle prüfen',
    ]);
    expect(theirs?.actions.map((entry) => entry.title)).toEqual(['Prognose teilen']);
    expect(theirs?.actions[0]?.own).toBe(false);
  });

  it('der Verlauf zeigt ab zwei Wellen die Werte und trennt Puls und Jahres-Feedback', async () => {
    for (const [user, base] of [
      [users.sro, `/suppliers/${rel}/feedback`],
      [users.kam, `/kunden/${rel}/feedback`],
    ] as const) {
      const list = surveyWavesSchema.parse((await call(user, 'GET', base)).body);
      expect(list.trends.map((trend) => trend.kind)).toEqual(['pulse']);
      const pulse = list.trends[0];
      expect(pulse?.waves.map((wave) => wave.id)).toEqual([waves.pulse1, waves.pulse2]);
      expect(pulse?.dimensions).toEqual([
        { dimension: 'trust', buyer: [4, 4.1], supplier: [3, 3.5] },
        { dimension: 'transparency', buyer: [4.2, 4.1], supplier: [3, 3.6] },
      ]);
    }
  });
});
