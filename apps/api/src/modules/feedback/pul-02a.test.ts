import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { surveyWaveDetailSchema, surveyWavesSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { hashSurveyToken } from './waves.service.js';

// Tests zu docs/specs/PUL-02.md, Teil a: Welle starten mit Teilnehmenden beider Seiten, je Person
// ein eigener Link (nur der Hash gespeichert); jede Seite sieht nur ihre Einladungen, der Rücklauf
// ist eine Anzahl je Seite; der Lieferant lädt eigene ein und schließt seine Seite ab.
describe('PUL-02a Feedback-Welle anlegen und einladen', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = {
    sro: `pul02-sro-${run}`,
    member: `pul02-member-${run}`,
    kam: `pul02-kam-${run}`,
  };
  const buyer = `/suppliers/${rel}/feedback`;
  const supplier = `/kunden/${rel}/feedback`;
  let waveId = '';

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
  const person = (side: 'buyer' | 'supplier', index: number) => ({
    email: `pul02-${side}-${index}-${run}@example.com`,
    name: `Person ${index}`,
    function: index % 2 ? 'quality' : 'purchasing',
    side,
  });
  const due = '2099-03-31';

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `PUL2-OEM ${run}` },
      { id: orgs.supplier, name: `PUL2-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const user = (
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
        user(users.sro, 'Sara Ost', orgs.oem, 'member'),
        user(users.member, 'Max Mitglied', orgs.oem, 'member'),
        user(users.kam, 'Kim Kaiser', orgs.supplier, 'admin'),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' },
      { relationshipId: rel, orgId: orgs.oem, userId: users.member, teamRole: 'member' },
    ]);
  });

  afterAll(async () => {
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from survey_template where org_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('der SRO startet eine Welle für zehn Teilnehmende beider Seiten; jede Person bekommt ihren Link', async () => {
    const participants = [1, 2, 3, 4, 5].flatMap((index) => [
      person('buyer', index),
      person('supplier', index),
    ]);
    const body = { kind: 'pulse', dueDate: due, participants };
    // Ein Teammitglied ohne SRO-Rolle darf nicht starten.
    expect((await call(users.member, 'POST', buyer, body)).status).toBe(403);
    const started = await call(users.sro, 'POST', buyer, body);
    expect(started.status).toBe(201);
    const detail = surveyWaveDetailSchema.parse(started.body);
    waveId = detail.wave.id;
    expect(detail.wave).toMatchObject({
      kind: 'pulse',
      templateVersion: 1,
      dueDate: due,
      status: 'open',
      turnout: { buyer: { invited: 5, completed: 0 }, supplier: { invited: 5, completed: 0 } },
    });
    expect(detail.participants).toHaveLength(10);
    const mails = await db.execute<{ recipient: string; link: string; title: string }>(sql`
      select email_recipient as recipient, email_link as link, email_title as title
      from outbox_event where email_template = 'survey' and email_recipient like ${`%-${run}@example.com`}
    `);
    expect(mails.rows).toHaveLength(10);
    const links = new Set(mails.rows.map((row) => row.link));
    expect(links.size).toBe(10);
    // Gespeichert ist nur der Hash; der Token steht nur im Link der Mail.
    const [first] = mails.rows;
    const token = first?.link.replace('/umfrage/', '') ?? '';
    const stored = await db.execute<{ token_hash: string }>(
      sql`select token_hash from survey_participant where email = ${first?.recipient}`,
    );
    expect(stored.rows[0]?.token_hash).toBe(hashSurveyToken(token));
    expect(stored.rows[0]?.token_hash).not.toContain(token);
    expect(first?.title).toBe(`PUL2-OEM ${run} · PUL2-Lieferant ${run}`);
  });

  it('je Art nur eine offene Welle; die Frist liegt nicht in der Vergangenheit', async () => {
    const body = { kind: 'pulse', dueDate: due, participants: [person('buyer', 9)] };
    expect((await call(users.sro, 'POST', buyer, body)).status).toBe(409);
    expect(
      (await call(users.sro, 'POST', buyer, { ...body, kind: 'annual', dueDate: '2020-01-01' }))
        .status,
    ).toBe(400);
  });

  it('jede Seite sieht nur ihre Einladungen; der Rücklauf je Seite ist nur eine Anzahl', async () => {
    const list = surveyWavesSchema.parse((await call(users.kam, 'GET', supplier)).body);
    expect(list.canStart).toBe(false);
    expect(list.waves[0]?.turnout).toEqual({
      buyer: { invited: 5, completed: 0 },
      supplier: { invited: 5, completed: 0 },
    });
    // Die Liste nennt keine Personen, nur Anzahlen.
    expect(JSON.stringify(list)).not.toContain('@example.com');
    const seen = surveyWaveDetailSchema.parse(
      (await call(users.kam, 'GET', `${supplier}/${waveId}`)).body,
    );
    expect(seen.participants).toEqual([]);
    expect(seen.ownSide).toBe('supplier');
    // Der Lieferant lädt eine eigene Person ein, nur auf seiner Seite.
    expect(
      (
        await call(users.kam, 'POST', `${supplier}/${waveId}/teilnehmende`, {
          participants: [{ ...person('buyer', 7) }],
        })
      ).status,
    ).toBe(403);
    const invited = surveyWaveDetailSchema.parse(
      (
        await call(users.kam, 'POST', `${supplier}/${waveId}/teilnehmende`, {
          participants: [person('supplier', 7)],
        })
      ).body,
    );
    expect(invited.participants.map((entry) => entry.email)).toEqual([person('supplier', 7).email]);
    const buyerView = surveyWaveDetailSchema.parse(
      (await call(users.sro, 'GET', `${buyer}/${waveId}`)).body,
    );
    expect(buyerView.participants).toHaveLength(10);
    expect(buyerView.participants.map((entry) => entry.email)).not.toContain(
      person('supplier', 7).email,
    );
    expect(buyerView.wave.turnout.supplier).toEqual({ invited: 6, completed: 0 });
    // Doppelt einladen geht nicht.
    expect(
      (
        await call(users.sro, 'POST', `${buyer}/${waveId}/teilnehmende`, {
          participants: [person('buyer', 1)],
        })
      ).status,
    ).toBe(409);
  });

  it('der SRO verlängert die Frist; jede Seite schließt ihre Teilnahme selbst ab', async () => {
    expect(
      (await call(users.kam, 'PUT', `${supplier}/${waveId}/frist`, { dueDate: '2099-04-30' }))
        .status,
    ).toBe(404);
    const extended = surveyWaveDetailSchema.parse(
      (await call(users.sro, 'PUT', `${buyer}/${waveId}/frist`, { dueDate: '2099-04-30' })).body,
    );
    expect(extended.wave.dueDate).toBe('2099-04-30');
    const closed = surveyWaveDetailSchema.parse(
      (await call(users.kam, 'POST', `${supplier}/${waveId}/abschliessen`)).body,
    );
    expect(closed.wave.supplierClosedAt).not.toBeNull();
    expect(closed.wave.buyerClosedAt).toBeNull();
    expect(closed).toMatchObject({ canInvite: false, canClose: false });
    expect((await call(users.kam, 'POST', `${supplier}/${waveId}/abschliessen`)).status).toBe(409);
    expect(
      (
        await call(users.kam, 'POST', `${supplier}/${waveId}/teilnehmende`, {
          participants: [person('supplier', 8)],
        })
      ).status,
    ).toBe(409);
    // Die Käuferseite ist weiter offen; nach ihrem Abschluss ist die Welle geschlossen.
    const buyerClosed = surveyWaveDetailSchema.parse(
      (await call(users.sro, 'POST', `${buyer}/${waveId}/abschliessen`)).body,
    );
    expect(buyerClosed.wave.status).toBe('closed');
    const history = await db.execute<{ object_type: string }>(
      sql`select object_type from audit_event where relationship_id = ${rel} and object_type = 'survey_wave'`,
    );
    expect(history.rows.length).toBeGreaterThanOrEqual(4);
  });
});
