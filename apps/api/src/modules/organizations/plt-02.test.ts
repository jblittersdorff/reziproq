import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { schema, sql } from '@reziproq/db';
import { organizationResponseSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inBatches } from '../../testing/in-batches.js';
import { callRoute, discoverRoutes } from '../../testing/routes.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/PLT-02.md über die API: Organisation, Mitglieder, Zugriff ohne Organisation
// und ohne Käuferfunktionen, Mandanten-Session als einziger Weg zu den Daten.
describe('PLT-02 über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let baseUrl = '';
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), zweit: randomUUID(), lieferant: randomUUID() };
  const users = {
    oem1: `p02-oem-1-${run}`,
    oem2: `p02-oem-2-${run}`,
    zweit: `p02-zweit-${run}`,
    lieferant: `p02-lieferant-${run}`,
    ohne: `p02-ohne-${run}`,
  };
  const nutzer = { 'urn:zitadel:iam:org:project:test-project:roles': { nutzer: { '1': 't' } } };
  const tokenFor = (subject: string) => testApp.signToken({ subject, claims: nutzer });

  beforeAll(async () => {
    testApp = await startTestApp();
    baseUrl = await testApp.app.getUrl();
    const db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `P02-OEM ${run}`, country: 'DE' },
      { id: orgs.zweit, name: `P02-Zweit ${run}`, country: 'AT' },
      { id: orgs.lieferant, name: `P02-Lieferant ${run}`, country: 'PL' },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.oem, feature: 'buyer' },
      { organizationId: orgs.zweit, feature: 'buyer' },
    ]);
    await db.insert(schema.appUser).values([
      { id: users.oem1, name: 'Anna OEM', email: 'anna@oem.example', organizationId: orgs.oem },
      { id: users.oem2, name: 'Ben OEM', email: 'ben@oem.example', organizationId: orgs.oem },
      {
        id: users.zweit,
        name: 'Cem Zweit',
        email: 'cem@zweit.example',
        organizationId: orgs.zweit,
      },
      {
        id: users.lieferant,
        name: 'Dora Lieferant',
        email: 'dora@lieferant.example',
        organizationId: orgs.lieferant,
      },
      { id: users.ohne, name: 'Emil Ohne', email: 'emil@example.com', organizationId: null },
    ]);
  });

  afterAll(async () => {
    const db = testApp.adminDb;
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    await db
      .delete(schema.organization)
      .where(sql`${schema.organization.id} in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('Ein Nutzer ohne Organisation bekommt von jeder Route außer /me und /health 403', async () => {
    const token = await tokenFor(users.ohne);
    // /me, die Login-Meldung, die eigene Sprache (PLT-09) und der Betreiber-Zugang gelten auch
    // ohne Organisation; den Betreiber-Zugang verweigert dann can() mit keine_berechtigung.
    const withoutOrganization = [
      'GET /api/health',
      'GET /api/me',
      'GET /api/me/permissions',
      'POST /api/me/anmeldung',
      'PUT /api/me/sprache',
      // Der Einladungslink ist öffentlich (LIF-01a); der Token allein entscheidet.
      'GET /api/einladungen/00000000-0000-7000-8000-000000000000',
      'POST /api/einladungen/00000000-0000-7000-8000-000000000000/annahme',
    ];
    const routes = discoverRoutes(testApp.app).filter(
      (route) =>
        !withoutOrganization.includes(`${route.method} ${route.path}`) &&
        route.path !== '/api/betreiber/kunden',
    );
    expect(routes.length).toBeGreaterThan(2);

    const results = await inBatches(routes, async (route) => {
      const res = await callRoute(baseUrl, route, token);
      const body = (await res.json()) as { code?: string };
      return `${route.method} ${route.path} → ${res.status} ${body.code ?? ''}`;
    });
    expect(results).toEqual(
      routes.map((route) => `${route.method} ${route.path} → 403 keine_organisation`),
    );

    testApp.zitadel.replyUserinfo(() => ({
      status: 200,
      body: { sub: users.ohne, name: 'Emil Ohne', email: 'emil@example.com' },
    }));
    const me = await callRoute(baseUrl, { method: 'GET', path: '/api/me' }, token);
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ organization: null });
  });

  it('Ein Nutzer des Test-OEM sieht in der Mitgliederliste nur Mitglieder des Test-OEM', async () => {
    const res = await testApp.get('/api/organisation', await tokenFor(users.oem1));
    expect(res.status).toBe(200);
    const body = organizationResponseSchema.parse(await res.json());
    expect({ ...body, members: body.members.map(({ name, email }) => ({ name, email })) }).toEqual({
      name: `P02-OEM ${run}`,
      country: 'DE',
      members: [
        { name: 'Anna OEM', email: 'anna@oem.example' },
        { name: 'Ben OEM', email: 'ben@oem.example' },
      ],
    });

    const zweit = await testApp.get('/api/organisation', await tokenFor(users.zweit));
    expect(organizationResponseSchema.parse(await zweit.json()).members).toMatchObject([
      { name: 'Cem Zweit', email: 'cem@zweit.example', orgRole: 'viewer' },
    ]);
  });

  it('Ein Nutzer ohne Feature buyer sieht die Käuferbereiche nicht', async () => {
    const token = await tokenFor(users.lieferant);
    const suppliers = await testApp.get('/api/suppliers', token);
    expect(suppliers.status).toBe(403);
    expect(await suppliers.json()).toMatchObject({ code: 'keine_berechtigung' });

    // Die eigene Organisation sieht er trotzdem.
    const own = await testApp.get('/api/organisation', token);
    expect(organizationResponseSchema.parse(await own.json()).members).toMatchObject([
      { name: 'Dora Lieferant', email: 'dora@lieferant.example' },
    ]);
  });

  it('Fachmodule nutzen die Mandanten-Session; der QS-01-Job die eigene Betriebsrolle', () => {
    const src = fileURLToPath(new URL('../../', import.meta.url));
    const files = (function walk(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return walk(path);
        return /\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [path] : [];
      });
    })(src);
    const jobsStore = 'modules/email/email-outbox.store.ts';
    const allowed = new Set(['common/database.module.ts', jobsStore]);
    const direct = files
      .map((file) => relative(src, file))
      .filter((file) => !allowed.has(file) && !file.startsWith('testing/'))
      .filter((file) =>
        /\b(DATABASE|createDatabase|withTenant|InjectDatabase)\b/.test(
          readFileSync(join(src, file), 'utf8'),
        ),
      );
    expect(direct, 'Fachmodule müssen TenantDatabase oder AccountStore nutzen').toEqual([]);
    const jobsSource = readFileSync(join(src, jobsStore), 'utf8');
    expect(jobsSource).toMatch(/\bjobsDatabaseUrl\(\)/);
    expect(jobsSource).not.toMatch(/\b(?:databaseUrl|apiDatabaseUrl)\s*\(/);
  });

  it('Die API verbindet sich als reziproq_api, nicht als Eigentümer der Tabellen', async () => {
    const owner = await testApp.adminDb.execute<{ tableowner: string }>(
      sql`select distinct tableowner from pg_tables where schemaname = 'public'`,
    );
    expect(owner.rows.map((row) => row.tableowner)).not.toContain('reziproq_api');
    expect(new URL(process.env.API_DATABASE_URL ?? '').username).toBe('reziproq_api');
  });
});
