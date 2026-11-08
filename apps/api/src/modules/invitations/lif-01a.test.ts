import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  acceptInvitationResponseSchema,
  invitationListSchema,
  publicInvitationSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { hashToken } from './invitations.service.js';

// Tests zu docs/specs/LIF-01.md, Teil a: Einladung und Annahme mit nachgebautem Zitadel.
// Alles läuft ohne Internet: Die App nutzt außerhalb des Betriebs FakeIdentityProvisioner.
describe('LIF-01a Lieferanten einladen über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), zweit: randomUUID(), supplier: randomUUID() };
  const rel = { oem: randomUUID(), zweit: randomUUID(), ended: randomUUID() };
  const endedSupplier = randomUUID();
  const users = {
    admin: `lif-admin-${run}`,
    sro: `lif-sro-${run}`,
    member: `lif-member-${run}`,
    viewer: `lif-viewer-${run}`,
    zweit: `lif-zweit-${run}`,
  };
  const kim = `kim-${run}@lieferant.example`;

  const call = async (user: string | null, method: string, path: string, body?: unknown) => {
    const headers: Record<string, string> = body ? { 'content-type': 'application/json' } : {};
    if (user) headers.authorization = `Bearer ${await testApp.signToken({ subject: user })}`;
    const response = await fetch(`${testApp.baseUrl}/api${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  };

  /** Der Token steht nur im Link der Mail in der Outbox, nie in der Tabelle invitation. */
  const tokenFor = async (email: string) => {
    const result = await db.execute<{ link: string }>(sql`
      select email_link as link from outbox_event
      where email_template = 'supplier_invitation' and email_recipient = ${email}
      order by occurred_at desc limit 1
    `);
    const link = result.rows[0]?.link ?? '';
    return link.replace('/einladung/', '');
  };

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `LIF-OEM ${run}` },
      { id: orgs.zweit, name: `LIF-Zweit ${run}` },
      { id: orgs.supplier, name: `LIF-Lieferant ${run}` },
      { id: endedSupplier, name: `LIF-Beendet ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.oem, feature: 'buyer' },
      { organizationId: orgs.zweit, feature: 'buyer' },
    ]);
    const person = (
      id: string,
      orgRole: 'admin' | 'member' | 'viewer',
      organizationId: string,
    ) => ({
      id,
      name: id === users.sro ? 'Sara Ost' : `Person ${id}`,
      email: `${id}@example.com`,
      organizationId,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.admin, 'admin', orgs.oem),
        person(users.sro, 'member', orgs.oem),
        person(users.member, 'member', orgs.oem),
        person(users.viewer, 'viewer', orgs.oem),
        person(users.zweit, 'admin', orgs.zweit),
      ]);
    await insertRelationships(db, [
      { id: rel.oem, buyer: orgs.oem, supplier: orgs.supplier, status: 'draft' },
      { id: rel.zweit, buyer: orgs.zweit, supplier: orgs.supplier, status: 'draft' },
      { id: rel.ended, buyer: orgs.oem, supplier: endedSupplier, status: 'ended' },
    ]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel.oem, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' },
      { relationshipId: rel.oem, orgId: orgs.oem, userId: users.member, teamRole: 'member' },
    ]);
    await db.insert(schema.supplierContact).values([
      { relationshipId: rel.oem, name: 'Kim Kaiser', email: kim },
      { relationshipId: rel.oem, name: 'Ole Ost', email: `ole-${run}@lieferant.example` },
    ]);
  });

  afterAll(async () => {
    const all = Object.values(rel);
    await db.execute(sql`delete from invitation where relationship_id in ${all}`);
    await db.execute(sql`delete from supplier_contact where relationship_id in ${all}`);
    await deleteRelationships(db, [...Object.values(orgs), endedSupplier]);
    await db.execute(
      sql`delete from app_user where organization_id in ${[...Object.values(orgs), endedSupplier]}`,
    );
    await db.execute(
      sql`delete from organization_feature where organization_id in ${Object.values(orgs)}`,
    );
    await db.execute(
      sql`delete from organization where id in ${[...Object.values(orgs), endedSupplier]}`,
    );
    await testApp.close();
  });

  it('der SRO sieht Vorschläge aus den Kontakten und darf einladen', async () => {
    const { status, body } = await call(users.sro, 'GET', `/suppliers/${rel.oem}/einladungen`);
    expect(status).toBe(200);
    const list = invitationListSchema.parse(body);
    expect(list.canInvite).toBe(true);
    expect(list.invitations).toEqual([]);
    expect(list.suggestions.map((entry) => entry.email)).toContain(kim);
  });

  it('die Mail nennt Kunde und SRO und enthält den Link; gespeichert ist nur der Hash', async () => {
    const { status, body } = await call(users.sro, 'POST', `/suppliers/${rel.oem}/einladungen`, {
      email: kim,
      message: 'Hallo Kim,\nbis gleich.',
    });
    expect(status).toBe(201);
    const list = invitationListSchema.parse(body);
    expect(list.invitations).toMatchObject([{ email: kim, status: 'open', invitedBy: 'Sara Ost' }]);
    expect(list.suggestions.map((entry) => entry.email)).not.toContain(kim);

    const mail = await db.execute<Record<string, string>>(sql`
      select email_title, email_sender, email_message, email_link, email_deadline from outbox_event
      where email_template = 'supplier_invitation' and email_recipient = ${kim}
    `);
    expect(mail.rows).toHaveLength(1);
    expect(mail.rows[0]).toMatchObject({
      email_title: `LIF-OEM ${run}`,
      email_sender: 'Sara Ost',
      email_message: 'Hallo Kim,\nbis gleich.',
    });
    const token = await tokenFor(kim);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = await db.execute<{ token_hash: string; expires_in_days: number }>(sql`
      select token_hash, round(extract(epoch from expires_at - created_at) / 86400)::int as expires_in_days
      from invitation where relationship_id = ${rel.oem}
    `);
    expect(stored.rows[0]).toEqual({ token_hash: hashToken(token), expires_in_days: 7 });
    expect(JSON.stringify(stored.rows)).not.toContain(token);
  });

  it('dieselbe Adresse lässt sich nicht zweimal offen einladen', async () => {
    const { status } = await call(users.admin, 'POST', `/suppliers/${rel.oem}/einladungen`, {
      email: kim.toUpperCase(),
    });
    expect(status).toBe(409);
  });

  it('nur Admin und SRO laden ein; Mitglied, Leser und fremde Käufer nicht', async () => {
    const body = { email: `x-${run}@lieferant.example` };
    expect(
      (await call(users.member, 'POST', `/suppliers/${rel.oem}/einladungen`, body)).status,
    ).toBe(403);
    expect(
      (await call(users.viewer, 'POST', `/suppliers/${rel.oem}/einladungen`, body)).status,
    ).toBe(403);
    expect(
      (await call(users.zweit, 'POST', `/suppliers/${rel.oem}/einladungen`, body)).status,
    ).toBe(404);
    const memberView = invitationListSchema.parse(
      (await call(users.member, 'GET', `/suppliers/${rel.oem}/einladungen`)).body,
    );
    expect(memberView.canInvite).toBe(false);
    expect(memberView.suggestions).toEqual([]);
  });

  it('eine beendete Beziehung nimmt keine Einladung an', async () => {
    const { status } = await call(users.admin, 'POST', `/suppliers/${rel.ended}/einladungen`, {
      email: `y-${run}@lieferant.example`,
    });
    expect(status).toBe(409);
  });

  it('ohne Login zeigt der Link Kunde, SRO und Lieferant; ein unbekannter Link 404', async () => {
    const token = await tokenFor(kim);
    const { status, body } = await call(null, 'GET', `/einladungen/${token}`);
    expect(status).toBe(200);
    expect(publicInvitationSchema.parse(body)).toEqual({
      status: 'open',
      customer: `LIF-OEM ${run}`,
      sro: 'Sara Ost',
      supplier: `LIF-Lieferant ${run}`,
      kamTaken: false,
    });
    expect((await call(null, 'GET', `/einladungen/${'x'.repeat(43)}`)).status).toBe(404);
    expect((await call(null, 'GET', '/einladungen/zu-kurz')).status).toBe(404);
  });

  it('die eingeladene Person gibt nur Name und Rolle ein', async () => {
    const token = await tokenFor(kim);
    const extra = await call(null, 'POST', `/einladungen/${token}/annahme`, {
      name: 'Kim Kaiser',
      teamRole: 'sro',
      email: 'andere@example.com',
    });
    expect(extra.status).toBe(400);
    const noName = await call(null, 'POST', `/einladungen/${token}/annahme`, { teamRole: 'sro' });
    expect(noName.status).toBe(400);
  });

  it('die erste Annahme legt die Zitadel-Organisation an, verknüpft sie und setzt die Beziehung auf active', async () => {
    const token = await tokenFor(kim);
    const { status, body } = await call(null, 'POST', `/einladungen/${token}/annahme`, {
      name: 'Kim Kaiser',
      teamRole: 'sro',
      locale: 'en',
    });
    expect(status).toBe(200);
    expect(acceptInvitationResponseSchema.parse(body)).toEqual({ next: '/start' });

    const org = await db.execute<{ zitadel_org_id: string }>(
      sql`select zitadel_org_id from organization where id = ${orgs.supplier}`,
    );
    expect(org.rows[0]?.zitadel_org_id).toBe(`fake-org-${orgs.supplier}`);
    const person = await db.execute<Record<string, unknown>>(sql`
      select name, email, org_role, locale from app_user where organization_id = ${orgs.supplier}
    `);
    expect(person.rows).toEqual([
      { name: 'Kim Kaiser', email: kim, org_role: 'admin', locale: 'en' },
    ]);
    const relationship = await db.execute<{ status: string }>(
      sql`select status from relationship where id = ${rel.oem}`,
    );
    expect(relationship.rows[0]?.status).toBe('active');

    // Auf der Team-Seite des Käufers steht die Einladung jetzt als angenommen („aktiv“).
    const list = invitationListSchema.parse(
      (await call(users.sro, 'GET', `/suppliers/${rel.oem}/einladungen`)).body,
    );
    expect(list.invitations[0]?.status).toBe('accepted');
  });

  it('ein schon benutzter Link zeigt einen klaren Hinweis', async () => {
    const token = await tokenFor(kim);
    const preview = publicInvitationSchema.parse(
      (await call(null, 'GET', `/einladungen/${token}`)).body,
    );
    expect(preview.status).toBe('used');
    const again = await call(null, 'POST', `/einladungen/${token}/annahme`, {
      name: 'Kim Kaiser',
      teamRole: 'member',
    });
    expect(again.status).toBe(410);
    expect(again.body).toMatchObject({ code: 'invitation_unavailable' });
  });

  it('ein abgelaufener Link zeigt einen klaren Hinweis', async () => {
    const email = `ole-${run}@lieferant.example`;
    await call(users.admin, 'POST', `/suppliers/${rel.oem}/einladungen`, { email });
    const token = await tokenFor(email);
    await db.execute(sql`
      update invitation set expires_at = now() - interval '1 minute'
      where token_hash = ${hashToken(token)}
    `);
    const preview = publicInvitationSchema.parse(
      (await call(null, 'GET', `/einladungen/${token}`)).body,
    );
    expect(preview.status).toBe('expired');
    const accept = await call(null, 'POST', `/einladungen/${token}/annahme`, {
      name: 'Ole Ost',
      teamRole: 'member',
    });
    expect(accept.status).toBe(410);
  });

  it('eine zurückgezogene Einladung lässt sich nicht mehr annehmen', async () => {
    const email = `pia-${run}@lieferant.example`;
    const created = invitationListSchema.parse(
      (await call(users.sro, 'POST', `/suppliers/${rel.oem}/einladungen`, { email })).body,
    );
    const open = created.invitations.find((entry) => entry.email === email);
    const revoked = await call(
      users.sro,
      'POST',
      `/suppliers/${rel.oem}/einladungen/${open?.id}/zurueckziehen`,
    );
    expect(revoked.status).toBe(200);
    expect(
      invitationListSchema.parse(revoked.body).invitations.find((entry) => entry.email === email)
        ?.status,
    ).toBe('revoked');
    const token = await tokenFor(email);
    const preview = publicInvitationSchema.parse(
      (await call(null, 'GET', `/einladungen/${token}`)).body,
    );
    expect(preview.status).toBe('revoked');
    expect(
      (await call(users.sro, 'POST', `/suppliers/${rel.oem}/einladungen/${open?.id}/zurueckziehen`))
        .status,
    ).toBe(409);
  });

  it('ein Lieferant mit zwei Kunden hat danach eine Organisation und zwei aktive Beziehungen', async () => {
    await call(users.zweit, 'POST', `/suppliers/${rel.zweit}/einladungen`, { email: kim });
    const token = await tokenFor(kim);
    const preview = publicInvitationSchema.parse(
      (await call(null, 'GET', `/einladungen/${token}`)).body,
    );
    expect(preview).toMatchObject({ status: 'open', customer: `LIF-Zweit ${run}`, sro: null });
    const { status } = await call(null, 'POST', `/einladungen/${token}/annahme`, {
      name: 'Kim Kaiser',
      teamRole: 'sro',
    });
    expect(status).toBe(200);
    const orgsWithZitadel = await db.execute<{ n: number }>(sql`
      select count(*)::int as n from organization where zitadel_org_id = ${`fake-org-${orgs.supplier}`}
    `);
    expect(orgsWithZitadel.rows[0]?.n).toBe(1);
    const statuses = await db.execute<{ status: string }>(sql`
      select status from relationship where supplier_org_id = ${orgs.supplier}
    `);
    expect(statuses.rows.map((row) => row.status)).toEqual(['active', 'active']);
    const people = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from app_user where organization_id = ${orgs.supplier}`,
    );
    expect(people.rows[0]?.n).toBe(1);
  });

  it('der Lieferant selbst sieht die Einladungen des Käufers nicht', async () => {
    const kimId = await db.execute<{ id: string }>(
      sql`select id from app_user where organization_id = ${orgs.supplier}`,
    );
    const supplierUser = kimId.rows[0]?.id ?? '';
    const { status } = await call(supplierUser, 'GET', `/suppliers/${rel.oem}/einladungen`);
    expect(status).toBe(403);
  });
});
