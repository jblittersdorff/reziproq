import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  defaultSegmentCriteria,
  defaultSegmentTypes,
  playbookCatalogSchema,
  playbookPreviewSchema,
  type SaveRuleItem,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/PLB-01.md über die API: Standardkatalog, Gegenpflicht, Vorschau, Rechte.
describe('PLB-01 Kataloge für Spielregeln und Formate über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), zweit: randomUUID(), supplier: randomUUID() };
  const users = {
    admin: `plb-admin-${run}`,
    member: `plb-member-${run}`,
    zweit: `plb-zweit-${run}`,
    supplier: `plb-sup-${run}`,
  };

  const call = async (user: string, method: string, path: string, body?: unknown) => {
    const response = await fetch(`${testApp.baseUrl}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: user })}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  };
  const catalog = async (user = users.admin) =>
    playbookCatalogSchema.parse((await call(user, 'GET', '/playbook')).body);

  const text = (value: string) => ({ de: value, en: `${value} (EN)` });
  const right = (overrides: Partial<SaveRuleItem> = {}): SaveRuleItem => ({
    kind: 'right',
    group: 'collaboration',
    title: text('Gemeinsames Dashboard'),
    description: text('Beide Seiten sehen dieselben Kennzahlen.'),
    counterpartId: null,
    minImpactLevel: 2,
    ...overrides,
  });

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `PLB-OEM ${run}` },
      { id: orgs.zweit, name: `PLB-Zweit ${run}` },
      { id: orgs.supplier, name: `PLB-Lieferant ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.oem, feature: 'buyer' },
      { organizationId: orgs.zweit, feature: 'buyer' },
    ]);
    const person = (id: string, orgRole: 'admin' | 'member', organizationId: string) => ({
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
        person(users.admin, 'admin', orgs.oem),
        person(users.member, 'member', orgs.oem),
        person(users.zweit, 'admin', orgs.zweit),
        person(users.supplier, 'admin', orgs.supplier),
      ]);
    // Aktives Segmentmodell für die Namen der Typen in der Vorschau.
    const modelId = randomUUID();
    await db.insert(schema.segmentModel).values({
      id: modelId,
      orgId: orgs.oem,
      version: 1,
      status: 'active',
      lowMax: 33,
      midMax: 66,
      activatedAt: new Date(),
    });
    await db
      .insert(schema.segmentCriterion)
      .values(defaultSegmentCriteria.map((criterion) => ({ ...criterion, modelId })));
    await db
      .insert(schema.segmentType)
      .values(defaultSegmentTypes.map((type) => ({ ...type, modelId })));
  });

  afterAll(async () => {
    const all = Object.values(orgs);
    for (const table of ['rule_catalog_item', 'format_catalog_item', 'catalog_setup']) {
      await db.execute(sql`delete from ${sql.identifier(table)} where org_id in ${all}`);
    }
    await db.execute(sql`delete from segment_model where org_id in ${all}`);
    await db.execute(sql`delete from app_user where organization_id in ${all}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${all}`);
    await db.execute(sql`delete from organization where id in ${all}`);
    await testApp.close();
  });

  it('jede neue Käuferorganisation hat den Standardkatalog auf Deutsch und Englisch', async () => {
    const data = await catalog();
    expect(data.rules).toHaveLength(16);
    expect(data.formats).toHaveLength(7);
    expect(data.canManage).toBe(true);
    const price = data.rules.find((rule) =>
      rule.title.de.startsWith('Mehrjährige Preisvereinbarung'),
    );
    expect(price?.title.en).toBe('Multi-year price agreement with escalation clause');
    const counterpart = data.rules.find((rule) => rule.id === price?.counterpartId);
    expect(counterpart).toMatchObject({
      kind: 'obligation',
      counterpartId: price?.id,
      title: { de: 'Offene Kostenstruktur für vereinbarte Teile' },
    });
    expect((await catalog(users.zweit)).rules).toHaveLength(16);
  });

  it('ein Recht ohne Gegenpflicht lässt sich speichern', async () => {
    const { status, body } = await call(users.admin, 'POST', '/playbook/rules', right());
    expect(status).toBe(201);
    const created = playbookCatalogSchema
      .parse(body)
      .rules.find((rule) => rule.title.de === 'Gemeinsames Dashboard');
    expect(created).toMatchObject({ kind: 'right', counterpartId: null, minImpactLevel: 2 });
  });

  it('die Gegenpflicht gilt in beide Richtungen; ein Wechsel löst den alten Partner', async () => {
    const before = await catalog();
    const dashboard = before.rules.find((rule) => rule.title.de === 'Gemeinsames Dashboard');
    const obligation = before.rules.find(
      (rule) => rule.title.de === 'Teilnahme am beidseitigen Feedback',
    );
    const oldPartner = obligation?.counterpartId;
    expect(oldPartner).toBeTruthy();
    const { status, body } = await call(
      users.admin,
      'PUT',
      `/playbook/rules/${dashboard?.id}`,
      right({ counterpartId: obligation?.id ?? null }),
    );
    expect(status).toBe(200);
    const after = playbookCatalogSchema.parse(body).rules;
    expect(after.find((rule) => rule.id === obligation?.id)?.counterpartId).toBe(dashboard?.id);
    expect(after.find((rule) => rule.id === oldPartner)?.counterpartId).toBeNull();
  });

  it('die Gegenseite muss die andere Art haben und im eigenen Katalog liegen', async () => {
    const own = await catalog();
    const anotherRight = own.rules.find((rule) => rule.kind === 'right');
    expect(
      (
        await call(
          users.admin,
          'POST',
          '/playbook/rules',
          right({ counterpartId: anotherRight?.id ?? null }),
        )
      ).status,
    ).toBe(400);
    const foreign = (await catalog(users.zweit)).rules.find((rule) => rule.kind === 'obligation');
    expect(
      (
        await call(
          users.admin,
          'POST',
          '/playbook/rules',
          right({ counterpartId: foreign?.id ?? null }),
        )
      ).status,
    ).toBe(400);
  });

  it('die Vorschau zeigt für jeden der neun Typen die Einträge nach Impact- und Qualitätsstufe', async () => {
    const data = await catalog();
    for (const impact of [1, 2, 3]) {
      for (const quality of [1, 2, 3]) {
        const { status, body } = await call(
          users.member,
          'GET',
          `/playbook/preview/${impact}/${quality}`,
        );
        expect(status).toBe(200);
        const preview = playbookPreviewSchema.parse(body);
        expect(preview.typeName).toBe(
          defaultSegmentTypes.find((t) => t.impactLevel === impact && t.qualityLevel === quality)
            ?.name,
        );
        expect(preview.rules.map((rule) => rule.id).sort()).toEqual(
          data.rules
            .filter((rule) => rule.minImpactLevel <= impact)
            .map((rule) => rule.id)
            .sort(),
        );
        expect(preview.formats.map((format) => format.id).sort()).toEqual(
          data.formats
            .filter(
              (format) =>
                format.minImpactLevel <= impact &&
                (format.forQualityLevels.length === 0 || format.forQualityLevels.includes(quality)),
            )
            .map((format) => format.id)
            .sort(),
        );
      }
    }
    // Stichproben: Neustart nur bei schwacher Beziehung, Strategiedialog nur bei hohem Impact.
    const weakLow = playbookPreviewSchema.parse(
      (await call(users.member, 'GET', '/playbook/preview/1/1')).body,
    );
    const strongHigh = playbookPreviewSchema.parse(
      (await call(users.member, 'GET', '/playbook/preview/3/3')).body,
    );
    expect(weakLow.formats.map((format) => format.name.de)).toContain('Neustart der Beziehung');
    expect(strongHigh.formats.map((format) => format.name.de)).not.toContain(
      'Neustart der Beziehung',
    );
    expect(strongHigh.formats.map((format) => format.name.de)).toContain(
      'Strategiedialog der Geschäftsleitungen',
    );
    expect(weakLow.formats.map((format) => format.name.de)).not.toContain(
      'Strategiedialog der Geschäftsleitungen',
    );
  });

  it('Formate lassen sich mit Qualitätsstufen anlegen und ändern', async () => {
    const format = {
      name: text('Lieferantentag'),
      purpose: text('Alle Lieferanten einer Warengruppe treffen sich.'),
      level: 'operational' as const,
      cadence: 'annual' as const,
      minImpactLevel: 1,
      forQualityLevels: [3, 2],
    };
    const created = playbookCatalogSchema
      .parse((await call(users.admin, 'POST', '/playbook/formats', format)).body)
      .formats.find((entry) => entry.name.de === 'Lieferantentag');
    expect(created?.forQualityLevels).toEqual([2, 3]);
    const { status, body } = await call(users.admin, 'PUT', `/playbook/formats/${created?.id}`, {
      ...format,
      cadence: 'semiannual',
      forQualityLevels: [],
    });
    expect(status).toBe(200);
    expect(
      playbookCatalogSchema.parse(body).formats.find((entry) => entry.id === created?.id),
    ).toMatchObject({ cadence: 'semiannual', forQualityLevels: [] });
    expect(
      (await call(users.admin, 'POST', '/playbook/formats', { ...format, forQualityLevels: [4] }))
        .status,
    ).toBe(400);
  });

  it('nur Admins ändern; Mitglieder sehen den Katalog', async () => {
    const data = await catalog(users.member);
    expect(data.canManage).toBe(false);
    expect((await call(users.member, 'POST', '/playbook/rules', right())).status).toBe(403);
    expect(
      (await call(users.member, 'PUT', `/playbook/rules/${data.rules[0]?.id}`, right())).status,
    ).toBe(403);
  });

  it('der Zweit-OEM sieht und ändert den Katalog des Test-OEM nicht; der Lieferant gar nichts', async () => {
    const own = await catalog();
    const zweit = await catalog(users.zweit);
    const ownIds = new Set(own.rules.map((rule) => rule.id));
    expect(zweit.rules.some((rule) => ownIds.has(rule.id))).toBe(false);
    expect(zweit.rules.some((rule) => rule.title.de === 'Gemeinsames Dashboard')).toBe(false);
    expect(
      (await call(users.zweit, 'PUT', `/playbook/rules/${own.rules[0]?.id}`, right())).status,
    ).toBe(404);
    expect((await call(users.supplier, 'GET', '/playbook')).status).toBe(403);
  });
});
