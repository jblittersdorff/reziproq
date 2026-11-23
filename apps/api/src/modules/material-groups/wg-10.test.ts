import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { strategyAssessmentSchema, strategyContextResponseSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/WG-10.md (Bewertung und Hebel), je Kriterium aus „Fertig, wenn“.
describe('WG-10 Bewertung und Hebel', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { a: randomUUID(), b: randomUUID(), s1: randomUUID() };
  const group = randomUUID();
  const users = {
    lead: `wg10-lead-${run}`,
    adminA: `wg10-admin-${run}`,
    adminB: `wg10-admin-b-${run}`,
    supplier: `wg10-sup-${run}`,
  };
  let strategyId = '';

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
  const base = () => `/warengruppen/strategien/${strategyId}`;
  const assessment = async () =>
    strategyAssessmentSchema.parse((await call(users.lead, 'GET', `${base()}/bewertung`)).body);
  const add = async (type: string, text: string) =>
    strategyAssessmentSchema.parse(
      (await call(users.lead, 'POST', `${base()}/profil`, { type, text })).body,
    );
  const stepState = async () =>
    strategyContextResponseSchema.parse(
      (await call(users.lead, 'GET', `/warengruppen/${group}/strategie?jahr=2031`)).body,
    ).context?.strategy.steps[5];
  const idOf = (items: { id: string; code: string }[], code: string) =>
    items.find((item) => item.code === code)?.id as string;

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.a, name: `WG10-A ${run}` },
      { id: orgs.b, name: `WG10-B ${run}` },
      { id: orgs.s1, name: `WG10-Lieferant ${run}` },
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
        person(users.lead, orgs.a, 'member'),
        person(users.adminA, orgs.a, 'admin'),
        person(users.adminB, orgs.b, 'admin'),
        person(users.supplier, orgs.s1, 'admin'),
      ]);
    await db.insert(schema.materialGroup).values({
      id: group,
      orgId: orgs.a,
      name: 'Leiterplatten',
      code: `LP-${run}`,
      leadUserId: users.lead,
    });
    await db
      .insert(schema.materialGroupMember)
      .values({ orgId: orgs.a, materialGroupId: group, userId: users.lead, role: 'lead' });
    strategyId = strategyContextResponseSchema.parse(
      (await call(users.lead, 'POST', `/warengruppen/${group}/strategie`, { year: 2031 })).body,
    ).context?.strategy.id as string;
  });

  afterAll(async () => {
    const orgIds = Object.values(orgs);
    await db.execute(sql`delete from material_group_strategy where org_id in ${orgIds}`);
    await db.execute(sql`delete from lever where org_id in ${orgIds}`);
    await db.execute(sql`delete from material_group_kpi where org_id in ${orgIds}`);
    await db.execute(sql`delete from material_group_question where org_id in ${orgIds}`);
    await deleteRelationships(db, orgIds);
    await db.execute(sql`delete from objective_category where org_id in ${orgIds}`);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization where id in ${orgIds}`);
    await testApp.close();
  });

  it('Kürzel je Typ fortlaufend; der Katalog startet mit 23 Hebeln', async () => {
    expect((await assessment()).levers).toHaveLength(23);
    await add('strength', 'Guter Draht zu den Laminat-Herstellern');
    await add('strength', 'Bedarf lässt sich über drei Business Units bündeln');
    await add('weakness', '65 % des Umsatzes bei zwei Lieferanten');
    const after = await add('opportunity', 'Moldau PCB baut Kapazität in der EU auf');
    expect(after.items.map((item) => item.code)).toEqual(['S1', 'S2', 'W1', 'O1']);
  });

  it('eine Paarung aus zwei internen oder zwei externen Einträgen wird abgelehnt', async () => {
    const { items, levers } = await assessment();
    const lever = levers[0]?.id;
    await add('threat', 'Donau Print ist finanziell kritisch');
    const all = (await assessment()).items;
    const twoInternal = await call(users.lead, 'POST', `${base()}/paarungen`, {
      internalItemId: idOf(items, 'S1'),
      externalItemId: idOf(items, 'W1'),
      leverId: lever,
      reason: 'x',
    });
    expect(twoInternal.status).toBe(400);
    expect(twoInternal.body).toMatchObject({ code: 'invalid_pairing' });
    const twoExternal = await call(users.lead, 'POST', `${base()}/paarungen`, {
      internalItemId: idOf(all, 'O1'),
      externalItemId: idOf(all, 'T1'),
      leverId: lever,
      reason: 'x',
    });
    expect(twoExternal.body).toMatchObject({ code: 'invalid_pairing' });
  });

  it('ein gewählter Hebel ohne Begründung wird abgelehnt', async () => {
    const { items, levers } = await assessment();
    const response = await call(users.lead, 'POST', `${base()}/paarungen`, {
      internalItemId: idOf(items, 'S1'),
      externalItemId: idOf(items, 'T1'),
      leverId: levers[13]?.id,
      reason: '',
      status: 'chosen',
    });
    expect(response.status).toBe(400);
    // Ein Vorschlag darf ohne Begründung stehen.
    const proposed = await call(users.lead, 'POST', `${base()}/paarungen`, {
      internalItemId: idOf(items, 'S2'),
      externalItemId: idOf(items, 'T1'),
      leverId: levers[10]?.id,
      status: 'proposed',
    });
    expect(proposed.status).toBe(201);
  });

  it('Schritt 6 ist fertig mit je einem bestätigten Eintrag und einer gewählten Paarung; Vorschläge zählen nicht', async () => {
    // Vier Felder belegt, aber nur ein Vorschlag
    expect(await stepState()).toBe('in_progress');
    const { items, levers } = await assessment();
    const chosen = strategyAssessmentSchema.parse(
      (
        await call(users.lead, 'POST', `${base()}/paarungen`, {
          internalItemId: idOf(items, 'S1'),
          externalItemId: idOf(items, 'T1'),
          leverId: levers.find((lever) => lever.name === 'Second-Level Buying')?.id,
          reason:
            'Laminat direkt einkaufen, damit ein Ausfall auf Stufe 1 die Versorgung nicht stoppt.',
        })
      ).body,
    );
    expect(chosen.choices.filter((choice) => choice.status === 'chosen')).toHaveLength(1);
    expect(await stepState()).toBe('done');
    // Ein Entwurf im Profil zählt nicht: Ohne bestätigte Chance ist der Schritt nicht fertig.
    await db
      .update(schema.materialGroupSwotItem)
      .set({ status: 'draft' })
      .where(sql`${schema.materialGroupSwotItem.id} = ${idOf(items, 'O1')}`);
    expect(await stepState()).toBe('in_progress');
    await call(users.lead, 'PATCH', `${base()}/profil/${idOf(items, 'O1')}`, { confirm: true });
    expect(await stepState()).toBe('done');
  });

  it('Schritt 26: ein Vorschlag wird mit Begründung gewählt oder verworfen', async () => {
    const { items, levers, choices } = await assessment();
    const proposal = choices.find((choice) => choice.status === 'proposed');
    if (!proposal) throw new Error('Vorschlag fehlt');
    const body = {
      internalItemId: proposal.internalItemId,
      externalItemId: proposal.externalItemId,
      leverId: proposal.leverId,
    };
    // Übernehmen verlangt eine Begründung
    expect(
      (
        await call(users.lead, 'PATCH', `${base()}/paarungen/${proposal.id}`, {
          ...body,
          status: 'chosen',
          reason: '',
        })
      ).status,
    ).toBe(400);
    const dismissed = strategyAssessmentSchema.parse(
      (
        await call(users.lead, 'PATCH', `${base()}/paarungen/${proposal.id}`, {
          ...body,
          status: 'dismissed',
        })
      ).body,
    );
    expect(dismissed.choices.find((choice) => choice.id === proposal.id)?.status).toBe('dismissed');
    expect(items.length).toBeGreaterThan(0);
    expect(levers.length).toBeGreaterThan(0);
  });

  it('Schritt 26: den Hebelkatalog pflegen nur Admins; ausgeschaltete Hebel bleiben in Paarungen lesbar', async () => {
    const { levers } = await assessment();
    const lever = levers.find((entry) => entry.name === 'Preise verhandeln');
    if (!lever) throw new Error('Hebel fehlt');
    expect(
      (await call(users.lead, 'PATCH', `/warengruppen/hebel/${lever.id}`, { active: false }))
        .status,
    ).toBe(403);
    const changed = await call(users.adminA, 'PATCH', `/warengruppen/hebel/${lever.id}`, {
      description: 'Preise nach Markt-, Mengen- oder Leistungskriterien anpassen.',
      dimensions: ['cost', 'supply'],
      active: false,
    });
    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({ dimensions: ['cost', 'supply'], active: false });
    const list = (await call(users.lead, 'GET', '/warengruppen/hebel')).body as {
      levers: { id: string; active: boolean }[];
    };
    expect(list.levers.find((entry) => entry.id === lever.id)?.active).toBe(false);
    await call(users.adminA, 'PATCH', `/warengruppen/hebel/${lever.id}`, { active: true });
  });

  it('ein eigener Hebel bei Kunde A erscheint nicht bei Kunde B', async () => {
    const missing = await call(users.lead, 'POST', '/warengruppen/hebel', {
      name: 'Rezyklat-Programm',
      dimensions: ['sustainability'],
      reason: '',
    });
    expect(missing.status).toBe(400);
    const created = await call(users.lead, 'POST', '/warengruppen/hebel', {
      name: 'Rezyklat-Programm',
      description: 'Gemeinsam Rezyklat qualifizieren',
      dimensions: ['sustainability', 'cost'],
      reason: 'Kein Hebel im Katalog deckt Rezyklat ab.',
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ custom: true, name: 'Rezyklat-Programm' });
    const own = (await call(users.adminA, 'GET', '/warengruppen/hebel')).body as {
      levers: { name: string }[];
    };
    expect(own.levers.some((lever) => lever.name === 'Rezyklat-Programm')).toBe(true);
    const other = (await call(users.adminB, 'GET', '/warengruppen/hebel')).body as {
      levers: { name: string }[];
    };
    expect(other.levers).toHaveLength(23);
    expect(other.levers.some((lever) => lever.name === 'Rezyklat-Programm')).toBe(false);
    // Nur Admins pflegen den Katalog
    const id = (created.body as { id: string }).id;
    expect(
      (await call(users.lead, 'PATCH', `/warengruppen/hebel/${id}`, { active: false })).status,
    ).toBe(403);
    expect(
      (await call(users.adminA, 'PATCH', `/warengruppen/hebel/${id}`, { active: false })).status,
    ).toBe(200);
    expect(
      (await call(users.adminB, 'PATCH', `/warengruppen/hebel/${id}`, { active: true })).status,
    ).toBe(404);
  });

  it('der Test-Lieferant und ein fremder Käufer sehen keine Bewertung', async () => {
    expect((await call(users.supplier, 'GET', `${base()}/bewertung`)).status).toBe(403);
    expect((await call(users.supplier, 'GET', '/warengruppen/hebel')).status).toBe(403);
    expect((await call(users.adminB, 'GET', `${base()}/bewertung`)).status).toBe(404);
    expect(
      (await call(users.adminB, 'POST', `${base()}/profil`, { type: 'strength', text: 'x' }))
        .status,
    ).toBe(404);
  });
});
