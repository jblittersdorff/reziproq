import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';
import { lockHollmann } from './hollmann-lock.js';
import { relationshipList } from './relationships.js';

// BZ-01 (K2-b.4): Seite Lieferanten, Linse Liste, gegen die echte API im Demo-Mandanten Hollmann
// (Mo 23.11.2026), als Jan-Luka über die Demo-Sitzung (E-K0-05). T2-01 und T2-02 in der
// Oberfläche, bei 1440 und 390 px ohne seitliches Scrollen; mit UX_SHOTS entstehen Bilder.

test.use({ locale: 'de-DE', colorScheme: 'light' });
// Ein Worker für die ganze Datei: Hollmann hat feste IDs in der gemeinsamen Testdatenbank
test.describe.configure({ mode: 'serial' });

type Database = import('../../../packages/db/src/client.js').Database;
type BrowserTestApp = { adminDb: Database; baseUrl: string; close: () => Promise<void> };

let testApp: BrowserTestApp | undefined;
let unlock: (() => Promise<void>) | undefined;
let apiEnv: { DEMO_SESSIONS: string } | undefined;
let demoSessionsBefore = 'false';

test.beforeAll(async () => {
  test.setTimeout(240_000);
  process.env.NODE_ENV = 'test';
  process.env.ZITADEL_ISSUER = 'https://zitadel.test';
  process.env.ZITADEL_PROJECT_ID = 'test-project';
  const db = await import('../../../packages/db/src/index.js');
  // In die Testdatenbank, nie in die lokale Entwicklungsdatenbank (wie die API-Tests)
  process.env.DATABASE_URL = db.testDatabaseUrl(db.databaseUrl());
  process.env.API_DATABASE_URL = db.testDatabaseUrl(db.apiDatabaseUrl());
  await db.ensureTestDatabase(db.databaseUrl());
  // Hollmann hat feste IDs: Dateien mit Hollmann laufen nacheinander, schon ab dem Einrichten der
  // Rolle (zwei gleichzeitige ALTER ROLE scheitern)
  unlock = await lockHollmann(db);
  await db.ensureApiRole(db.databaseUrl(), db.apiDatabaseUrl());
  const { startTestApp } = (await import(
    new URL('../../api/dist/testing/test-app.js', import.meta.url).href
  )) as { startTestApp: () => Promise<BrowserTestApp> };
  apiEnv = (
    (await import(new URL('../../api/dist/config/env.js', import.meta.url).href)) as {
      env: { DEMO_SESSIONS: string };
    }
  ).env;
  demoSessionsBefore = apiEnv.DEMO_SESSIONS;
  apiEnv.DEMO_SESSIONS = 'true';
  testApp = await startTestApp();
  await db.seedHollmann(testApp.adminDb, { nodeEnv: 'test' });
});

test.afterAll(async () => {
  if (apiEnv) apiEnv.DEMO_SESSIONS = demoSessionsBefore;
  if (!testApp) return;
  try {
    const { hollmann, sql } = await import('../../../packages/db/src/index.js');
    const orgs = (
      await testApp.adminDb.execute<{ id: string }>(
        sql`select app_demo_orgs_von(${hollmann.org.id}::uuid) as id`,
      )
    ).rows.map((row) => row.id);
    await testApp.adminDb.execute(sql`select app_demo_leeren(${hollmann.org.id}::uuid)`);
    if (orgs.length > 0) {
      await testApp.adminDb.execute(sql`delete from organization where id in ${orgs}`);
    }
  } finally {
    await unlock?.();
    await testApp.close();
  }
});

// Anfragen, die beim Ende eines Tests noch laufen (etwa „Als Nächstes“), nicht als Fehler werten
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

/** Jede Anfrage der App geht an die echte API, mit dem Token der Demo-Sitzung aus dem Browser */
async function routeToRealApi(page: Page) {
  await fakeZitadel(page);
  await page.route('**/api/**', async (route) => {
    if (!testApp) throw new Error('Die API für den Test läuft nicht.');
    const url = new URL(route.request().url());
    const postData = route.request().postDataBuffer();
    const response = await route.fetch({
      url: `${testApp.baseUrl}${url.pathname}${url.search}`,
      ...(postData ? { postData } : {}),
      headers: await route.request().allHeaders(),
    });
    await route.fulfill({ response });
  });
}

async function openList(page: Page) {
  await routeToRealApi(page);
  await page.goto('/demo/als/hollmann-jan-luka');
  await expect(page).not.toHaveURL(/\/demo\/als\//);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await page.goto('/beziehungen');
  await expect(page.locator('#inhalt h1')).toHaveText('Lieferanten');
  await expect(relationshipList(page).getByRole('link').first()).toBeVisible();
}

const names = (page: Page) =>
  relationshipList(page)
    .locator('a[href^="/lieferanten/"] b')
    .evaluateAll((items) => items.map((item) => item.firstChild?.textContent?.trim()));

const sideOverflow = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .map(
        (element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 60)}`,
      )
      .slice(-5),
  );

test('T2-01: 16 Beziehungen; nach Aufmerksamkeit stehen Rheintal, Silesia, Kessler oben', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await openList(page);
  await expect(page.locator('#inhalt header')).toContainText(
    /16 Beziehungen · 30,1\sMio\.\s€ Spend 2026 · 46 Lieferanten im Portfolio/,
  );
  await expect(page.getByRole('group', { name: 'Filter' }).getByRole('button')).toHaveText([
    'Alle · 16',
    'Meine · 6',
    'Strategisch · 8',
    'Offene Zusagen · 11',
    'Mehr Filter',
  ]);
  expect((await names(page)).slice(0, 3)).toEqual([
    'Rheintal Elektronik',
    'Silesia Guss',
    'Kessler Präzision',
  ]);
  // Acht Zeilen, die übrigen acht unter „8 weitere Beziehungen“ (Vorlage Lieferanten)
  expect(await names(page)).toHaveLength(8);
  await expect(relationshipList(page).getByRole('button', { name: /8 weitere/ })).toBeVisible();
  const rheintal = relationshipList(page).getByRole('link', { name: /Rheintal Elektronik/ });
  await expect(rheintal).toContainText(
    /Leiterplatten · Deutschland · 4,2\sMio\.\s€ · 1 Zusage überfällig/,
  );
  await expect(relationshipList(page).getByRole('link', { name: /Silesia Guss/ })).toContainText(
    'Liefertreue 86 %',
  );
  await expect(
    relationshipList(page).getByRole('link', { name: /Kessler Präzision/ }),
  ).toContainText('Segment strittig');
  // Das Wichtigste aus belegten Zahlen
  await expect(page.getByRole('region', { name: 'Das Wichtigste' })).toContainText(
    'Bei 2 Beziehungen haltet ihr eure Zusagen deutlich besser als der Lieferant. Pearl River Components, euer größter Lieferant, hat noch kein Segment.',
  );
  expect(await sideOverflow(page)).toEqual([]);
  if (process.env.UX_SHOTS) {
    await page.screenshot({ path: `${process.env.UX_SHOTS}/bz-01-liste-1440.png`, fullPage: true });
  }
});

test('T2-02: Mini-Spiegel Rheintal 90 und 78 %; Pearl River „noch keine Zusagen“', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await openList(page);
  await expect(
    relationshipList(page)
      .getByRole('img', { name: 'Zusagen gehalten: ihr 90 %, Rheintal Elektronik 78 %' })
      .first(),
  ).toBeVisible();
  await expect(
    relationshipList(page).getByRole('link', { name: /Pearl River Components/ }),
  ).toContainText('noch keine Zusagen');
});

test('Mehr Filter: Portfolio zeigt alle 46 Lieferanten (E-K2-10)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await openList(page);
  await page.getByRole('button', { name: 'Mehr Filter' }).click();
  await page
    .getByRole('switch', { name: 'Auch 30 importierte Lieferanten ohne Anbindung zeigen' })
    .click();
  await expect(page).toHaveURL(/portfolio=1/);
  await expect(page.getByRole('button', { name: 'Alle · 46' })).toBeVisible();
});

test('Auf dem Telefon: Segment und Grund in der grauen Zeile, kleiner Spiegel, kein seitliches Scrollen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await openList(page);
  const rheintal = relationshipList(page).getByRole('link', { name: /Rheintal Elektronik/ });
  await expect(rheintal).toContainText('Strategisch · 1 Zusage überfällig');
  await expect(page.locator('#inhalt header')).toContainText(/16 Beziehungen · 30,1\sMio\.\s€/);
  expect(await sideOverflow(page)).toEqual([]);
  if (process.env.UX_SHOTS) {
    await page.screenshot({ path: `${process.env.UX_SHOTS}/bz-01-liste-390.png`, fullPage: true });
  }
});
