import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

test.use({ locale: 'de-DE' });

const demoFile = fileURLToPath(new URL('../../../docs/demo/lieferanten-50.xlsx', import.meta.url));

type BrowserTestApp = {
  adminDb: import('../../../packages/db/src/client.js').Database;
  baseUrl: string;
  close: () => Promise<void>;
  get: (path: string, token?: string) => Promise<Response>;
  signToken: (options?: { subject?: string }) => Promise<string>;
  zitadel: {
    replyUserinfo: (handler: () => { status: number; body?: unknown }) => void;
  };
};

test('PLT-07 importiert die Demo über die Oberfläche in die echte Datenbank', async ({
  page,
}, testInfo) => {
  process.env.NODE_ENV = 'test';
  process.env.ZITADEL_ISSUER = 'https://zitadel.test';
  process.env.ZITADEL_PROJECT_ID = 'test-project';

  const { startTestApp } = (await import(
    new URL('../../api/dist/testing/test-app.js', import.meta.url).href
  )) as { startTestApp: () => Promise<BrowserTestApp> };
  const { deleteRelationships } = (await import(
    new URL('../../api/dist/testing/relationships.js', import.meta.url).href
  )) as {
    deleteRelationships: (db: BrowserTestApp['adminDb'], orgIds: string[]) => Promise<void>;
  };
  const { demoSupplierImportRows } = await import('../../../packages/shared/src/import-demo.js');
  const {
    ensureApiRole,
    ensureTestDatabase,
    inArray,
    schema,
    sql,
    databaseUrl,
    apiDatabaseUrl,
    testDatabaseUrl,
  } = await import('../../../packages/db/src/index.js');
  // In die Testdatenbank, nie in die lokale Entwicklungsdatenbank (wie die API-Tests).
  process.env.DATABASE_URL = testDatabaseUrl(databaseUrl());
  process.env.API_DATABASE_URL = testDatabaseUrl(apiDatabaseUrl());
  await ensureTestDatabase(databaseUrl());
  const organizationId = randomUUID();
  const userId = `plt07-playwright-${randomUUID()}`;
  const zitadelOrgId = `plt07-zitadel-${randomUUID()}`;
  const vatIds = demoSupplierImportRows.map((supplier) => supplier.vatId);
  const existingSupplierIds = new Set<string>();
  let testApp: Awaited<ReturnType<typeof startTestApp>> | undefined;

  try {
    await ensureApiRole(databaseUrl(), apiDatabaseUrl());
    testApp = await startTestApp();
    const db = testApp.adminDb;
    const preexisting = await db
      .select({ id: schema.organization.id })
      .from(schema.organization)
      .where(inArray(schema.organization.vatId, vatIds));
    for (const supplier of preexisting) existingSupplierIds.add(supplier.id);

    await db.insert(schema.organization).values({
      id: organizationId,
      name: 'PLT-07 Browser (Demo)',
      zitadelOrgId,
    });
    await db.insert(schema.organizationFeature).values({ organizationId, feature: 'buyer' });
    await db.insert(schema.appUser).values({
      id: userId,
      name: 'Anna Schmidt',
      email: `${userId}@example.com`,
      organizationId,
      orgRole: 'member',
      rolesImportedAt: new Date(0),
    });
    await db.insert(schema.businessUnit).values({
      orgId: organizationId,
      name: 'Pkw',
      code: 'PKW',
    });
    await db.insert(schema.materialGroup).values({
      orgId: organizationId,
      name: 'Elektronik',
      code: 'EL',
    });
    testApp.zitadel.replyUserinfo(() => ({
      status: 200,
      body: {
        sub: userId,
        name: 'Anna Schmidt',
        given_name: 'Anna',
        email: `${userId}@example.com`,
        'urn:zitadel:iam:user:resourceowner:id': zitadelOrgId,
      },
    }));

    await fakeZitadel(page);
    await page.route('**/api/**', async (route) => {
      const requestUrl = new URL(route.request().url());
      const token = await testApp?.signToken({ subject: userId });
      if (!token || !testApp) throw new Error('API-Testanmeldung wurde nicht gestartet.');
      const postData = route.request().postDataBuffer();
      const response = await route.fetch({
        url: `${testApp.baseUrl}${requestUrl.pathname}${requestUrl.search}`,
        ...(postData ? { postData } : {}),
        headers: {
          ...(await route.request().allHeaders()),
          authorization: `Bearer ${token}`,
        },
      });
      await route.fulfill({ response });
    });

    await page.goto('/lieferanten/importieren');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Lieferanten importieren' }),
    ).toBeVisible();
    await expect(page.getByText('UTF-8 · höchstens 10 MB und 5.000 Zeilen')).toBeVisible();

    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await expect(page.locator('html')).toHaveClass(scheme === 'dark' ? /dark/ : /^(?!.*dark)/);
      for (const viewport of [
        { name: 'desktop', width: 1440, height: 1000 },
        { name: 'mobile', width: 390, height: 844 },
      ]) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.screenshot({
          path: testInfo.outputPath(`plt-07a-${scheme}-${viewport.name}.png`),
          fullPage: true,
        });
      }
    }

    await page.locator('#supplier-import-file').setInputFiles({
      name: 'lieferanten-50.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await readFile(demoFile),
    });
    await page.getByRole('button', { name: 'Vorschau erstellen' }).click();
    await expect(
      page.getByText('50 neu · 0 geändert · 0 unverändert · 3 fehlerhaft'),
    ).toBeVisible();
    await expect(page.getByText('Land: Kein gültiger ISO-Ländercode.')).toBeVisible();
    await expect(page.getByText('USt-IdNr.: Ungültiges USt-IdNr.-Format.')).toBeVisible();
    await expect(
      page.getByText('Warengruppen: Warengruppe ist unbekannt oder nicht aktiv.'),
    ).toBeVisible();
    const errorDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Fehlerdatei herunterladen' }).click();
    const download = await errorDownload;
    const errorFilePath = testInfo.outputPath('lieferanten-fehler.csv');
    await download.saveAs(errorFilePath);
    const errorLines = (await readFile(errorFilePath, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
    expect(errorLines).toHaveLength(4);
    expect(errorLines[0]).toContain('"Fehler"');
    expect(errorLines.join('\n')).toContain('"Fehlendes Land (Demo)"');
    expect(errorLines.join('\n')).toContain('"Ungültige Umsatzsteuer (Demo)"');
    expect(errorLines.join('\n')).toContain('"Unbekannte Warengruppe (Demo)"');
    expect(errorLines.join('\n')).toContain('"Land: Kein gültiger ISO-Ländercode."');
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const viewport of [
        { name: 'desktop', width: 1440, height: 1000 },
        { name: 'mobile', width: 390, height: 844 },
      ]) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.screenshot({
          path: testInfo.outputPath(`plt-07-preview-${scheme}-${viewport.name}.png`),
          fullPage: true,
        });
        const dimensions = await page.evaluate(() => ({
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          overflow: [...document.querySelectorAll('body *')]
            .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
            .slice(0, 5)
            .map((element) => ({
              element: element.tagName,
              className: element.getAttribute('class'),
              right: element.getBoundingClientRect().right,
            })),
        }));
        expect(dimensions.scrollWidth, JSON.stringify(dimensions)).toBeLessThanOrEqual(
          dimensions.innerWidth,
        );
      }
    }
    await page.getByRole('button', { name: 'Importieren' }).click();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Import abgeschlossen' }),
    ).toBeVisible();
    await expect(
      page.getByText('50 neu · 0 geändert · 0 unverändert · 3 fehlerhaft'),
    ).toBeVisible();

    const stored = await testApp.adminDb.execute<{ total: number }>(sql`
      select count(*)::int as total
      from relationship r
      join relationship_side s on s.relationship_id = r.id and s.org_id = r.buyer_org_id
      where r.buyer_org_id = ${organizationId}
        and s.external_ref like 'DEMO-%'
    `);
    expect(stored.rows[0]?.total).toBe(50);
    const listed = await testApp.get(
      '/api/suppliers',
      await testApp.signToken({ subject: userId }),
    );
    expect(listed.status).toBe(200);
    expect(((await listed.json()) as { suppliers: unknown[] }).suppliers).toHaveLength(50);
  } finally {
    if (testApp) {
      try {
        const supplierIds = await testApp.adminDb
          .select({ id: schema.relationship.supplierOrgId })
          .from(schema.relationship)
          .where(sql`${schema.relationship.buyerOrgId} = ${organizationId}`);
        const newlyCreatedSupplierIds = supplierIds
          .map((supplier) => supplier.id)
          .filter((id) => !existingSupplierIds.has(id));
        await deleteRelationships(testApp.adminDb, [organizationId]);
        await testApp.adminDb.delete(schema.appUser).where(sql`${schema.appUser.id} = ${userId}`);
        await testApp.adminDb
          .delete(schema.organization)
          .where(sql`${schema.organization.id} = ${organizationId}`);
        if (newlyCreatedSupplierIds.length > 0) {
          await testApp.adminDb
            .delete(schema.organization)
            .where(inArray(schema.organization.id, newlyCreatedSupplierIds));
        }
      } finally {
        await testApp.close();
      }
    }
  }
});
