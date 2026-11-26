import { expect, type Page, test } from '@playwright/test';
import {
  businessTimeHeader,
  type DemoRegie,
  type DemoSession,
  defaultAiSettings,
} from '@reziproq/shared';
import { signIn } from './route-walk.js';
import { mockToday } from './today-fixture.js';

// DM-01, E-K0-05 (K1-b.2): Demo-Sitzung je Person im Browser. /demo/als/<Person> startet die Sitzung
// ohne Zitadel; nach dem Neuladen trägt jede Anfrage das Token der Demo-Sitzung, und die App öffnet
// die Startseite der Person. Die Sitzung gilt nur in diesem Tab. K1-b.5: Die Fachzeit der Demo-Uhr
// gilt schon für das erste Bild nach dem Einstieg und nie ohne Demo-Sitzung. K1-g.4: ⌥D öffnet in
// einer Demo-Sitzung die Demo-Regie; Uhr, Modus und Zurücksetzen gehen mit der Tastatur. Bei 390 und
// 1440 px ohne seitliches Scrollen; mit UX_SHOTS entstehen Bilder (Einstieg, Heute,
// KI-Einstellungen, Regie).

test.use({ locale: 'de-DE', colorScheme: 'light' });

const sideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const shot = async (page: Page, name: string) => {
  if (process.env.UX_SHOTS) {
    await page.screenshot({ path: `${process.env.UX_SHOTS}/${name}.png`, fullPage: true });
  }
};

const session: DemoSession = {
  accessToken: 'demo-e2e-token',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  person: {
    id: 'jan-luka',
    name: 'Jan-Luka',
    orgId: '550e8400-e29b-41d4-a716-446655440001',
    orgName: 'Nordwind Antriebe',
    orgRole: 'member',
    buyer: true,
  },
};

test('Demo-Sitzung: ohne Zitadel angemeldet, jede Anfrage mit dem Token der Demo-Sitzung', async ({
  page,
  context,
}) => {
  await signIn(page, { locale: 'de' });
  await page.route('**/api/demo/sitzung', (route) => route.fulfill({ json: session }));
  const tokens: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/me') {
      tokens.push(request.headers().authorization ?? '');
    }
  });
  await page.goto('/demo/als/jan-luka');
  await expect(page).not.toHaveURL(/\/demo\/als\//);
  await expect.poll(() => tokens.length).toBeGreaterThan(0);
  expect(new Set(tokens)).toEqual(new Set(['Bearer demo-e2e-token']));
  // Ein neuer Tab hat keine Demo-Sitzung
  const other = await context.newPage();
  await other.goto('/heute');
  expect(
    await other.evaluate(() => window.sessionStorage.getItem('reziproq.demo-sitzung')),
  ).toBeNull();
});

for (const width of [390, 1440]) {
  test(`Demo-Sitzung: Heute rechnet nach dem Einstieg sofort mit der Demo-Uhr, ${width} px (K1-b.5)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, { locale: 'de' });
    await page.route('**/api/demo/sitzung', (route) =>
      route.fulfill({
        json: session,
        headers: { [businessTimeHeader]: '2026-11-23T06:30:00.000Z' },
      }),
    );
    // Inhalt von Heute aus den Vorlagen, damit das Bild die ganze Seite zeigt
    await mockToday(page);
    await page.goto('/demo/als/jan-luka');
    await expect(page).not.toHaveURL(/\/demo\/als\//);
    // Keine andere Antwort nennt hier eine Fachzeit: Nach dem Neuladen beim Einstieg kommt sie aus
    // dem Tab. Die Person der nachgestellten API startet auf Wert; Heute mit erneutem Neuladen.
    await page.goto('/heute');
    await expect(page.getByText(/^Montag, 23\. November · /)).toBeVisible();
    expect(await sideScroll(page)).toBe(0);
    await shot(page, `heute-demo-${width}`);
  });

  test(`Einstieg ohne Demo-Person sagt, warum es keine Sitzung gibt, ${width} px (K1-b.2)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    // Ohne nachgestellte Sitzung antwortet /api/demo/sitzung mit 404
    await signIn(page, { locale: 'de' });
    await page.goto('/demo/als/unbekannt');
    await expect(page.getByText('Keine Demo-Sitzung')).toBeVisible();
    expect(await sideScroll(page)).toBe(0);
    await shot(page, `demo-einstieg-${width}`);
  });

  test(`KI-Einstellungen im Demo-Mandanten: Antworten mit der Tastatur umschalten, ${width} px (K1-b.1)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await signIn(page, { locale: 'de' });
    await page.route('**/api/einstellungen/ki', (route) =>
      route.fulfill({
        json: {
          settings: defaultAiSettings,
          euOnly: true,
          canEdit: true,
          demo: { mode: 'replay' },
        },
      }),
    );
    await page.route('**/api/ki/kontingent', (route) =>
      route.fulfill({
        json: {
          month: '2026-11',
          budgetMonthCents: 15000,
          usedCents: 2400,
          calls: 12,
          byFeature: [],
        },
      }),
    );
    await page.route('**/api/einstellungen/termin-briefing', (route) =>
      route.fulfill({ json: { leadDays: {} } }),
    );
    const modes: unknown[] = [];
    await page.route('**/api/einstellungen/ki/modus', (route) => {
      modes.push(route.request().postDataJSON());
      return route.fulfill({ json: { mode: 'live' } });
    });
    await page.goto('/einstellungen/ki');
    await expect(page.getByText('Antworten im Demo-Mandanten')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Abspielen' })).toBeChecked();
    expect(await sideScroll(page)).toBe(0);
    await page.getByText('Antworten im Demo-Mandanten').scrollIntoViewIfNeeded();
    await shot(page, `ki-demo-${width}`);
    await page.getByRole('radio', { name: 'Abspielen' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Live' })).toBeChecked();
    await expect.poll(() => modes).toEqual([{ mode: 'live' }]);
  });
}

// K1-g.4: Stand der Regie wie nach pnpm demo:nordwind; jede Aktion antwortet mit dem neuen Stand
const regie: DemoRegie = { demoNow: '2026-11-23T06:30:00.000Z', mode: 'replay', runs: [] };

async function mockRegie(page: Page) {
  const actions: { method: string; path: string; body: unknown }[] = [];
  let state = regie;
  await page.route(
    (url) => url.pathname.startsWith('/api/demo/regie'),
    (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() !== 'GET') {
        actions.push({ method: request.method(), path, body: request.postDataJSON() });
      }
      if (path === '/api/demo/regie/zeit') {
        state = {
          ...state,
          demoNow: '2026-11-24T05:00:00.000Z',
          runs: [
            { key: 'briefing', at: '2026-11-24T05:00:00.000Z' },
            { key: 'triage', at: '2026-11-24T05:00:00.000Z' },
          ],
        };
      } else if (path === '/api/demo/regie/modus') {
        state = { ...state, mode: request.postDataJSON().mode };
      } else if (path === '/api/demo/regie/zuruecksetzen') {
        state = { ...regie, mode: state.mode };
      }
      return route.fulfill({ json: state, headers: { [businessTimeHeader]: state.demoNow } });
    },
  );
  return actions;
}

for (const width of [390, 1440]) {
  test(`Demo-Regie: ⌥D öffnet sie, Uhr, Modus und Zurücksetzen mit der Tastatur, ${width} px (K1-g.4)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, { locale: 'de' });
    await page.route('**/api/demo/sitzung', (route) =>
      route.fulfill({
        json: { ...session, person: { ...session.person, id: 'nordwind-jan-luka' } },
        headers: { [businessTimeHeader]: regie.demoNow },
      }),
    );
    const actions = await mockRegie(page);
    await page.goto('/demo/als/nordwind-jan-luka');
    await expect(page).not.toHaveURL(/\/demo\/als\//);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await page.keyboard.press('Alt+KeyD');
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Demo-Regie' })).toBeVisible();
    await expect(page.getByText('Mo 23.11., 07:30', { exact: true })).toBeVisible();
    const role = page.getByRole('region', { name: 'Rolle' });
    await expect(role.getByRole('link', { name: 'Jan-Luka · SRO' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(await sideScroll(page)).toBe(0);
    await shot(page, `demo-regie-${width}`);

    await page.getByRole('button', { name: 'Neuer Tag (06:00-Lauf)' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Uhr auf Di 24.11., 06:00, 2 Läufe ausgeführt.')).toBeVisible();

    await page.getByRole('radio', { name: 'Abspielen' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Live' })).toBeChecked();

    // Zurücksetzen fragt auf der Seite nach; der Fokus steht auf Abbrechen, davor steht Ja
    await page.getByRole('button', { name: 'Zurücksetzen' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Abbrechen' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Ja, zurücksetzen' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Zurückgesetzt auf Mo 23.11., 07:30.')).toBeVisible();
    expect(await sideScroll(page)).toBe(0);
    expect(actions).toEqual([
      { method: 'POST', path: '/api/demo/regie/zeit', body: { aktion: 'neuer_tag' } },
      { method: 'PUT', path: '/api/demo/regie/modus', body: { mode: 'live' } },
      { method: 'POST', path: '/api/demo/regie/zuruecksetzen', body: {} },
    ]);
  });
}

test('Ohne Demo-Sitzung öffnet ⌥D nichts, und /demo sagt, dass es die Regie nur im Demo-Mandanten gibt (K1-g.4)', async ({
  page,
}) => {
  await signIn(page, { locale: 'de' });
  await page.goto('/heute');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await page.keyboard.press('Alt+KeyD');
  await expect(page).toHaveURL(/\/heute$/);
  // Die API kennt die Regie außerhalb des Demo-Mandanten nicht (404)
  await page.goto('/demo');
  await expect(page.getByText('Die Demo-Regie gibt es nur im Demo-Mandanten.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zurücksetzen' })).toHaveCount(0);
});

test('Ohne Demo-Sitzung gilt die Uhr des Browsers, auch wenn im Tab noch eine Fachzeit steht (K1-b.5)', async ({
  page,
}) => {
  await signIn(page, { locale: 'de' });
  await page.goto('/heute');
  await page.evaluate(() =>
    window.sessionStorage.setItem('reziproq.fachzeit', String(-3 * 86_400_000)),
  );
  await page.goto('/heute');
  const today = await page.evaluate(() =>
    new Intl.DateTimeFormat('de', { weekday: 'long', day: 'numeric', month: 'long' }).format(
      new Date(),
    ),
  );
  await expect(page.getByText(new RegExp(`^${today} · `))).toBeVisible();
  expect(await page.evaluate(() => window.sessionStorage.getItem('reziproq.fachzeit'))).toBeNull();
});
