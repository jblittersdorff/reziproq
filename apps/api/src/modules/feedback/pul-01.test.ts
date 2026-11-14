import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import { surveyDetailSchema, surveyDimensions, surveysSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/PUL-01.md: Standard-Fragebögen für jede neue Käuferorganisation in beiden
// Sprachen; aktiv nur mit Text in beiden Sprachen; jede Änderung eine neue Version, frühere
// Versionen bleiben unverändert; nur Admins des Käufers.
describe('PUL-01 Fragebogen', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const users = {
    admin: `pul01-admin-${run}`,
    member: `pul01-member-${run}`,
    kam: `pul01-kam-${run}`,
  };

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

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `PUL1-OEM ${run}` },
      { id: orgs.supplier, name: `PUL1-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const person = (
      id: string,
      name: string,
      organizationId: string,
      orgRole: 'admin' | 'member',
    ) => ({
      id,
      name,
      email: `${id}@example.com`,
      organizationId,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.admin, 'Ada Admin', orgs.oem, 'admin'),
        person(users.member, 'Max Mitglied', orgs.oem, 'member'),
        person(users.kam, 'Kim Kaiser', orgs.supplier, 'admin'),
      ]);
  });

  afterAll(async () => {
    await db.execute(sql`delete from survey_template where org_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('jede neue Käuferorganisation hat beide Standard-Fragebögen auf Deutsch und Englisch', async () => {
    const list = surveysSchema.parse((await call(users.admin, 'GET', '/fragebogen')).body);
    expect(list.templates.map((entry) => [entry.kind, entry.version, entry.active])).toEqual([
      ['pulse', 1, 3],
      ['annual', 1, 25],
    ]);
    for (const kind of ['pulse', 'annual']) {
      const detail = surveyDetailSchema.parse(
        (await call(users.admin, 'GET', `/fragebogen/${kind}`)).body,
      );
      for (const question of detail.template.questions) {
        expect(question.textDe.length).toBeGreaterThan(0);
        expect(question.textEn.length).toBeGreaterThan(0);
      }
      if (kind === 'annual') {
        for (const dimension of surveyDimensions) {
          expect(
            detail.template.questions.filter((question) => question.dimension === dimension),
          ).toHaveLength(5);
        }
      }
    }
  });

  it('eine Frage lässt sich nur mit Text in beiden Sprachen aktivieren', async () => {
    const onlyGerman = { dimension: 'trust', textDe: 'Wir halten Fristen ein.', textEn: '' };
    expect(
      (
        await call(users.admin, 'POST', '/fragebogen/annual/fragen', {
          ...onlyGerman,
          active: true,
        })
      ).status,
    ).toBe(400);
    const added = surveyDetailSchema.parse(
      (
        await call(users.admin, 'POST', '/fragebogen/annual/fragen', {
          ...onlyGerman,
          active: false,
        })
      ).body,
    );
    const custom = added.template.questions.find((question) => question.custom);
    expect(custom).toMatchObject({ active: false, dimension: 'trust' });
    // Am Ende der Dimension Vertrauen, vor der ersten Frage zur Zusammenarbeit.
    expect(added.template.questions[5]?.key).toBe(custom?.key);
    const key = custom?.key as string;
    expect(
      (
        await call(users.admin, 'PUT', `/fragebogen/annual/fragen/${key}`, {
          ...onlyGerman,
          active: true,
        })
      ).status,
    ).toBe(400);
    const activated = surveyDetailSchema.parse(
      (
        await call(users.admin, 'PUT', `/fragebogen/annual/fragen/${key}`, {
          ...onlyGerman,
          textEn: 'We meet deadlines.',
          active: true,
        })
      ).body,
    );
    expect(activated.template.questions.find((question) => question.key === key)?.active).toBe(
      true,
    );
  });

  it('eine Änderung erzeugt eine neue Version, frühere Versionen bleiben unverändert', async () => {
    const before = surveyDetailSchema.parse(
      (await call(users.admin, 'GET', '/fragebogen/pulse')).body,
    );
    expect(before.template.version).toBe(1);
    const changed = surveyDetailSchema.parse(
      (
        await call(users.admin, 'PUT', '/fragebogen/pulse/fragen/pulse_trust', {
          dimension: 'trust',
          textDe: 'Wie sehr vertrauen wir uns gegenseitig?',
          textEn: 'How much do we trust one another?',
          active: true,
        })
      ).body,
    );
    expect(changed.template.version).toBe(2);
    expect(changed.versions.map((entry) => [entry.version, entry.createdByName])).toEqual([
      [2, 'Ada Admin'],
      [1, null],
    ]);
    // Ausblenden ist ebenfalls eine Version; dieselben Werte noch einmal nicht.
    const hidden = {
      dimension: 'strategy',
      textDe: 'Wie gut sind wir auf gemeinsame Ziele ausgerichtet?',
      textEn: 'How well are we aligned on shared goals?',
      active: false,
    };
    await call(users.admin, 'PUT', '/fragebogen/pulse/fragen/pulse_alignment', hidden);
    const same = surveyDetailSchema.parse(
      (await call(users.admin, 'PUT', '/fragebogen/pulse/fragen/pulse_alignment', hidden)).body,
    );
    expect(same.template.version).toBe(3);
    // Version 1, auf die eine laufende Welle zeigt, ist unverändert.
    const first = surveyDetailSchema.parse(
      (await call(users.admin, 'GET', '/fragebogen/pulse?version=1')).body,
    );
    expect(first.template).toEqual(before.template);
    // Auch direkt in der Datenbank lässt sich eine Version weder ändern noch löschen.
    for (const statement of [
      sql`update survey_template set questions = '[]' where org_id = ${orgs.oem}`,
      sql`delete from survey_template where org_id = ${orgs.oem}`,
    ]) {
      const result = await withTenant(db, { userId: users.admin, organizationId: orgs.oem }, (tx) =>
        tx.execute(statement),
      ).catch((error: unknown) => error);
      expect(result).toBeInstanceOf(Error);
    }
    // Standardfragen behalten ihre Dimension.
    expect(
      (
        await call(users.admin, 'PUT', '/fragebogen/pulse/fragen/pulse_trust', {
          ...hidden,
          active: true,
        })
      ).status,
    ).toBe(400);
  });

  it('nur Admins des Käufers sehen und ändern den Fragebogen', async () => {
    expect((await call(users.member, 'GET', '/fragebogen')).status).toBe(403);
    expect(
      (
        await call(users.member, 'PUT', '/fragebogen/pulse/fragen/pulse_trust', {
          dimension: 'trust',
          textDe: 'x',
          textEn: 'x',
          active: true,
        })
      ).status,
    ).toBe(403);
    expect((await call(users.kam, 'GET', '/fragebogen')).status).toBe(403);
    expect((await call(users.admin, 'GET', '/fragebogen/monthly')).status).toBe(400);
    expect((await call(users.admin, 'GET', '/fragebogen/pulse?version=99')).status).toBe(404);
  });
});
