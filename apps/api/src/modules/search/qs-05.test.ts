import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { type SearchResults, searchResultsSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { prefixQuery } from './search.js';

// Tests zu docs/specs/QS-05.md: unter einer Sekunde bei 50 Lieferanten, 200 Initiativen und 1.000
// Maßnahmen; keine Treffer aus anderen Organisationen oder internen Objekten der anderen Seite;
// Wortformen werden gefunden.
describe('QS-05 Suche', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const buyer = randomUUID();
  const otherBuyer = randomUUID();
  const suppliers = Array.from({ length: 50 }, () => randomUUID());
  const relationships = suppliers.map(() => randomUUID());
  const otherRelationship = randomUUID();
  const users = {
    buyer: `qs05-buyer-${run}`,
    other: `qs05-other-${run}`,
    supplier: `qs05-supplier-${run}`,
  };
  const first = relationships[0] as string;
  const second = relationships[1] as string;

  const search = async (user: string, q: string, kunde?: string) => {
    const params = new URLSearchParams({ q, ...(kunde ? { kunde } : {}) });
    const started = performance.now();
    const response = await fetch(`${testApp.baseUrl}/api/suche?${params}`, {
      headers: { authorization: `Bearer ${await testApp.signToken({ subject: user })}` },
    });
    const body = (await response.json().catch(() => null)) as unknown;
    return {
      status: response.status,
      milliseconds: performance.now() - started,
      results: response.status === 200 ? searchResultsSchema.parse(body) : null,
    };
  };
  const titles = (results: SearchResults | null, kind: keyof Omit<SearchResults, 'query'>) =>
    results?.[kind].map((hit) => hit.title) ?? [];

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: buyer, name: `QS05-OEM ${run}` },
      { id: otherBuyer, name: `QS05-Fremd ${run}` },
      ...suppliers.map((id, index) => ({
        id,
        name: index === 0 ? `Rheintal Elektronik ${run}` : `Lieferant ${index} ${run}`,
      })),
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: buyer, feature: 'buyer' },
      { organizationId: otherBuyer, feature: 'buyer' },
    ]);
    const person = (id: string, organizationId: string) => ({
      id,
      name: id,
      email: `${id}@example.com`,
      organizationId,
      orgRole: 'admin' as const,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.buyer, buyer),
        person(users.other, otherBuyer),
        person(users.supplier, suppliers[0] as string),
      ]);
    await insertRelationships(db, [
      ...relationships.map((id, index) => ({
        id,
        buyer,
        supplier: suppliers[index] as string,
        externalRef: `L-${10000 + index}`,
      })),
      // Derselbe Lieferant hat einen zweiten Kunden.
      { id: otherRelationship, buyer: otherBuyer, supplier: suppliers[0] as string },
    ]);
    const jbps = await db
      .insert(schema.jbp)
      .values(
        [...relationships.slice(0, 4), otherRelationship].map((relationshipId) => ({
          relationshipId,
          ownerOrgId: relationshipId === otherRelationship ? otherBuyer : buyer,
          createdBy: users.buyer,
          createdByName: 'Test',
        })),
      )
      .returning({ id: schema.jbp.id, relationshipId: schema.jbp.relationshipId });
    const jbpOf = (relationshipId: string) =>
      jbps.find((entry) => entry.relationshipId === relationshipId)?.id as string;
    const initiative = (relationshipId: string, title: string, goal: string, owner = buyer) => ({
      relationshipId,
      ownerOrgId: owner,
      jbpId: jbpOf(relationshipId),
      title,
      goal,
      benefitBuyer: 'Marge',
      benefitSupplier: 'Volumen',
      ownerBuyerName: 'Einkauf',
      ownerSupplierName: 'Vertrieb',
      startsOn: '2026-01-01',
      endsOn: '2027-12-31',
      createdBy: users.buyer,
      createdByName: 'Test',
    });
    // 200 Initiativen: eine mit „Kostensenkung“, die übrigen neutral
    await db
      .insert(schema.initiative)
      .values([
        initiative(first, 'Kostensenkung Leiterplatten', 'Preis je Platte um 5 % senken'),
        ...Array.from({ length: 199 }, (_, index) =>
          initiative(
            relationships[index % 4] as string,
            `Initiative ${index}`,
            'Qualität verbessern',
          ),
        ),
        initiative(
          otherRelationship,
          `Kostensenkung Fremdkunde ${run}`,
          'Andere Organisation',
          otherBuyer,
        ),
      ]);
    const action = (
      relationshipId: string,
      title: string,
      visibility: 'internal' | 'shared' = 'shared',
      owner: { org: string; side: 'buyer' | 'supplier' } = { org: buyer, side: 'buyer' },
    ) => ({
      relationshipId,
      ownerOrgId: owner.org,
      visibility,
      title,
      ownerSide: owner.side,
      ownerName: 'Test',
      dueDate: '2099-01-31',
      sourceType: 'manual' as const,
      createdBy: users.buyer,
      createdByName: 'Test',
    });
    // 1.000 Maßnahmen, darunter interne beider Seiten
    await db.insert(schema.action).values([
      action(first, 'Kostenanalyse Gehäuse'),
      action(first, `Kostenvergleich intern Käufer ${run}`, 'internal'),
      action(first, `Kostenplanung intern Lieferant ${run}`, 'internal', {
        org: suppliers[0] as string,
        side: 'supplier',
      }),
      action(second, 'Kostenfreigabe Werkzeug'),
      ...Array.from({ length: 996 }, (_, index) =>
        action(relationships[index % 50] as string, `Maßnahme ${index}`),
      ),
    ]);
  });

  afterAll(async () => {
    const ids = [...relationships, otherRelationship];
    await db.execute(sql`delete from action where relationship_id in ${ids}`);
    await db.execute(sql`delete from initiative where relationship_id in ${ids}`);
    await db.execute(sql`delete from jbp where relationship_id in ${ids}`);
    await deleteRelationships(db, [buyer, otherBuyer, ...suppliers]);
    await db.execute(sql`delete from app_user where id in ${Object.values(users)}`);
    await db.execute(
      sql`delete from organization_feature where organization_id in ${[buyer, otherBuyer]}`,
    );
    await db.execute(
      sql`delete from organization where id in ${[buyer, otherBuyer, ...suppliers]}`,
    );
    await testApp.close();
  });

  it('Treffer erscheinen bei 50 Lieferanten, 200 Initiativen und 1.000 Maßnahmen in unter einer Sekunde (lokal gemessen)', async () => {
    await search(users.buyer, 'Kosten'); // Aufwärmen: erste Verbindung und Token
    const result = await search(users.buyer, 'Kosten');
    expect(result.status).toBe(200);
    expect(result.milliseconds).toBeLessThan(1000);
    expect(titles(result.results, 'initiatives')).toContain('Kostensenkung Leiterplatten');
    // Höchstens fünf je Art
    const many = await search(users.buyer, `Lieferant ${run}`);
    expect(many.results?.suppliers.length).toBe(5);
    expect(many.milliseconds).toBeLessThan(1000);
  });

  it('Keine Treffer aus anderen Organisationen oder internen Objekten der anderen Seite', async () => {
    const forBuyer = (await search(users.buyer, 'Kosten')).results;
    expect(titles(forBuyer, 'initiatives')).not.toContain(`Kostensenkung Fremdkunde ${run}`);
    expect(titles(forBuyer, 'actions')).toContain(`Kostenvergleich intern Käufer ${run}`);
    expect(titles(forBuyer, 'actions')).not.toContain(`Kostenplanung intern Lieferant ${run}`);

    const forOther = (await search(users.other, 'Kosten')).results;
    expect(titles(forOther, 'initiatives')).toEqual([`Kostensenkung Fremdkunde ${run}`]);
    expect(titles(forOther, 'actions')).toEqual([]);
    expect(forOther?.suppliers).toEqual([]);

    // Lieferant: nur im aktuellen Kunden, ohne interne Objekte des Käufers
    const supplierCall = await search(users.supplier, 'Kosten', first);
    expect(supplierCall.status).toBe(200);
    const forSupplier = supplierCall.results;
    expect(titles(forSupplier, 'actions').sort()).toEqual(
      ['Kostenanalyse Gehäuse', `Kostenplanung intern Lieferant ${run}`].sort(),
    );
    expect(titles(forSupplier, 'initiatives')).toEqual(['Kostensenkung Leiterplatten']);
    expect(forSupplier?.actions[0]?.href).toMatch(`/kunden/${first}/umsetzung/massnahmen/`);
    const otherCustomer = (await search(users.supplier, 'Kosten', otherRelationship)).results;
    expect(titles(otherCustomer, 'initiatives')).toEqual([`Kostensenkung Fremdkunde ${run}`]);
    expect(titles(otherCustomer, 'actions')).toEqual([]);
    // Fremde Beziehung als Kunde: 404
    expect((await search(users.supplier, 'Kosten', second)).status).toBe(404);
  });

  it('Wortformen werden gefunden, z. B. „Kosten“ findet „Kostensenkung“', async () => {
    const result = (await search(users.buyer, 'Kosten')).results;
    expect(titles(result, 'initiatives')).toContain('Kostensenkung Leiterplatten');
    expect(titles(result, 'actions')).toEqual(
      expect.arrayContaining(['Kostenanalyse Gehäuse', 'Kostenfreigabe Werkzeug']),
    );
    // Im Ziel, Groß- und Kleinschreibung, Lieferant über Name und eigene Nummer
    expect(titles((await search(users.buyer, 'platte')).results, 'initiatives')).toContain(
      'Kostensenkung Leiterplatten',
    );
    expect(titles((await search(users.buyer, 'rheintal')).results, 'suppliers')).toEqual([
      `Rheintal Elektronik ${run}`,
    ]);
    expect((await search(users.buyer, 'L-10000')).results?.suppliers[0]?.detail).toBe('L-10000');
    // Unter drei Zeichen sucht Reziproq nicht.
    expect((await search(users.buyer, 'Ko')).status).toBe(400);
  });

  it('das Suchwort wird zu einer sicheren Präfix-Abfrage', () => {
    expect(prefixQuery('Kosten senken')).toBe('kosten:* & senken:*');
    expect(prefixQuery("x' | !y")).toBe('x:* & y:*');
    expect(prefixQuery('&&&')).toBeNull();
  });
});
