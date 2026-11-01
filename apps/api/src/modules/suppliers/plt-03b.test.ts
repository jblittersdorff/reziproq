import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import {
  auditResponseSchema,
  createSupplierResponseSchema,
  permissionsResponseSchema,
  supplierDetailSchema,
  supplierLookupResponseSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/PLT-03.md, Teil b, über die API: anlegen, ändern, beenden, mit Verlauf.

describe('PLT-03b: Lieferanten anlegen, ändern und beenden', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const ids = { oemA: randomUUID(), oemB: randomUUID() };
  const users = {
    a: `p3b-a-${run}`,
    aLeser: `p3b-al-${run}`,
    b: `p3b-b-${run}`,
  };
  // Erfundene USt-IdNr. und D-U-N-S je Lauf, damit parallele Läufe sich nicht treffen.
  const digits = String(Number.parseInt(run, 16) % 1_000_000_000).padStart(9, '0');
  const vatId = `DE${digits}`;
  const duns = digits;
  const created = new Set<string>();

  const token = (user: string, role = 'nutzer') =>
    testApp.signToken({
      subject: user,
      claims: { 'urn:zitadel:iam:org:project:test-project:roles': { [role]: { '1': 'test' } } },
    });

  const call = async (
    method: 'GET' | 'POST' | 'PATCH' | 'PUT',
    path: string,
    user: string,
    body?: unknown,
    role = 'nutzer',
  ) => {
    const res = await fetch(`${testApp.baseUrl}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await token(user, role)}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, body: (await res.json().catch(() => null)) as unknown };
  };

  const create = async (user: string, body: Record<string, unknown>) => {
    const res = await call('POST', '/suppliers', user, body);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const parsed = createSupplierResponseSchema.parse(res.body);
    created.add(parsed.relationshipId);
    return parsed;
  };

  const supplierOrgOf = async (relationshipId: string) =>
    (
      await db.execute<{ id: string; name: string }>(sql`
        select o.id::text, o.name from relationship r join organization o on o.id = r.supplier_org_id
        where r.id = ${relationshipId}
      `)
    ).rows[0];

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: ids.oemA, name: `P3b-OEM A ${run}`, zitadelOrgId: `p3b-zitadel-${run}` },
      { id: ids.oemB, name: `P3b-OEM B ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: ids.oemA, feature: 'buyer' as const },
      { organizationId: ids.oemB, feature: 'buyer' as const },
    ]);
    await db.insert(schema.appUser).values([
      // Rollen liegen in der Datenbank (PLT-05).
      {
        id: users.a,
        name: 'Anna A',
        email: 'a@example.com',
        organizationId: ids.oemA,
        orgRole: 'member',
      },
      {
        id: users.aLeser,
        name: 'Leo Leser',
        email: 'l@example.com',
        organizationId: ids.oemA,
        orgRole: 'viewer',
      },
      {
        id: users.b,
        name: 'Bea B',
        email: 'b@example.com',
        organizationId: ids.oemB,
        orgRole: 'member',
      },
    ]);
  });

  afterAll(async () => {
    const supplierOrgs = (
      await db.execute<{ id: string }>(sql`
        select distinct supplier_org_id::text as id from relationship
        where buyer_org_id in ${[ids.oemA, ids.oemB]}
      `)
    ).rows.map((row) => row.id);
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    await deleteRelationships(db, [ids.oemA, ids.oemB]);
    if (supplierOrgs.length > 0) {
      await db.delete(schema.organization).where(sql`${schema.organization.id} in ${supplierOrgs}`);
    }
    await db
      .delete(schema.organization)
      .where(sql`${schema.organization.id} in ${[ids.oemA, ids.oemB]}`);
    // Der Verlauf bleibt: Niemand kann ihn löschen, auch der Test nicht (PLT-08).
    await testApp.close();
  });

  it('Zwei Käufer legen einen Lieferanten mit derselben USt-IdNr. an. Danach gibt es eine Organisation und zwei Beziehungen.', async () => {
    const before = supplierLookupResponseSchema.parse(
      (await call('GET', `/suppliers/lookup?ust=${vatId}`, users.b)).body,
    );
    expect(before).toEqual({ known: false });

    const a = await create(users.a, {
      name: `Gemeinsam ${run}`,
      country: 'PL',
      vatId: `${vatId.slice(0, 2)} ${vatId.slice(2)}`,
      externalRef: 'A-1',
      spend: { year: 2025, amountCents: 123_456_78 },
    });
    expect(a.linked).toBe(false);

    // B erfährt nur „bekannt“, nicht wer oder wie.
    const lookup = await call('GET', `/suppliers/lookup?ust=${vatId.toLowerCase()}`, users.b);
    expect(lookup.body).toEqual({ known: true });

    const b = await create(users.b, { name: `Mein Name ${run}`, country: 'DE', vatId });
    expect(b.linked).toBe(true);

    const orgs = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from organization where vat_id = ${vatId}`,
    );
    expect(orgs.rows[0]?.n).toBe(1);
    const relationships = await db.execute<{ buyer: string }>(sql`
      select r.buyer_org_id::text as buyer from relationship r
      join organization o on o.id = r.supplier_org_id where o.vat_id = ${vatId} order by 1
    `);
    expect(relationships.rows.map((row) => row.buyer).sort()).toEqual([ids.oemA, ids.oemB].sort());

    // B sieht seinen eigenen Namen, nicht A-Werte.
    const detail = supplierDetailSchema.parse(
      (await call('GET', `/suppliers/${b.relationshipId}`, users.b)).body,
    );
    expect(detail).toMatchObject({ name: `Mein Name ${run}`, externalRef: null, spend: [] });
    expect(JSON.stringify(detail)).not.toContain('A-1');

    // Ein zweites Mal beim selben Käufer: keine zweite Beziehung.
    const again = await call('POST', '/suppliers', users.a, { name: 'x', country: 'PL', vatId });
    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ code: 'schon_vorhanden', relationshipId: a.relationshipId });
  });

  it('Über D-U-N-S wird derselbe Lieferant gefunden', async () => {
    const a = await create(users.a, { name: `Duns ${run}`, country: 'CZ', duns });
    const b = await create(users.b, {
      name: `Duns B ${run}`,
      country: 'CZ',
      duns: `${duns.slice(0, 3)}-${duns.slice(3)}`,
    });
    expect(b.linked).toBe(true);
    expect((await supplierOrgOf(a.relationshipId))?.id).toBe(
      (await supplierOrgOf(b.relationshipId))?.id,
    );
  });

  it('Ohne USt-IdNr. und D-U-N-S entsteht eine neue Organisation, und keine Seite nennt fremde Organisationen', async () => {
    const name = `Ohne Nummer ${run}`;
    const a = await create(users.a, { name, country: 'IT' });
    const b = await call('POST', '/suppliers', users.b, { name, country: 'IT' });
    expect(b.status).toBe(201);
    const bId = createSupplierResponseSchema.parse(b.body);
    created.add(bId.relationshipId);
    expect(bId.linked).toBe(false);
    expect((await supplierOrgOf(a.relationshipId))?.id).not.toBe(
      (await supplierOrgOf(bId.relationshipId))?.id,
    );

    // Was B zu sehen bekommt, nennt nie OEM A oder dessen Werte.
    const seen = JSON.stringify([
      b.body,
      (await call('GET', `/suppliers/${bId.relationshipId}`, users.b)).body,
      (await call('GET', '/suppliers', users.b)).body,
      (await call('GET', `/suppliers/lookup?ust=${vatId}`, users.b)).body,
    ]);
    expect(seen).not.toContain(`P3b-OEM A ${run}`);
    expect(seen).not.toContain('A-1');
    expect(seen).not.toContain('Gemeinsam');
    // Fremde Beziehungen gibt es für B nicht.
    expect((await call('GET', `/suppliers/${a.relationshipId}`, users.b)).status).toBe(404);
  });

  it('Anlegen, Ändern und Beenden erzeugen Verlaufseinträge, ohne Spend oder Notizen in geteilten Einträgen', async () => {
    const { relationshipId } = await create(users.a, {
      name: `Verlauf ${run}`,
      country: 'AT',
      externalRef: 'V-1',
      spend: { year: 2025, amountCents: 777_00 },
    });
    expect(
      (
        await call('PATCH', `/suppliers/${relationshipId}`, users.a, {
          displayName: `Verlauf neu ${run}`,
          externalRef: 'V-2',
          notes: 'Geheime Notiz',
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call('PUT', `/suppliers/${relationshipId}/spend/2025`, users.a, {
          amountCents: 888_00,
        })
      ).status,
    ).toBe(200);
    expect((await call('POST', `/suppliers/${relationshipId}/beenden`, users.a)).status).toBe(200);

    const history = auditResponseSchema.parse(
      (
        await call(
          'GET',
          `/audit?object_type=relationship,relationship_side,relationship_spend&object_id=${relationshipId}`,
          users.a,
        )
      ).body,
    );
    const summary = history.entries
      .map((entry) => `${entry.action}:${Object.keys(entry.changes).sort().join(',')}`)
      .reverse();
    expect(summary).toEqual([
      'created:status',
      'created:display_name,external_ref',
      'created:amount_cents,year',
      'updated:display_name,external_ref,notes',
      'updated:amount_cents',
      'ended:status',
    ]);
    expect(history.entries.every((entry) => entry.actorName === 'Anna A')).toBe(true);
    expect(history.entries[0]?.changes).toEqual({ status: { from: 'draft', to: 'ended' } });

    // Geteilte Einträge enthalten nur den Status.
    const shared = await db.execute<{ changes: Record<string, unknown> }>(sql`
      select changes from audit_event where object_id = ${relationshipId} and visibility = 'shared'
    `);
    expect(shared.rows.length).toBe(2);
    for (const row of shared.rows) {
      expect(Object.keys(row.changes)).toEqual(['status']);
      expect(JSON.stringify(row.changes)).not.toMatch(/Notiz|777|888|V-1|V-2/);
    }

    // Aus Sicht des Lieferanten (im Kontext dieses Kunden, Beziehung aktiv): nur der Status.
    const supplier = await supplierOrgOf(relationshipId);
    await db.execute(sql`update relationship set status = 'active' where id = ${relationshipId}`);
    try {
      const seen = await withTenant(
        db,
        {
          userId: 'lieferant',
          organizationId: supplier?.id ?? null,
          customerOrganizationId: ids.oemA,
        },
        async (tx) =>
          (
            await tx.execute<{ changes: Record<string, unknown> }>(
              sql`select changes from audit_event where relationship_id = ${relationshipId}`,
            )
          ).rows,
      );
      expect(seen.length).toBe(2);
      expect(JSON.stringify(seen)).not.toMatch(/Notiz|777|888|V-1|V-2|display_name/);
    } finally {
      await db.execute(sql`update relationship set status = 'ended' where id = ${relationshipId}`);
    }
  });

  it('Beenden setzt den Status, löscht nichts und geht nur einmal', async () => {
    const { relationshipId } = await create(users.a, { name: `Ende ${run}`, country: 'FR' });
    const ended = supplierDetailSchema.parse(
      (await call('POST', `/suppliers/${relationshipId}/beenden`, users.a)).body,
    );
    expect(ended.status).toBe('ended');
    expect(ended.endedAt).not.toBeNull();
    expect((await call('POST', `/suppliers/${relationshipId}/beenden`, users.a)).status).toBe(409);
    const list = (await call('GET', '/suppliers', users.a)).body as {
      suppliers: { relationshipId: string; status: string }[];
    };
    expect(list.suppliers.find((s) => s.relationshipId === relationshipId)?.status).toBe('ended');
  });

  describe('Pflichtfelder und Formate werden in der API geprüft (zod in packages/shared)', () => {
    it.each([
      ['ohne Name', { country: 'DE' }, 'name'],
      ['leerer Name', { name: '  ', country: 'DE' }, 'name'],
      ['ohne Land', { name: 'X' }, 'country'],
      ['unbekanntes Land', { name: 'X', country: 'XX' }, 'country'],
      ['USt-IdNr. falsch', { name: 'X', country: 'DE', vatId: '12345' }, 'vatId'],
      ['D-U-N-S falsch', { name: 'X', country: 'DE', duns: '12345' }, 'duns'],
      [
        'Spend negativ',
        { name: 'X', country: 'DE', spend: { year: 2025, amountCents: -1 } },
        'spend',
      ],
      [
        'Spend mit Bruchteil von Cent',
        { name: 'X', country: 'DE', spend: { year: 2025, amountCents: 1.5 } },
        'spend',
      ],
      [
        'Jahr zu früh',
        { name: 'X', country: 'DE', spend: { year: 1999, amountCents: 1 } },
        'spend',
      ],
    ])('lehnt Anlegen %s mit 400 ab', async (_case, body, field) => {
      const res = await call('POST', '/suppliers', users.a, body);
      expect(res.status).toBe(400);
      expect(Object.keys((res.body as { errors: Record<string, unknown> }).errors)).toContain(
        field,
      );
    });

    it('lehnt zu lange Notizen, falsche Jahre und falsche Beträge ab', async () => {
      const { relationshipId } = await create(users.a, { name: `Format ${run}`, country: 'ES' });
      expect(
        (
          await call('PATCH', `/suppliers/${relationshipId}`, users.a, {
            displayName: 'X',
            notes: 'x'.repeat(2001),
          })
        ).status,
      ).toBe(400);
      expect(
        (await call('PUT', `/suppliers/${relationshipId}/spend/1999`, users.a, { amountCents: 1 }))
          .status,
      ).toBe(400);
      expect(
        (
          await call('PUT', `/suppliers/${relationshipId}/spend/2025`, users.a, {
            amountCents: 'viel',
          })
        ).status,
      ).toBe(400);
      expect((await call('GET', '/suppliers/keine-uuid', users.a)).status).toBe(400);
    });
  });

  describe('Rechte', () => {
    it('Leser sehen, aber legen nicht an, ändern nicht und beenden nicht', async () => {
      const { relationshipId } = await create(users.a, { name: `Rechte ${run}`, country: 'NL' });
      const leser = (method: 'GET' | 'POST' | 'PATCH' | 'PUT', path: string, body?: unknown) =>
        call(method, path, users.aLeser, body, 'leser');
      expect((await leser('GET', `/suppliers/${relationshipId}`)).status).toBe(200);
      expect((await leser('POST', '/suppliers', { name: 'X', country: 'DE' })).status).toBe(403);
      expect(
        (await leser('PATCH', `/suppliers/${relationshipId}`, { displayName: 'X' })).status,
      ).toBe(403);
      expect((await leser('POST', `/suppliers/${relationshipId}/beenden`)).status).toBe(403);
      expect(
        (await leser('PUT', `/suppliers/${relationshipId}/spend/2025`, { amountCents: 1 })).status,
      ).toBe(403);
      expect((await leser('GET', '/suppliers/lookup?ust=DE123456789')).status).toBe(403);
    });

    it('meldet in /me/permissions, wer Lieferanten bearbeiten darf', async () => {
      const editable = async (user: string) =>
        permissionsResponseSchema
          .parse((await call('GET', '/me/permissions', user)).body)
          .actions.includes('lieferanten.bearbeiten');
      expect(await editable(users.a)).toBe(true);
      expect(await editable(users.aLeser)).toBe(false);
    });

    it('Ein anderer Käufer kann eine fremde Beziehung weder ändern noch beenden', async () => {
      const { relationshipId } = await create(users.a, { name: `Fremd ${run}`, country: 'SK' });
      expect(
        (await call('PATCH', `/suppliers/${relationshipId}`, users.b, { displayName: 'X' })).status,
      ).toBe(404);
      expect((await call('POST', `/suppliers/${relationshipId}/beenden`, users.b)).status).toBe(
        404,
      );
      expect(
        (await call('PUT', `/suppliers/${relationshipId}/spend/2025`, users.b, { amountCents: 1 }))
          .status,
      ).toBe(404);
    });
  });
});
