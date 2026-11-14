import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import { publicSurveySchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/PUL-02.md, Teil b: Beantworten ohne Anmeldung über den persönlichen Link,
// genau einmal und nur bis zur Frist; kein Antwortbogen lässt sich einer Person zuordnen; Antworten
// einer Seite sind für die andere unsichtbar (PLT-04).
describe('PUL-02b Beantworten ohne Anmeldung', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const sro = `pul02b-sro-${run}`;
  const mail = (name: string) => `pul02b-${name}-${run}@example.com`;
  const tokens: Record<string, string> = {};
  let waveId = '';
  const all = (current: number | null, target: number | null) => ({
    pulse_satisfaction: { current, target },
    pulse_trust: { current, target },
    pulse_alignment: { current, target },
  });

  const open = async (method: string, token: string, body?: unknown) => {
    const response = await fetch(`${testApp.baseUrl}/api/umfrage/${token}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  };

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `PUL2B-OEM ${run}` },
      { id: orgs.supplier, name: `PUL2B-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    await db.insert(schema.appUser).values({
      id: sro,
      name: 'Sara Ost',
      email: `${sro}@example.com`,
      organizationId: orgs.oem,
      orgRole: 'member',
      rolesImportedAt: new Date(),
    });
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db
      .insert(schema.relationshipMember)
      .values({ relationshipId: rel, orgId: orgs.oem, userId: sro, teamRole: 'sro' });
    const response = await fetch(`${testApp.baseUrl}/api/suppliers/${rel}/feedback`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: sro })}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        kind: 'pulse',
        dueDate: '2099-03-31',
        participants: [
          { side: 'buyer', email: mail('ada'), name: null, function: 'purchasing' },
          { side: 'supplier', email: mail('kim'), name: null, function: 'sales' },
          { side: 'supplier', email: mail('lea'), name: null, function: 'quality' },
        ],
      }),
    });
    waveId = ((await response.json()) as { wave: { id: string } }).wave.id;
    const links = await db.execute<{ recipient: string; link: string }>(sql`
      select email_recipient as recipient, email_link as link from outbox_event
      where email_template = 'survey' and email_recipient like ${`%-${run}@example.com`}
    `);
    for (const row of links.rows) {
      tokens[row.recipient.split('-')[1] as string] = row.link.replace('/umfrage/', '');
    }
  });

  afterAll(async () => {
    await db.execute(sql`delete from survey_response where relationship_id = ${rel}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from survey_template where org_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('der Link öffnet den Fragebogen ohne Anmeldung, mit den aktiven Fragen der Version', async () => {
    const survey = publicSurveySchema.parse((await open('GET', tokens.kim as string)).body);
    expect(survey).toMatchObject({
      status: 'open',
      kind: 'pulse',
      side: 'supplier',
      buyer: `PUL2B-OEM ${run}`,
      supplier: `PUL2B-Lieferant ${run}`,
    });
    expect(survey.questions.map((question) => question.key)).toEqual([
      'pulse_satisfaction',
      'pulse_trust',
      'pulse_alignment',
    ]);
    expect((await open('GET', 'x'.repeat(43))).status).toBe(404);
    expect((await open('GET', 'kurz')).status).toBe(404);
  });

  it('ein Link funktioniert genau einmal zum Absenden', async () => {
    const token = tokens.kim as string;
    // Jede Frage braucht Ist und Soll; null heißt „Kann ich nicht beurteilen“.
    const { pulse_alignment: _, ...missing } = all(4, 5);
    expect((await open('POST', token, { answers: missing, comment: null })).status).toBe(400);
    expect((await open('POST', token, { answers: all(6, 5), comment: null })).status).toBe(400);
    const sent = await open('POST', token, {
      answers: { ...all(3, 5), pulse_trust: { current: null, target: 4 } },
      comment: 'Mehr Planungsdaten wären gut.',
    });
    expect(sent.status).toBe(200);
    expect(publicSurveySchema.parse(sent.body)).toMatchObject({ status: 'used', questions: [] });
    expect((await open('POST', token, { answers: all(1, 1), comment: null })).status).toBe(409);
    const count = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from survey_response where wave_id = ${waveId}`,
    );
    expect(count.rows[0]?.n).toBe(1);
  });

  it('kein Antwortbogen lässt sich einer Person zuordnen (Schema)', async () => {
    const columns = await db.execute<{ column_name: string; data_type: string; default: string }>(
      sql`select column_name, data_type, column_default as default
          from information_schema.columns where table_name = 'survey_response' order by column_name`,
    );
    expect(columns.rows.map((row) => row.column_name)).toEqual([
      'answers',
      'comment',
      'function',
      'id',
      'org_id',
      'relationship_id',
      'side',
      'wave_id',
    ]);
    // Keine Zeit, die sich mit completed_at verbinden ließe; die ID ist zufällig (v4).
    expect(columns.rows.filter((row) => row.data_type.startsWith('timestamp'))).toEqual([]);
    expect(columns.rows.find((row) => row.column_name === 'id')?.default).toBe('gen_random_uuid()');
    const references = await db.execute<{ target: string }>(sql`
      select confrelid::regclass::text as target from pg_constraint
      where conrelid = 'survey_response'::regclass and contype = 'f' order by 1
    `);
    expect(references.rows.map((row) => row.target)).toEqual([
      'organization',
      'relationship',
      'survey_wave',
    ]);
  });

  it('Antworten einer Seite sind für die andere Seite unsichtbar', async () => {
    await open('POST', tokens.ada as string, { answers: all(4, 5), comment: null });
    const seen = (session: Parameters<typeof withTenant>[1]) =>
      withTenant(db, session, async (tx) =>
        (
          await tx.execute<{ side: string }>(
            sql`select side from survey_response where wave_id = ${waveId} order by side`,
          )
        ).rows.map((row) => row.side),
      );
    expect(await seen({ userId: sro, organizationId: orgs.oem })).toEqual(['buyer']);
    expect(
      await seen({
        userId: 'pul02b-kam',
        organizationId: orgs.supplier,
        customerOrganizationId: orgs.oem,
      }),
    ).toEqual(['supplier']);
    // Auch der Käufer kann keinen Bogen ändern oder selbst anlegen.
    const write = await withTenant(db, { userId: sro, organizationId: orgs.oem }, (tx) =>
      tx.execute(sql`update survey_response set comment = 'x' where wave_id = ${waveId}`),
    ).catch((error: unknown) => error);
    expect(write).toBeInstanceOf(Error);
  });

  it('nach der Frist oder nach dem Abschluss der eigenen Seite gilt der Link nicht mehr', async () => {
    const token = tokens.lea as string;
    await db.execute(sql`update survey_wave set due_date = current_date - 1 where id = ${waveId}`);
    expect(publicSurveySchema.parse((await open('GET', token)).body).status).toBe('expired');
    expect((await open('POST', token, { answers: all(3, 4), comment: null })).status).toBe(410);
    await db.execute(
      sql`update survey_wave set due_date = current_date, supplier_closed_at = now() where id = ${waveId}`,
    );
    expect((await open('POST', token, { answers: all(3, 4), comment: null })).status).toBe(410);
    await db.execute(sql`update survey_wave set supplier_closed_at = null where id = ${waveId}`);
    // Am Tag der Frist geht es noch.
    expect((await open('POST', token, { answers: all(3, 4), comment: null })).status).toBe(200);
  });
});
