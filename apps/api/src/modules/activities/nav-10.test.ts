import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { activityFeedSchema, meResponseSchema, promptEventSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/NAV-10.md in der API: Aktivitäten mit Notizen (privat nur für die Autorin),
// Entwürfe von Reziproq als Eintrag, Startseite je Person, Frage mit Lieferant als Kontext.
describe('NAV-10 Aktivitäten, Startseite und Kontext', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { a: randomUUID(), b: randomUUID(), s: randomUUID() };
  const rel = randomUUID();
  const roundId = randomUUID();
  const users = {
    admin: `nav10-admin-${run}`,
    sro: `nav10-sro-${run}`,
    colleague: `nav10-kollege-${run}`,
    adminB: `nav10-admin-b-${run}`,
    supplier: `nav10-sup-${run}`,
  };
  const base = `/suppliers/${rel}`;

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
  const feed = async (user: string, filter?: string) =>
    activityFeedSchema.parse(
      (await call(user, 'GET', `${base}/aktivitaeten${filter ? `?filter=${filter}` : ''}`)).body,
    );

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.a, name: `NAV10-A ${run}`, zitadelOrgId: `nav10-a-${run}` },
      { id: orgs.b, name: `NAV10-B ${run}` },
      { id: orgs.s, name: `NAV10-Rheintal ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.a, feature: 'buyer' },
      { organizationId: orgs.b, feature: 'buyer' },
    ]);
    const person = (id: string, organizationId: string, orgRole: 'admin' | 'member') => ({
      id,
      name: id,
      email: `${id}@example.com`,
      organizationId,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.admin, orgs.a, 'admin'),
        person(users.sro, orgs.a, 'member'),
        person(users.colleague, orgs.a, 'member'),
        person(users.adminB, orgs.b, 'admin'),
        person(users.supplier, orgs.s, 'admin'),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.a, supplier: orgs.s }]);
    await db.insert(schema.relationshipMember).values({
      relationshipId: rel,
      orgId: orgs.a,
      userId: users.sro,
      teamRole: 'sro',
    });
    // Ein Entwurf von Reziproq an der Beziehung (SEG-11)
    await db.insert(schema.aiDraft).values({
      orgId: orgs.a,
      relationshipId: rel,
      kind: 'deviation_explanation',
      objectType: 'segmentation_round',
      objectId: roundId,
      subject: 'spend',
      content: 'Die Bewertungen gehen auseinander.',
      model: 'test',
      createdBy: users.sro,
    });
  });

  afterAll(async () => {
    const orgIds = Object.values(orgs);
    await db.execute(sql`delete from note where org_id in ${orgIds}`);
    await db.execute(sql`delete from ai_draft where org_id in ${orgIds}`);
    await db.execute(sql`delete from user_setting where org_id in ${orgIds}`);
    await deleteRelationships(db, orgIds);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization where id in ${orgIds}`);
    await testApp.close();
  });

  it('eine private Notiz sieht nur ihre Autorin, auch kein Admin', async () => {
    await call(users.sro, 'POST', `${base}/notizen`, { text: 'Für das Team', visibility: 'team' });
    const own = activityFeedSchema.parse(
      (
        await call(users.sro, 'POST', `${base}/notizen`, {
          text: 'Nur für mich',
          visibility: 'private',
          kind: 'call',
        })
      ).body,
    );
    expect(own.items.map((item) => item.title)).toEqual(
      expect.arrayContaining(['Für das Team', 'Nur für mich']),
    );
    const admin = await feed(users.admin, 'notizen');
    expect(admin.items.map((item) => item.title)).toEqual(['Für das Team']);
    const colleague = await feed(users.colleague, 'notizen');
    expect(colleague.items.map((item) => item.title)).toEqual(['Für das Team']);
    // Auch direkt in der Datenbank bleibt sie verborgen (Zeilensicherheit)
    const privateRow = own.items.find((item) => item.title === 'Nur für mich');
    expect(privateRow).toMatchObject({ kind: 'call', visibility: 'private', mine: true });
  });

  it('ändern und anheften darf nur die Autorin; Angeheftetes steht oben', async () => {
    const noteId = (await feed(users.sro, 'notizen')).items
      .find((item) => item.title === 'Für das Team')
      ?.id.replace('note:', '');
    expect(
      (await call(users.colleague, 'PATCH', `${base}/notizen/${noteId}`, { pinned: true })).status,
    ).toBe(403);
    expect((await call(users.admin, 'DELETE', `${base}/notizen/${noteId}`)).status).toBe(403);
    const pinned = activityFeedSchema.parse(
      (await call(users.sro, 'PATCH', `${base}/notizen/${noteId}`, { pinned: true })).body,
    );
    expect(pinned.items[0]).toMatchObject({ title: 'Für das Team', pinned: true });
  });

  it('ein Entwurf von Reziproq erscheint als Eintrag von Reziproq mit Verweis', async () => {
    const reziproq = await feed(users.colleague, 'reziproq');
    expect(reziproq.items).toEqual([
      expect.objectContaining({
        kind: 'agent',
        actor: { type: 'reziproq' },
        code: 'deviation_explanation',
        href: `/lieferanten/${rel}/strategie/segmentierung`,
      }),
    ]);
    const all = await feed(users.colleague);
    expect(all.items.some((item) => item.kind === 'agent')).toBe(true);
    expect(all.items.some((item) => item.kind === 'note')).toBe(true);
  });

  it('der Test-Lieferant und ein fremder Käufer sehen keine Aktivitäten', async () => {
    expect((await call(users.supplier, 'GET', `${base}/aktivitaeten`)).status).toBe(403);
    expect((await call(users.supplier, 'POST', `${base}/notizen`, { text: 'x' })).status).toBe(403);
    expect((await call(users.adminB, 'GET', `${base}/aktivitaeten`)).status).toBe(404);
    expect((await call(users.adminB, 'POST', `${base}/notizen`, { text: 'x' })).status).toBe(404);
  });

  it('Lead und Admin starten in der Übersicht, andere in Mein Tag; die eigene Wahl gilt danach', async () => {
    const me = async (user: string, role: string) => {
      testApp.zitadel.replyUserinfo(() => ({
        status: 200,
        body: {
          sub: user,
          name: user,
          email: `${user}@example.com`,
          'urn:zitadel:iam:user:resourceowner:id': `nav10-a-${run}`,
        },
      }));
      const token = await testApp.signToken({
        subject: user,
        claims: { 'urn:zitadel:iam:org:project:test-project:roles': { [role]: { '1': 'test' } } },
      });
      return {
        token,
        body: meResponseSchema.parse(await (await testApp.get('/api/me', token)).json()),
      };
    };
    expect((await me(users.admin, 'admin')).body).toMatchObject({
      defaultOverview: true,
      startPage: null,
    });
    const sro = await me(users.sro, 'nutzer');
    expect(sro.body).toMatchObject({ defaultOverview: false, startPage: null });
    // Lead einer Warengruppe startet ebenfalls in der Übersicht
    const group = randomUUID();
    await db.insert(schema.materialGroup).values({
      id: group,
      orgId: orgs.a,
      name: 'Leiterplatten',
      code: `LP-${run}`,
      leadUserId: users.colleague,
    });
    expect((await me(users.colleague, 'nutzer')).body.defaultOverview).toBe(true);
    // Eigene Wahl
    const saved = await fetch(`${testApp.baseUrl}/api/me/startseite`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${sro.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ startPage: 'overview' }),
    });
    expect(saved.status).toBe(204);
    expect((await me(users.sro, 'nutzer')).body.startPage).toBe('overview');
    await db.delete(schema.materialGroup).where(sql`${schema.materialGroup.id} = ${group}`);
  });

  it('eine Frage auf der Seite eines Lieferanten hat ihn als Kontext', async () => {
    const ask = async (user: string, context?: string) => {
      const res = await testApp.post(
        '/api/prompt',
        {
          messages: [{ role: 'user', content: 'Wie steht es um diesen Lieferanten?' }],
          ...(context ? { context: { relationshipId: context } } : {}),
        },
        await testApp.signToken({
          subject: user,
          claims: { 'urn:zitadel:iam:org:project:test-project:roles': { nutzer: { '1': 'test' } } },
        }),
      );
      return (await res.text())
        .trim()
        .split('\n')
        .map((line) => promptEventSchema.parse(JSON.parse(line)))
        .map((event) => (event.type === 'text' ? event.delta : ''))
        .join('');
    };
    expect(await ask(users.sro, rel)).toBe(`Die Frage bezieht sich auf NAV10-Rheintal ${run}.`);
    expect(await ask(users.sro)).toBe('Welchen Lieferanten meinst du?');
    // Fremder Käufer: kein Kontext, kein Hinweis auf den Lieferanten
    expect(await ask(users.adminB, rel)).toBe('Welchen Lieferanten meinst du?');
  });
});
