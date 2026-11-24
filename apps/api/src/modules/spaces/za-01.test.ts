import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, type TenantSession, withTenant } from '@reziproq/db';
import { dataExportListSchema, searchResultsSchema } from '@reziproq/shared';
import { strFromU8, unzipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { ActivitiesService } from '../activities/activities.service.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { DataExportService } from '../data-export/data-export.service.js';
import { invokePromptTool } from '../prompt/tools.js';
import { SuppliersService } from '../suppliers/suppliers.service.js';
import { issueConfirmToken, shareOrDraft } from './share-guard.js';

// ZA-01 Datenräume (Paket K1-a) über die API: Suche, Frag und Export liefern nicht mehr als die
// direkte Abfrage derselben Person (T1-ZA3); ein Lauf bringt ohne Token nichts in die Mitte und
// legt dafür einen Entwurf an (T1-ZA4).

/** Einfacher CSV-Leser: Kommas, Anführungszeichen, Zeilenumbrüche in Feldern */
function csvTitles(text: string): string[] {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else if (char !== '\r') field += char;
  }
  const [header = [], ...rows] = records;
  const column = header.indexOf('title');
  return rows.map((row) => row[column] ?? '');
}

describe('ZA-01 Datenräume über Suche, Frag, Export und den Wechsel in die Mitte', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { buyer: randomUUID(), supplier: randomUUID() };
  const relationship = randomUUID();
  const users = {
    admin: `za01-admin-${run}`,
    member: `za01-member-${run}`,
    supplier: `za01-lieferant-${run}`,
  };
  const supplierName = `ZA01-Lieferant ${run}`;
  const probe = `Raumprobe${run}`;
  const titles = {
    buyerPrivate: `${probe} intern Käufer`,
    shared: `${probe} geteilt`,
    supplierPrivate: `${probe} intern Lieferant`,
  };

  const buyerSession: TenantSession = { userId: users.admin, organizationId: orgs.buyer };
  const supplierSession: TenantSession = {
    userId: users.supplier,
    organizationId: orgs.supplier,
    customerOrganizationId: orgs.buyer,
  };

  /** Direkte Abfrage derselben Person: Titel der Probe-Maßnahmen, die sie sieht */
  const direct = (session: TenantSession) =>
    withTenant(db, session, async (tx) => {
      const result = await tx.execute<{ title: string }>(
        sql`select title from action where title like ${`${probe}%`} order by title`,
      );
      return result.rows.map((row) => row.title);
    });

  const call = async (user: string, method: string, path: string) =>
    fetch(`${testApp.baseUrl}/api${path}`, {
      method,
      headers: { authorization: `Bearer ${await testApp.signToken({ subject: user })}` },
    });

  const action = (
    owner: string,
    side: 'buyer' | 'supplier',
    title: string,
    visibility: string,
  ) => ({
    relationshipId: relationship,
    ownerOrgId: owner,
    visibility: visibility as 'internal' | 'shared',
    title,
    ownerSide: side,
    ownerName: 'Probe',
    dueDate: '2026-12-31',
    sourceType: 'manual' as const,
    createdBy: users.admin,
    createdByName: 'Probe',
  });

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.buyer, name: `ZA01-OEM ${run}` },
      { id: orgs.supplier, name: supplierName },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.buyer, feature: 'buyer' });
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
        person(users.admin, orgs.buyer, 'admin'),
        person(users.member, orgs.buyer, 'member'),
        person(users.supplier, orgs.supplier, 'admin'),
      ]);
    await insertRelationships(db, [
      { id: relationship, buyer: orgs.buyer, supplier: orgs.supplier },
    ]);
    await db
      .insert(schema.action)
      .values([
        action(orgs.buyer, 'buyer', titles.buyerPrivate, 'internal'),
        action(orgs.buyer, 'buyer', titles.shared, 'shared'),
        action(orgs.supplier, 'supplier', titles.supplierPrivate, 'internal'),
      ]);
    const mail = (filedBy: string, visibility: 'team' | 'private', subject: string) => ({
      orgId: orgs.buyer,
      relationshipId: relationship,
      filedBy,
      visibility,
      messageId: `<${randomUUID()}@example.com>`,
      fromEmail: 'kim@example.com',
      sentAt: new Date('2026-11-20T09:00:00Z'),
      subject,
      bodyText: 'Probe',
      source: 'forward' as const,
    });
    await db
      .insert(schema.filedMail)
      .values([
        mail(users.admin, 'team', `${probe} Team`),
        mail(users.member, 'private', `${probe} nur ich`),
      ]);
  });

  afterAll(async () => {
    await db.execute(sql`delete from ai_draft where org_id = ${orgs.buyer}`);
    await db.execute(sql`delete from confirm_token where org_id = ${orgs.buyer}`);
    await db.execute(sql`delete from data_export where org_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from filed_mail where org_id = ${orgs.buyer}`);
    await db.execute(sql`delete from action where relationship_id = ${relationship}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(
      sql`delete from organization_feature where organization_id in ${Object.values(orgs)}`,
    );
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('Die direkte Abfrage trennt die Räume: Käufer ohne lieferantenprivat, Lieferant ohne käuferprivat', async () => {
    expect(await direct(buyerSession)).toEqual([titles.buyerPrivate, titles.shared].sort());
    expect(await direct(supplierSession)).toEqual([titles.shared, titles.supplierPrivate].sort());
  });

  it('T1-ZA3: Die Suche liefert für beide Seiten dieselbe Menge wie die direkte Abfrage', async () => {
    const search = async (user: string, kunde?: string) => {
      const params = new URLSearchParams({ q: probe, ...(kunde ? { kunde } : {}) });
      const response = await call(user, 'GET', `/suche?${params}`);
      expect(response.status).toBe(200);
      return searchResultsSchema
        .parse(await response.json())
        .actions.map((hit) => hit.title)
        .sort();
    };
    expect(await search(users.admin)).toEqual(await direct(buyerSession));
    expect(await search(users.supplier, relationship)).toEqual(await direct(supplierSession));
  });

  it('T1-ZA3: Frag Reziproq liest Mails mit denselben Rechten wie die direkte Abfrage („Nur ich“ bleibt beim Autor)', async () => {
    const auth: AuthContext = {
      userId: users.admin,
      accessToken: '',
      orgRole: 'admin',
      isControlling: false,
      isOperator: false,
      tokenRoles: [],
      organization: { id: orgs.buyer, name: `ZA01-OEM ${run}`, country: null, buyer: true },
    };
    const result = (await invokePromptTool(
      'lieferant_mails',
      { lieferant: supplierName },
      auth,
      testApp.app.get(SuppliersService),
      () => {},
      testApp.app.get(ActivitiesService),
    )) as { mails?: { betreff: string }[] };
    const directMails = await withTenant(db, buyerSession, async (tx) => {
      const rows = await tx.execute<{ subject: string }>(
        sql`select subject from filed_mail where subject like ${`${probe}%`} order by subject`,
      );
      return rows.rows.map((row) => row.subject);
    });
    expect(directMails).toEqual([`${probe} Team`]);
    expect(result.mails?.map((mail) => mail.betreff)).toEqual(directMails);
  });

  it('T1-ZA3: Der Export enthält je Seite nur Zeilen, die auch die direkte Abfrage liefert, und nichts aus dem Raum der anderen Seite', async () => {
    const exportFor = async (user: string, orgId: string) => {
      const requested = await call(user, 'POST', '/einstellungen/export');
      expect(requested.status).toBe(201);
      const list = dataExportListSchema.parse(await requested.json());
      const exportId = list.exports[0]?.id ?? '';
      await testApp.app.get(DataExportService).process({ exportId, orgId, userId: user });
      const response = await call(user, 'GET', `/einstellungen/export/${exportId}/datei`);
      expect(response.status).toBe(200);
      const zip = unzipSync(new Uint8Array(await response.arrayBuffer()));
      return csvTitles(strFromU8(zip['action.csv'] ?? new Uint8Array()))
        .filter((title) => title.startsWith(probe))
        .sort();
    };
    const buyerExport = await exportFor(users.admin, orgs.buyer);
    expect(buyerExport).not.toContain(titles.supplierPrivate);
    expect(buyerExport.every((title) => [titles.buyerPrivate, titles.shared].includes(title))).toBe(
      true,
    );
    expect(buyerExport).toContain(titles.buyerPrivate);
    const supplierExport = await exportFor(users.supplier, orgs.supplier);
    expect(supplierExport).not.toContain(titles.buyerPrivate);
    expect(supplierExport).toContain(titles.supplierPrivate);
  }, 60_000);

  it('T1-ZA4: Ein Wechsel nach shared ohne Token wird abgelehnt und legt einen Entwurf an; mit Token geht er durch', async () => {
    const [target, second] = await db
      .insert(schema.action)
      .values([
        action(orgs.buyer, 'buyer', `${probe} soll in die Mitte`, 'internal'),
        action(orgs.buyer, 'buyer', `${probe} zweites Objekt`, 'internal'),
      ])
      .returning({ id: schema.action.id });
    const targetId = target?.id as string;
    const secondId = second?.id as string;
    const runId = randomUUID();
    const share = (id: string) => (tx: Parameters<Parameters<typeof withTenant>[2]>[0]) =>
      tx.update(schema.action).set({ visibility: 'shared' }).where(sql`id = ${id}`);
    const request = (id: string) => ({
      orgId: orgs.buyer,
      userId: users.admin,
      relationshipId: relationship,
      runId,
      objectType: 'action',
      objectId: id,
      summary: 'Maßnahme mit dem Lieferanten teilen',
    });
    const visibilityOf = async (id: string) =>
      (
        await db.execute<{ visibility: string }>(
          sql`select visibility from action where id = ${id}`,
        )
      ).rows[0]?.visibility;

    // Ein Lauf ohne Token: abgelehnt, das Objekt bleibt privat, ein Entwurf entsteht.
    const withoutToken = await withTenant(db, { ...buyerSession, runId }, (tx) =>
      shareOrDraft(tx, request(targetId), share(targetId)),
    );
    expect(withoutToken.status).toBe('draft');
    expect(await visibilityOf(targetId)).toBe('internal');
    const drafts = await db.execute<{ kind: string; run_id: string }>(
      sql`select kind, run_id::text from ai_draft where object_id = ${targetId}`,
    );
    expect(drafts.rows).toEqual([{ kind: 'share_request', run_id: runId }]);

    // Auch ein neues Objekt legt ein Lauf ohne Token nicht direkt geteilt an.
    await expect(
      withTenant(db, { ...buyerSession, runId }, (tx) =>
        tx
          .insert(schema.action)
          .values(action(orgs.buyer, 'buyer', `${probe} neu geteilt`, 'shared')),
      ),
    ).rejects.toMatchObject({ cause: { code: 'RZ001' } });

    // Das Token einer anderen Person gilt nicht.
    const foreign = await withTenant(
      db,
      { userId: users.member, organizationId: orgs.buyer },
      (tx) =>
        issueConfirmToken(tx, {
          orgId: orgs.buyer,
          userId: users.member,
          purpose: 'share',
          objectType: 'action',
          objectId: targetId,
        }),
    );
    const withForeign = await withTenant(
      db,
      { ...buyerSession, runId, confirmToken: foreign },
      (tx) => shareOrDraft(tx, request(targetId), share(targetId)),
    );
    expect(withForeign.status).toBe('draft');

    // Mit dem Token der Person für genau dieses Objekt geht der Wechsel durch; das Token ist danach
    // verbraucht und gilt für kein anderes Objekt.
    const token = await withTenant(db, buyerSession, (tx) =>
      issueConfirmToken(tx, {
        orgId: orgs.buyer,
        userId: users.admin,
        purpose: 'share',
        objectType: 'action',
        objectId: targetId,
      }),
    );
    const withToken = await withTenant(db, { ...buyerSession, runId, confirmToken: token }, (tx) =>
      shareOrDraft(tx, request(targetId), share(targetId)),
    );
    expect(withToken).toEqual({ status: 'shared' });
    expect(await visibilityOf(targetId)).toBe('shared');
    const used = await db.execute<{ used: boolean }>(
      sql`select used_at is not null as used from confirm_token where id = ${token}`,
    );
    expect(used.rows).toEqual([{ used: true }]);
    const reused = await withTenant(db, { ...buyerSession, runId, confirmToken: token }, (tx) =>
      shareOrDraft(tx, request(secondId), share(secondId)),
    );
    expect(reused.status).toBe('draft');
    expect(await visibilityOf(secondId)).toBe('internal');

    // Ein Mensch ohne Lauf bestätigt mit seiner eigenen Anfrage.
    const human = await withTenant(db, buyerSession, (tx) =>
      shareOrDraft(tx, { ...request(secondId), runId: null }, share(secondId)),
    );
    expect(human).toEqual({ status: 'shared' });
    expect(await visibilityOf(secondId)).toBe('shared');
  });
});
