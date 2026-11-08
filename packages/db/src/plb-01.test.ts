import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDefaultCatalog, seedDefaultCatalog } from './catalog.js';
import { seed, seedBuyers } from './seed.js';
import { withTenant } from './tenant.js';
import { createTempDatabase, migrateTo } from './testing/temp-database.js';

// Tests zu docs/specs/PLB-01.md in der Datenbank: Standardkatalog und Trennung je Organisation.
describe('PLB-01 Kataloge in der Datenbank', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;
  const fresh = randomUUID();

  const asOrg = <T extends Record<string, unknown>>(org: string, query: ReturnType<typeof sql>) =>
    withTenant(
      temp.db,
      { userId: 'test-nutzer', organizationId: org },
      async (tx) => (await tx.execute<T>(query)).rows,
    );

  beforeAll(async () => {
    temp = await createTempDatabase();
    await migrateTo(temp.db);
    await seed(temp.db, { nodeEnv: 'development' });
    await temp.db.execute(
      sql`insert into organization (id, name) values (${fresh}, 'Neuer Käufer')`,
    );
    await temp.db.execute(
      sql`insert into organization_feature (organization_id, feature) values (${fresh}, 'buyer')`,
    );
  });

  afterAll(async () => {
    await temp.drop();
  });

  it('der Standardkatalog hat acht Paare aus Recht und Gegenpflicht und sieben Formate, je auf Deutsch und Englisch', () => {
    const catalog = loadDefaultCatalog();
    expect(catalog.rules.filter((rule) => rule.kind === 'right')).toHaveLength(8);
    expect(catalog.rules.filter((rule) => rule.kind === 'obligation')).toHaveLength(8);
    expect(catalog.formats).toHaveLength(7);
    for (const rule of catalog.rules) {
      const counterpart = catalog.rules.find((other) => other.key === rule.counterpart);
      expect(counterpart?.kind, rule.key).not.toBe(rule.kind);
      expect(counterpart?.counterpart, rule.key).toBe(rule.key);
      expect(counterpart?.group, rule.key).toBe(rule.group);
      expect(rule.title.de).not.toBe(rule.title.en);
    }
    expect(catalog.formats.find((format) => format.key === 'relationship_restart')).toMatchObject({
      forQualityLevels: [1],
      name: { de: 'Neustart der Beziehung', en: 'Relationship restart' },
    });
  });

  it('jede neue Käuferorganisation bekommt den Katalog einmalig, mit Gegenpflichten verbunden', async () => {
    const first = await withTenant(
      temp.db,
      { userId: 'test-nutzer', organizationId: fresh },
      (tx) => seedDefaultCatalog(tx, fresh),
    );
    expect(first).toBe(true);
    const rules = await asOrg<{ key: string; partner: string | null; de: string; en: string }>(
      fresh,
      sql`select r.key, p.key as partner, r.title->>'de' as de, r.title->>'en' as en
          from rule_catalog_item r left join rule_catalog_item p on p.id = r.counterpart_id
          order by r.position`,
    );
    expect(rules).toHaveLength(16);
    expect(rules[0]).toEqual({
      key: 'price_agreement',
      partner: 'open_costs',
      de: 'Mehrjährige Preisvereinbarung mit Gleitklausel',
      en: 'Multi-year price agreement with escalation clause',
    });
    expect(rules.every((rule) => rule.partner !== null)).toBe(true);
    const formats = await asOrg<{ n: number }>(
      fresh,
      sql`select count(*)::int as n from format_catalog_item`,
    );
    expect(formats[0]?.n).toBe(7);
  });

  it('ein zweiter Lauf legt nichts erneut an; Gelöschtes bleibt gelöscht', async () => {
    await asOrg(fresh, sql`delete from format_catalog_item where key = 'innovation_day'`);
    const again = await withTenant(
      temp.db,
      { userId: 'test-nutzer', organizationId: fresh },
      (tx) => seedDefaultCatalog(tx, fresh),
    );
    expect(again).toBe(false);
    const formats = await asOrg<{ n: number }>(
      fresh,
      sql`select count(*)::int as n from format_catalog_item`,
    );
    expect(formats[0]?.n).toBe(6);
  });

  it('der Zweit-OEM sieht den Katalog des Test-OEM nicht', async () => {
    const own = await asOrg<{ org_id: string }>(
      seedBuyers.zweitOem.id,
      sql`select distinct org_id::text from rule_catalog_item`,
    );
    expect(own).toEqual([{ org_id: seedBuyers.zweitOem.id }]);
  });
});
