import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// DM-01, Drehbuch K1 „Morgen mit Reziproq“ (K1-g.5) als E2E-Test gegen die echte API im
// Demo-Mandanten Hollmann. Einstieg über die Demo-Sitzung (E-K0-05), jede Handlung über die
// Oberfläche, die Regie über ⌥D. Das Drehbuch startet nach „Zurücksetzen“ und läuft im Modus
// Abspielen zweimal hintereinander gleich (T1-DM3). Die Schritte 5 bis 7 und die Scorecard mit
// Herkunft in Schritt 4 folgen mit K4 (Entscheidung des Gründers vom 26.11.2026).

test.use({
  locale: 'de-DE',
  colorScheme: 'light',
  viewport: { width: 1440, height: 1000 },
  // Ohne eigene Grenze wartet eine Aktion bis zum Ende des Tests und nennt den Schritt nicht
  actionTimeout: 15_000,
});
// Ein Worker für die ganze Datei: Hollmann hat feste IDs in der gemeinsamen Testdatenbank
test.describe.configure({ mode: 'serial' });

type Database = import('../../../packages/db/src/client.js').Database;
type BrowserTestApp = { adminDb: Database; baseUrl: string; close: () => Promise<void> };

let testApp: BrowserTestApp | undefined;
let apiEnv: { DEMO_SESSIONS: string } | undefined;
let demoSessionsBefore = 'false';

test.beforeAll(async () => {
  test.setTimeout(180_000);
  process.env.NODE_ENV = 'test';
  process.env.ZITADEL_ISSUER = 'https://zitadel.test';
  process.env.ZITADEL_PROJECT_ID = 'test-project';
  const db = await import('../../../packages/db/src/index.js');
  // In die Testdatenbank, nie in die lokale Entwicklungsdatenbank (wie die API-Tests)
  process.env.DATABASE_URL = db.testDatabaseUrl(db.databaseUrl());
  process.env.API_DATABASE_URL = db.testDatabaseUrl(db.apiDatabaseUrl());
  await db.ensureTestDatabase(db.databaseUrl());
  await db.ensureApiRole(db.databaseUrl(), db.apiDatabaseUrl());
  const { startTestApp } = (await import(
    new URL('../../api/dist/testing/test-app.js', import.meta.url).href
  )) as { startTestApp: () => Promise<BrowserTestApp> };
  // Demo-Sitzungen nur mit Schalter (nie im Betrieb); die API liest ihn bei jeder Anfrage
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
    await testApp.close();
  }
});

/** Jede Anfrage der App geht an die echte API, mit dem Token der Demo-Sitzung aus dem Browser */
async function useRealApi(page: Page) {
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

// Mit UX_SHOTS entstehen Bilder der Stände im ersten Durchlauf
let shots = false;
const shot = async (page: Page, name: string) => {
  if (shots && process.env.UX_SHOTS) {
    await page.screenshot({
      path: `${process.env.UX_SHOTS}/drehbuch-k1-${name}.png`,
      fullPage: true,
    });
  }
};

const regie = async (page: Page) => {
  await page.keyboard.press('Alt+KeyD');
  await expect(page.getByRole('heading', { level: 1, name: 'Demo-Regie' })).toBeVisible();
};

async function signInAs(page: Page, person: string) {
  await page.goto(`/demo/als/${person}`);
  await expect(page).not.toHaveURL(/\/demo\/als\//);
  // Erst die Startseite der Person, dann steht auch die Shell mit ⌥D
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
}

async function startState(page: Page) {
  // Schritt 1 und 10: Heute mit drei Fokus-Themen, vier Entwürfen, 14 Vorgängen im Hintergrund
  await expect(page).toHaveURL(/\/heute$/);
  await expect(page.getByText(/^Montag, 23\. November · /)).toBeVisible();
  await expect(page.getByRole('link', { name: /^Heute/ }).first()).toContainText('3');
  await expect(page.getByText('Kurz prüfen · 4 Entwürfe', { exact: false })).toBeVisible();
  await expect(page.getByText('Erledigt im Hintergrund · 14')).toBeVisible();
}

async function morning(page: Page) {
  // Schritt 1: Anmelden als Jan-Luka, Heute öffnet
  await signInAs(page, 'hollmann-jan-luka');
  await startState(page);
  await shot(page, '1-heute');

  // Schritt 2: Erledigt mit 14 Vorgängen und der Mail von Nils Ott
  await page.getByText('Erledigt im Hintergrund · 14').click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Erledigt im Hintergrund' }),
  ).toBeVisible();
  await expect(page.getByText(/^14 Vorgänge seit gestern 18:00/)).toBeVisible();
  const nils = page
    .locator('[data-slot="row"]')
    .filter({ hasText: 'Mail von Nils Ott der Beziehung Rheintal Elektronik zugeordnet' });
  await expect(nils).toHaveCount(1);
  await shot(page, '2-erledigt');

  // Schritt 3: zurücknehmen; die Mail steht wieder in Heute, Ansicht Alles, Gruppe „Zuordnen“
  await nils.getByRole('button', { name: 'Zurücknehmen' }).click();
  await expect(nils.getByText('zurückgenommen')).toBeVisible();
  await page.goto('/heute?ansicht=alles');
  const assign = page.getByRole('region', { name: 'Zuordnen · 1' });
  await expect(assign.getByText('Vorschlag: Rheintal Elektronik')).toBeVisible();
  await expect(assign.getByText('in Kurz prüfen')).toBeVisible();
  await assign.scrollIntoViewIfNeeded();
  await shot(page, '3-alles');

  // Schritt 4: Kurz prüfen, Durchgehen: vier übernehmen, einen mit Grund verwerfen
  await page.goto('/heute');
  await page.getByRole('link', { name: 'Durchgehen' }).click();
  await expect(page.getByText('Entwurf 1 von 5')).toBeVisible();
  const titles: string[] = [];
  for (let index = 1; index <= 5; index += 1) {
    await expect(page.getByText(`Entwurf ${index} von 5`)).toBeVisible();
    const title = (await page.getByRole('heading', { level: 2 }).first().textContent()) ?? '';
    titles.push(title);
    await shot(page, `4-karte-${index}`);
    if (title.startsWith('Prognose ab Januar')) {
      await page.getByRole('button', { name: 'Verwerfen' }).click();
      await page.getByLabel('Warum passt der Entwurf nicht?').fill('Passt nicht zum JBP');
      await page.locator('form').getByRole('button', { name: 'Verwerfen' }).click();
    } else {
      await page.getByRole('button', { name: 'Übernehmen' }).click();
    }
  }
  await expect(page.getByText('Alles geprüft. 4 von 5 übernommen.')).toBeVisible();
  // Die vier Entwürfe aus dem Seed und die zurückgenommene Mail von Nils Ott
  expect(titles.slice(0, 4)).toEqual([
    'Briefing JBP: 3 Ziele',
    'Liefertreue Oktober: 94 % übernehmen',
    'Prognose ab Januar monatlich an Rheintal teilen',
    'Zusage zur Lücke Transparenz: Kostenaufschlüsselung bis 11.12.',
  ]);
  expect(titles[4]).toMatch(/^Mail zuordnen/);
  await shot(page, '4-geprueft');

  // Schritte 5 bis 7 folgen mit K4 (siehe test.fixme unten)

  // Schritt 8: Postfach auf Vorbereiten, Signal „Mail von Kim Kaiser“ landet in Kurz prüfen
  await page.goto('/mein-agent');
  const inbox = page.getByRole('group', { name: 'Wie viel Reziproq bei „Postfach“ selbst tut' });
  // Der Radioknopf ist nur für Screenreader da; geklickt wird die Pille
  await inbox.getByText('Vorbereiten', { exact: true }).click();
  await expect(inbox.getByRole('radio', { name: 'Vorbereiten' })).toBeChecked();
  await regie(page);
  await page.getByRole('button', { name: 'Mail von Kim Kaiser' }).click();
  await expect(
    page.getByText('Mail von Kim Kaiser ist da: Die Zuordnung wartet in Kurz prüfen.'),
  ).toBeVisible();
  await page.goto('/kurz-pruefen');
  await expect(
    page.getByRole('heading', { level: 2, name: /Musterteile Starrflex und 8D 4711/ }),
  ).toBeVisible();
  // Grund ist die Stufe Vorbereiten, kein fehlender Zugriff
  await expect(
    page.getByText(/Auf Stufe Vorbereiten legt das Postfach Mails nicht selbst ab/),
  ).toBeVisible();
  await shot(page, '8-kurz-pruefen');
  // Statt in Erledigt: dort steht die Mail von Nils Ott (zurückgenommen), aber keine von Kim Kaiser
  await page.goto('/erledigt');
  await expect(nils.getByText('zurückgenommen')).toBeVisible();
  await expect(page.locator('[data-slot="row"]').filter({ hasText: 'Kim Kaiser' })).toHaveCount(0);

  // Schritt 9: Rolle Sara Ost, sie landet auf Wert
  await regie(page);
  await page.getByRole('link', { name: 'Sara Ost · Lead' }).click();
  await expect(page).toHaveURL(/\/wert$/);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await shot(page, '9-wert');

  // Schritt 10: Zurücksetzen, danach der Stand von Schritt 1
  await regie(page);
  await page.getByRole('button', { name: 'Zurücksetzen' }).click();
  await page.getByRole('button', { name: 'Ja, zurücksetzen' }).click();
  await expect(page.getByText('Zurückgesetzt auf Mo 23.11., 07:30.')).toBeVisible();
  await signInAs(page, 'hollmann-jan-luka');
  await startState(page);
}

test('Drehbuch K1 „Morgen mit Reziproq“: Schritte 1 bis 4 und 8 bis 10, zweimal hintereinander gleich', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await useRealApi(page);
  // Das Drehbuch startet nach „Zurücksetzen“
  await signInAs(page, 'hollmann-jan-luka');
  await regie(page);
  await expect(page.getByRole('radio', { name: 'Abspielen' })).toBeChecked();
  await page.getByRole('button', { name: 'Zurücksetzen' }).click();
  await page.getByRole('button', { name: 'Ja, zurücksetzen' }).click();
  await expect(page.getByText('Zurückgesetzt auf Mo 23.11., 07:30.')).toBeVisible();
  for (const round of [1, 2]) {
    shots = round === 1;
    await test.step(`Durchlauf ${round}`, () => morning(page));
  }
});

test.fixme('Drehbuch K1, Schritte 5 bis 7: Mappe, Warum und Eilabruf Rheintal (folgt mit K4)', () => {
  // Schritt 5: Mappe „Wertpotenzial fürs JBP“, Warum mit 4,2 Mio. € × 1,5 % = 63 T€ (K4-a)
  // Schritt 6: „Als Thema übernehmen“, an „Heute“ steht 2 (K4-a)
  // Schritt 7: Regie: Signal „Eilabruf Rheintal“, Warum zeigt 24 Eilabrufe (K4-d, WK-01)
});
