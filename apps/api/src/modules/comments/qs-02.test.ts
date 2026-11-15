import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import { actionListSchema, commentListSchema, startSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { renderEmail } from '../email/templates.js';

// Tests zu docs/specs/QS-02.md: Kommentare beider Seiten, interne bleiben intern, Erwähnungen nur
// für Personen, die Objekt und Kommentar sehen, Mail ohne Kommentartext, 24 Stunden bearbeiten,
// Entfernen bleibt im Verlauf.
describe('QS-02 Kommentare über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = {
    sro: `qs2-sro-${run}`,
    colleague: `qs2-kollege-${run}`,
    kam: `qs2-kam-${run}`,
    hidden: `qs2-intern-${run}`,
  };
  let actionId = '';
  let buyer = '';
  let supplier = '';
  const secret = `Vertraulich ${run}: Preisgrenze 12,10 €`;

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
  const list = async (user: string, url: string) => {
    const response = await call(user, 'GET', url);
    expect(response.status).toBe(200);
    return commentListSchema.parse(response.body);
  };
  const due = async (user: string) =>
    startSchema.parse((await call(user, 'GET', '/start')).body).due.items;

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `QS2-OEM ${run}` },
      { id: orgs.supplier, name: `QS2-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const person = (id: string, name: string, organizationId: string) => ({
      id,
      name,
      email: `${id}@example.com`,
      organizationId,
      orgRole: 'member' as const,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.sro, 'Sara Ost', orgs.oem),
        person(users.colleague, 'Kai Kollege', orgs.oem),
        person(users.kam, 'Kim Kaiser', orgs.supplier),
        person(users.hidden, 'Ina Intern', orgs.supplier),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db.insert(schema.relationshipMember).values([
      {
        relationshipId: rel,
        orgId: orgs.oem,
        userId: users.sro,
        teamRole: 'sro',
        visibility: 'shared',
        memberName: 'Sara Ost',
      },
      { relationshipId: rel, orgId: orgs.oem, userId: users.colleague, teamRole: 'member' },
      {
        relationshipId: rel,
        orgId: orgs.supplier,
        userId: users.kam,
        teamRole: 'sro',
        visibility: 'shared',
        memberName: 'Kim Kaiser',
      },
      // Intern beim Lieferanten: Der Käufer sieht die Person nicht und kann sie nicht erwähnen.
      { relationshipId: rel, orgId: orgs.supplier, userId: users.hidden, teamRole: 'member' },
    ]);
    const created = await call(users.sro, 'POST', `/suppliers/${rel}/massnahmen`, {
      action: {
        title: 'Zweitquelle Gehäuse',
        description: null,
        visibility: 'shared',
        ownerSide: 'buyer',
        ownerUserId: users.sro,
        ownerName: null,
        dueDate: '2099-01-31',
      },
      sourceType: 'manual',
      sourceId: null,
    });
    expect(created.status).toBe(201);
    const actions = actionListSchema.parse(
      (await call(users.sro, 'GET', `/suppliers/${rel}/massnahmen`)).body,
    );
    actionId = actions.actions[0]?.id ?? '';
    buyer = `/suppliers/${rel}/kommentare/action/${actionId}`;
    supplier = `/kunden/${rel}/kommentare/action/${actionId}`;
  });

  afterAll(async () => {
    await db.execute(
      sql`delete from outbox_event where object_type = 'comment_mention' and email_recipient like ${`qs2-%-${run}@example.com`}`,
    );
    await db.execute(sql`delete from action where relationship_id = ${rel}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('Interne Kommentare sind für den Lieferanten unsichtbar, in jeder Schnittstelle (PLT-04)', async () => {
    const internal = await call(users.sro, 'POST', buyer, {
      visibility: 'internal',
      body: secret,
      mentions: [users.colleague],
    });
    expect(internal.status).toBe(201);
    const own = await list(users.sro, buyer);
    expect(own.comments.map((comment) => comment.visibility)).toEqual(['internal']);

    // Lieferant: weder in der Liste noch auf Start noch im Verlauf der Beziehung.
    const theirs = await list(users.kam, supplier);
    expect(theirs.comments).toEqual([]);
    expect(JSON.stringify(await due(users.kam))).not.toContain(secret);
    const internalId = own.comments[0]?.id ?? '';
    const history = await call(
      users.kam,
      'GET',
      `/audit?object_type=comment_internal&object_id=${internalId}&relationship_id=${rel}`,
    );
    expect(JSON.stringify(history.body)).not.toContain(internalId);
    // Auch direkt in der Datenbank unter der Mandanten-Session des Lieferanten (RLS).
    const rows = await withTenant(
      db,
      { userId: users.kam, organizationId: orgs.supplier, customerOrganizationId: orgs.oem },
      (tx) => tx.select().from(schema.comment),
    );
    expect(rows.filter((row) => row.relationshipId === rel)).toEqual([]);
  });

  it('Bei internen Kommentaren lässt sich niemand von der anderen Seite erwähnen', async () => {
    const list1 = await list(users.sro, buyer);
    expect(list1.people.internal.map((person) => person.userId)).toEqual([users.colleague]);
    // Geteilt: zusätzlich geteilte Teammitglieder der anderen Seite, nie die internen.
    expect(list1.people.shared.map((person) => person.userId).sort()).toEqual(
      [users.colleague, users.kam].sort(),
    );
    const refused = await call(users.sro, 'POST', buyer, {
      visibility: 'internal',
      body: 'Bitte prüfen',
      mentions: [users.kam],
    });
    expect(refused).toMatchObject({ status: 400, body: { code: 'erwaehnung_nicht_erlaubt' } });
    const hidden = await call(users.sro, 'POST', buyer, {
      visibility: 'shared',
      body: 'Bitte prüfen',
      mentions: [users.hidden],
    });
    expect(hidden).toMatchObject({ status: 400, body: { code: 'erwaehnung_nicht_erlaubt' } });
    // Auch die Funktion selbst lehnt es ab, wenn jemand die API umgeht.
    const [comment] = await db
      .select({ id: schema.comment.id })
      .from(schema.comment)
      .where(
        sql`${schema.comment.relationshipId} = ${rel} and ${schema.comment.visibility} = 'internal'`,
      );
    await expect(
      withTenant(db, { userId: users.sro, organizationId: orgs.oem }, (tx) =>
        tx.execute(
          sql`select app_kommentar_erwaehnen(${comment?.id}::uuid, ${users.kam}, 'x', '/a', '/b')`,
        ),
      ),
    ).rejects.toThrow();
  });

  it('Die Mail an Erwähnte enthält keinen Kommentartext; die Erwähnung steht auf Start, bis sie geöffnet ist', async () => {
    const created = await call(users.sro, 'POST', buyer, {
      visibility: 'shared',
      body: `@Kim Kaiser ${secret}`,
      mentions: [users.kam],
    });
    expect(created.status).toBe(201);
    const [mail] = await db
      .select()
      .from(schema.outboxEvent)
      .where(
        sql`${schema.outboxEvent.emailTemplate} = 'mention' and ${schema.outboxEvent.emailRecipient} = ${`${users.kam}@example.com`}`,
      );
    expect(mail).toMatchObject({
      emailTitle: 'Zweitquelle Gehäuse',
      emailLink: `/kunden/${rel}/umsetzung/massnahmen/${actionId}`,
    });
    expect(JSON.stringify(mail)).not.toContain('Preisgrenze');
    const rendered = renderEmail(
      {
        template: 'mention',
        locale: 'de',
        title: mail?.emailTitle ?? '',
        link: mail?.emailLink ?? '',
      },
      'https://app.reziproq.test',
    );
    expect(JSON.stringify(rendered)).not.toContain('Preisgrenze');

    const before = await due(users.kam);
    expect(before.filter((item) => item.kind === 'mention')).toHaveLength(1);
    expect(before.find((item) => item.kind === 'mention')?.href).toBe(
      `/kunden/${rel}/umsetzung/massnahmen/${actionId}`,
    );
    const seen = await list(users.kam, supplier);
    expect(seen.comments.map((comment) => comment.body)).toEqual([`@Kim Kaiser ${secret}`]);
    expect(seen.comments[0]?.mentions.map((person) => person.name)).toEqual(['Kim Kaiser']);
    expect((await due(users.kam)).filter((item) => item.kind === 'mention')).toEqual([]);
  });

  it('Bearbeiten ist 24 Stunden möglich, danach nicht mehr', async () => {
    const created = await list(users.kam, supplier);
    const reply = await call(users.kam, 'POST', supplier, {
      visibility: 'shared',
      body: 'Liefern wir bis Freitag',
      mentions: [],
    });
    expect(reply.status).toBe(201);
    const mine = commentListSchema
      .parse(reply.body)
      .comments.find((comment) => comment.own && comment.body === 'Liefern wir bis Freitag');
    expect(created.comments.length + 1).toBe(commentListSchema.parse(reply.body).comments.length);
    expect(mine?.canEdit).toBe(true);
    const edited = await call(users.kam, 'PUT', `${supplier}/${mine?.id}`, {
      body: 'Liefern wir bis Donnerstag',
    });
    expect(edited.status).toBe(200);
    expect(
      commentListSchema.parse(edited.body).comments.find((comment) => comment.id === mine?.id),
    ).toMatchObject({ body: 'Liefern wir bis Donnerstag', editedAt: expect.any(String) });
    // Fremde Kommentare bearbeitet niemand.
    expect((await call(users.sro, 'PUT', `${buyer}/${mine?.id}`, { body: 'x' })).status).toBe(403);

    await db.execute(
      sql`update comment set created_at = now() - interval '25 hours' where id = ${mine?.id}`,
    );
    const late = await call(users.kam, 'PUT', `${supplier}/${mine?.id}`, { body: 'Zu spät' });
    expect(late).toMatchObject({ status: 403, body: { code: 'bearbeiten_abgelaufen' } });
    const after = await list(users.kam, supplier);
    expect(after.comments.find((comment) => comment.id === mine?.id)?.canEdit).toBe(false);
  });

  it('Gelöschte Kommentare zeigen „Kommentar entfernt“ und stehen im Verlauf', async () => {
    const current = await list(users.kam, supplier);
    const mine = current.comments.find((comment) => comment.own);
    const removed = await call(users.kam, 'DELETE', `${supplier}/${mine?.id}`);
    expect(removed.status).toBe(200);
    const after = commentListSchema.parse(removed.body).comments.find((c) => c.id === mine?.id);
    expect(after).toMatchObject({ body: null, deletedAt: expect.any(String), canDelete: false });
    // Der Käufer sieht ihn ebenfalls als entfernt.
    const forBuyer = (await list(users.sro, buyer)).comments.find((c) => c.id === mine?.id);
    expect(forBuyer?.body).toBeNull();
    const [row] = await db.select().from(schema.comment).where(sql`id = ${mine?.id}`);
    expect(row?.body).toBe('');
    const events = await db
      .select({ action: schema.auditEvent.action, changes: schema.auditEvent.changes })
      .from(schema.auditEvent)
      .where(
        sql`${schema.auditEvent.objectType} = 'comment' and ${schema.auditEvent.objectId} = ${mine?.id}`,
      );
    expect(events.map((event) => event.action)).toEqual(['created', 'updated', 'updated']);
    expect(JSON.stringify(events.at(-1)?.changes)).toContain('deleted_at');
  });
});
