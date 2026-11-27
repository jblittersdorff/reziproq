import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';
import { lockHollmann } from './hollmann-lock.js';
import { relationshipList } from './relationships.js';

// AK-01 (K2-c.2): Akte Rheintal, Sicht Gemeinsam, gegen die echte API im Demo-Mandanten Hollmann
// (Mo 23.11.2026), als Jan-Luka über die Demo-Sitzung (E-K0-05). Die Zeile der Liste öffnet die Akte;
// der Umschalter setzt die Adresse (T2-04). Bei 1440 und 390 px ohne seitliches Scrollen; mit
// UX_SHOTS entstehen Bilder.

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

/** Aus der Liste in die Akte von Rheintal */
async function openAkte(page: Page) {
  await routeToRealApi(page);
  await page.goto('/demo/als/hollmann-jan-luka');
  await expect(page).not.toHaveURL(/\/demo\/als\//);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await page.goto('/beziehungen');
  await relationshipList(page)
    .getByRole('link', { name: /Rheintal Elektronik/ })
    .click();
  await expect(page).toHaveURL(/\/beziehungen\/[0-9a-f-]{36}$/);
  await expect(page.locator('#inhalt h1')).toHaveText('Rheintal Elektronik');
  await expect(page.getByRole('region', { name: 'Das Wichtigste' })).toBeVisible();
  // Als Nächstes zu Rheintal (am 23.11. die Erwähnung von Nils Ott)
  await expect(page.locator('[data-slot="next-card"]')).toBeVisible();
}

/** Zeilen je Sicht im Umschalter: die Vorlage A-Lieferant zeigt jede in einer Zeile */
const switchLines = (page: Page) =>
  page
    .getByRole('navigation', { name: 'Sicht auf die Beziehung' })
    .getByRole('link')
    .evaluateAll((links) =>
      links.map((link) => {
        const tops = new Set<number>();
        const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            if (rect.width > 0) tops.add(Math.round(rect.top));
          }
        }
        return tops.size;
      }),
    );

const sideOverflow = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .map(
        (element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 60)}`,
      )
      .slice(-5),
  );

test('Gemeinsam: Kopf, Spiegel 90 zu 78 %, sechs offene Zusagen, Scorecard und rechte Spalte', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await openAkte(page);
  await expect(page.locator('[data-slot="akte-head"]')).toContainText(
    /Strategisch · Leiterplatten · 4,2\sMio\.\s€ Spend 2026 · Lead Sara Ost/,
  );
  await expect(page.getByRole('link', { name: 'Briefing JBP' })).toBeVisible();
  const summary = page.getByRole('region', { name: 'Das Wichtigste' });
  await expect(summary).toContainText(
    'Ihr haltet mehr Zusagen als Rheintal Elektronik. Überfällig ist „8D-Bericht Charge 4711“.',
  );
  await expect(
    summary.getByRole('img', {
      name: 'Gehaltene Zusagen 2026: ihr 90 %, Rheintal Elektronik 78 %',
    }),
  ).toBeVisible();
  const commitments = page.getByRole('region', { name: /Zusagen · 6 offen/ });
  await expect(commitments.getByRole('link')).toHaveCount(6);
  await expect(commitments).toContainText('16 gehaltene Zusagen 2026');
  const card = page.getByRole('region', { name: /Scorecard 2026 · Kennzahlen Oktober/ });
  await expect(card.getByRole('link')).toHaveCount(4);
  await expect(card).toContainText('von beiden Seiten unterschrieben');
  await expect(page.getByRole('region', { name: 'Nächste Wochen' })).toContainText(
    'JBP Rheintal 2027',
  );
  expect(await sideOverflow(page)).toEqual([]);
  if (process.env.UX_SHOTS) {
    await page.screenshot({
      path: `${process.env.UX_SHOTS}/ak-01-gemeinsam-1440.png`,
      fullPage: true,
    });
  }
});

test('T2-04: der Umschalter setzt die Adresse; ?sicht=privat und ?sicht=geteilt zeigen die anderen Sichten', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await openAkte(page);
  const views = page.getByRole('navigation', { name: 'Sicht auf die Beziehung' });
  await views.getByRole('link', { name: /Nur für dich/ }).click();
  await expect(page).toHaveURL(/\?sicht=privat$/);
  await expect(page.getByRole('region', { name: 'Verlauf · nur euer Team' })).toBeVisible();
  await expect(page.locator('[data-slot="private-note"]')).toContainText(
    'Nur für dich und euer Team',
  );
  await views.getByRole('link', { name: /Von Rheintal Elektronik/ }).click();
  await expect(page).toHaveURL(/\?sicht=geteilt$/);
  await expect(page.getByRole('region', { name: /Von Rheintal Elektronik geteilt/ })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\?sicht=privat$/);
  await views.getByRole('link', { name: /Gemeinsam/ }).click();
  await expect(page).toHaveURL(/\/beziehungen\/[0-9a-f-]{36}$/);
});

test('Nur für dich (K2-c.3): Das Wichtigste, Segment, Verlauf mit neuer Notiz und Filter, Beziehungsnetz', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await openAkte(page);
  await page
    .getByRole('navigation', { name: 'Sicht auf die Beziehung' })
    .getByRole('link', { name: /Nur für dich/ })
    .click();
  await expect(page).toHaveURL(/\?sicht=privat$/);
  // Vorlage K2-Akte-Privat: Sätze aus belegten Zahlen (G-6), privat gekennzeichnet
  const summary = page.getByRole('region', { name: 'Das Wichtigste' });
  await expect(summary).toContainText(
    'Rheintal Elektronik steht im Segment „Strategisch“, 25 Punkte über der Grenze. Mit Kim Kaiser und Nils Ott spricht bei euch noch niemand direkt.',
  );
  const segment = page.getByRole('region', { name: 'Segment und Bewertung' });
  await expect(
    segment.getByRole('link', { name: /Strategisch · 25 Punkte über der Grenze/ }),
  ).toBeVisible();
  await expect(segment).toContainText(
    'Bewertungsrunde 2026, eine Bewertung · festgelegt 20.03.2026',
  );
  const network = page.getByRole('region', { name: 'Beziehungsnetz' });
  await expect(network.getByRole('link')).toHaveCount(4);
  await expect(network.getByRole('link', { name: /Preise und Verträge/ })).toContainText(
    'Sara Ost ↔ Tom Weber · quartalsweise · Entscheidet: Kim Kaiser, nur über Tom Weber',
  );
  const history = page.getByRole('region', { name: 'Verlauf · nur euer Team' });
  // Angeheftetes oben, danach das Vergangene; der JBP am 04.12. steht nicht vorn
  await expect(history.locator('[data-slot="disclosure-row"] > button').first()).toContainText(
    'Angeheftet · Jonas Feld',
  );
  await expect(history.getByRole('link', { name: /JBP Rheintal 2027/ })).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  expect(await sideOverflow(page)).toEqual([]);
  if (process.env.UX_SHOTS) {
    await page.screenshot({
      path: `${process.env.UX_SHOTS}/ak-01-privat-1440.png`,
      fullPage: true,
    });
  }
  // „Alles anzeigen“: der Rest nach Monaten, mit der eigenen Notiz „nur du“ und dem JBP im Dezember
  await history.getByRole('button', { name: /Alles anzeigen/ }).click();
  await expect(page.getByRole('button', { name: /Deine Notiz/ })).toContainText(
    '19.11. · nur du · Gespräch mit Tom Weber',
  );
  await expect(
    page
      .getByRole('region', { name: 'Dezember 2026' })
      .getByRole('link', { name: /JBP Rheintal 2027/ }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Mail von Tom Weber/ })).toBeVisible();
  // Neue Notiz „Nur ich“ steht danach im Verlauf
  await history.getByRole('button', { name: 'Neue Notiz' }).click();
  const form = history.getByRole('form', { name: 'Neue Notiz' });
  await form.getByRole('textbox', { name: 'Notiz' }).fill('Kim Kaiser vor dem JBP anrufen');
  await form.getByText('Nur ich', { exact: true }).click();
  await form.getByRole('button', { name: 'Notiz speichern' }).click();
  await expect(
    history.getByRole('button', { name: /Kim Kaiser vor dem JBP anrufen/ }),
  ).toContainText('nur du');
  // Filter Mails: nur noch Mails
  await history.getByRole('button', { name: 'Mails', exact: true }).click();
  await expect(history.getByRole('button', { name: /Angeheftet · Jonas Feld/ })).toHaveCount(0);
  await expect(history.getByRole('button', { name: /Mail von / }).first()).toBeVisible();
});

test('Von Rheintal (K2-c.4): Geteiltes von Rheintal, was Rheintal sieht und nie sieht, Rheintal in Reziproq', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await openAkte(page);
  await page
    .getByRole('navigation', { name: 'Sicht auf die Beziehung' })
    .getByRole('link', { name: /Von Rheintal Elektronik/ })
    .click();
  await expect(page).toHaveURL(/\?sicht=geteilt$/);
  // Vorlage K2-Akte-Geteilt: nur was Rheintal aktiv geteilt hat (E-K0-31), Sätze aus Zahlen (G-6)
  await expect(page.getByRole('region', { name: 'Das Wichtigste' })).toContainText(
    'Rheintal Elektronik hat 2 Kennzahlwerte, 1 Kommentar und 1 Unterschrift mit euch geteilt, zuletzt am 18.11.',
  );
  const shared = page.getByRole('region', { name: /Von Rheintal Elektronik geteilt · 4/ });
  await expect(shared.locator('b')).toHaveText([
    'Kommentar zu „JBP Rheintal 2027“',
    /Oktober/,
    /Oktober/,
    'Scorecard 2026 unterschrieben',
  ]);
  await expect(shared.getByRole('link', { name: /Kommentar zu/ })).toContainText(
    'Nils Ott · 18.11. · „@Jan-Luka',
  );
  await expect(shared.getByRole('link', { name: /Liefertreue Oktober: 94/ })).toContainText(
    'Tom Weber · 04.11.',
  );
  await expect(
    page.getByRole('region', { name: 'Was Rheintal Elektronik nie sieht' }),
  ).toContainText('Beziehungsnetz');
  await expect(
    page.getByRole('region', { name: 'Was Rheintal Elektronik von euch sieht' }),
  ).toContainText('Alles unter Gemeinsam');
  await expect(
    page.getByRole('region', { name: 'Pflichten von Rheintal Elektronik' }),
  ).toContainText('Noch keine geteilten Spielregeln');
  const people = page.getByRole('region', { name: 'Rheintal Elektronik in Reziproq' });
  await expect(people).toContainText('Kim KaiserSponsoraktiv');
  await expect(people).toContainText('noch nicht eingeladen');
  await page.waitForLoadState('networkidle');
  expect(await sideOverflow(page)).toEqual([]);
  if (process.env.UX_SHOTS) {
    await page.screenshot({
      path: `${process.env.UX_SHOTS}/ak-01-geteilt-1440.png`,
      fullPage: true,
    });
  }
});

test('Auf dem Telefon: kurze graue Zeile, Sichten mit kurzem Namen, kein seitliches Scrollen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await openAkte(page);
  await expect(page.locator('[data-slot="akte-head"] p')).toContainText(
    /Strategisch · 4,2\sMio\.\s€/,
  );
  const views = page.getByRole('navigation', { name: 'Sicht auf die Beziehung' });
  // Sichtbar ist der kurze Name; der lange steht ab 761 px
  await expect(views.getByRole('link')).toHaveText(
    ['Gemeinsam', 'Für dich', 'Rheintal Elektronik'],
    {
      useInnerText: true,
    },
  );
  // Ohne Symbole (erst ab 761 px) passt jede Sicht in eine Zeile, wie in der Vorlage A-Lieferant
  expect(await switchLines(page)).toEqual([1, 1, 1]);
  expect(await sideOverflow(page)).toEqual([]);
  if (process.env.UX_SHOTS) {
    await page.screenshot({
      path: `${process.env.UX_SHOTS}/ak-01-gemeinsam-390.png`,
      fullPage: true,
    });
  }
  await views.getByRole('link', { name: 'Für dich' }).click();
  await expect(page).toHaveURL(/\?sicht=privat$/);
  await expect(page.locator('[data-slot="private-note"]')).toBeVisible();
  expect(await switchLines(page)).toEqual([1, 1, 1]);
  expect(await sideOverflow(page)).toEqual([]);
  if (process.env.UX_SHOTS) {
    await page.screenshot({ path: `${process.env.UX_SHOTS}/ak-01-privat-390.png`, fullPage: true });
  }
  await views.getByRole('link', { name: 'Rheintal Elektronik' }).click();
  await expect(page).toHaveURL(/\?sicht=geteilt$/);
  await expect(page.getByRole('region', { name: /Von Rheintal Elektronik geteilt/ })).toBeVisible();
  expect(await switchLines(page)).toEqual([1, 1, 1]);
  expect(await sideOverflow(page)).toEqual([]);
  if (process.env.UX_SHOTS) {
    await page.screenshot({
      path: `${process.env.UX_SHOTS}/ak-01-geteilt-390.png`,
      fullPage: true,
    });
  }
});
