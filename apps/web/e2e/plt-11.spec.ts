import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Tests zu docs/specs/PLT-11.md, die einen echten Browser brauchen: globale Leiste, Maße,
// Tastatur, Zurück-Knopf des Browsers und Menüseite.

test.use({ locale: 'de-DE' });

// NAV-10 2.0: vier Hauptpunkte, Mein Agent und die Person; Frag Reziproq ist ein Knopf für die
// Überlagerung (plt-12.spec.ts).
const barTargets = [
  { name: 'Heute', path: '/heute' },
  { name: 'Beziehungen', path: '/beziehungen' },
  { name: 'Warengruppen', path: '/warengruppen' },
  { name: 'Wert', path: '/wert' },
  { name: 'Mein Agent', path: '/mein-agent' },
  { name: 'Profil', path: '/profil' },
];

/** Alle Routen dieser Spec mit Titel (h1) und, wo vorhanden, leerem Zustand. */
const routes = [
  { path: '/heute', title: 'Heute' },
  { path: '/beziehungen', title: 'Beziehungen', empty: 'Noch keine Lieferanten.' },
  { path: '/portfolio', title: 'Matrix' },
  // AW-01: die frühere Wirkungsübersicht liegt unter Übersicht · Ergebnisse
  { path: '/uebersicht/ergebnisse', title: 'Ergebnisse', empty: 'Noch keine Ergebnisse' },
  { path: '/profil', title: 'Profil' },
  { path: '/einstellungen', title: 'Einstellungen' },
  { path: '/einstellungen/organisation', title: 'Organisation' },
  { path: '/menu', title: 'Menü' },
];

/**
 * Nachgebauter Login über ein Zitadel, das sofort zurückleitet, dazu die API-Aufrufe.
 * Die Einzelheiten des Ablaufs mit PKCE prüft plt-01.spec.ts.
 */
async function signIn(page: Page, { admin = false } = {}) {
  const zitadel = await fakeZitadel(page);
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Anna Schmidt',
        firstName: 'Anna',
        email: 'anna.schmidt@beispiel-einkauf.de',
        organization: { id: 'org-1', name: 'Beispiel-OEM (Demo)' },
        supportView: false,
        orgRole: admin ? 'admin' : 'member',
        permissions: {
          viewOrganizationSettings: true,
          viewSuppliers: true,
          switchCustomer: false,
        },
      },
    }),
  );
  // Was die Person darf, aus can() im Backend (PLT-05).
  await page.route('**/api/me/permissions', (route) =>
    route.fulfill({
      json: {
        actions: admin
          ? ['organisation.sehen', 'rollen.aendern', 'einstellungen.verwalten', 'lieferanten.sehen']
          : ['organisation.sehen', 'lieferanten.sehen'],
      },
    }),
  );
  await page.route('**/api/suppliers', (route) =>
    route.fulfill({ json: { suppliers: [], count: 0, totalSpend: [], spendYear: 2025 } }),
  );
  await page.route('**/api/organisation', (route) =>
    route.fulfill({
      json: {
        name: 'Beispiel-OEM (Demo)',
        country: 'DE',
        members: [{ name: 'Anna Schmidt', email: 'anna.schmidt@beispiel-einkauf.de' }],
      },
    }),
  );
  await page.route('**/api/start', (route) =>
    route.fulfill({
      json: {
        due: { items: [], total: 0 },
        relationships: { items: [], total: 0 },
        nextMeeting: null,
        portfolio: null,
        openActions: 0,
      },
    }),
  );
  // NAV-10 1.1: Mein Tag mit einer Aufgabe, damit „Als Nächstes“ erscheint
  const today = new Date().toISOString().slice(0, 10);
  await page.route('**/api/start/mein-tag', (route) =>
    route.fulfill({
      json: {
        today,
        next: {
          scope: 'global',
          item: {
            id: 'task-1',
            kind: 'validation',
            supplier: 'Rheintal',
            detail: 'Preis Leiterplatten',
            dueDate: today,
            href: '/wirkung/freigaben',
          },
          overdueDays: 0,
          minutes: 2,
        },
        todayItems: [],
        week: [],
        total: 1,
        doneToday: 0,
        prepared: [],
        preparedTotal: 0,
        waiting: [],
        waitingTotal: 0,
        timeline: [],
        hints: null,
      },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  return zitadel;
}

/**
 * Wartet, bis die Seite im Rahmen fertig ist: Die Überschrift steht im Inhaltsbereich (#inhalt)
 * und es laufen keine Anfragen mehr. Vorher steht seit PLT-01 kurz „Anmeldung wird geprüft“.
 */
async function pageSettled(page: Page) {
  await expect(page.locator('#inhalt h1')).toBeVisible();
  await page.waitForLoadState('networkidle');
}

/** Ausgangsseiten für den Test der Hauptnavigation: Start, Lieferanten, Einstellungen */
const barSources = ['/heute', '/beziehungen', '/einstellungen'];
const bar = (page: Page) => page.getByRole('navigation', { name: 'Hauptnavigation' });
const tabs = (page: Page) => page.getByRole('navigation', { name: 'Tab-Leiste' });
const url = (path: string) => `http://localhost:5174${path}`;

/** Alle sichtbaren Klickflächen, die kleiner als 44 × 44 px sind. */
async function tooSmallTargets(page: Page) {
  return page.evaluate(() => {
    const selector = 'a[href], button, label:has(> input[type="radio"])';
    return [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        // Unsichtbare Elemente (z. B. der Sprung-Link, bevor er Fokus hat) zählen nicht.
        return style.visibility !== 'hidden' && box.width > 1 && box.height > 1;
      })
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width < 44 || box.height < 44;
      })
      .map((element) => {
        const box = element.getBoundingClientRect();
        const label = element.getAttribute('aria-label') ?? element.textContent?.trim();
        return `${label}: ${Math.round(box.width)} × ${Math.round(box.height)}`;
      });
  });
}

test('Nach dem Login landet der Nutzer auf Heute (TN-06)', async ({ page }) => {
  const zitadel = await signIn(page);
  zitadel.session.active = false;
  await page.goto('/');
  await expect(page.getByText('Zitadel-Login')).toBeVisible();

  // Zitadel bestätigt die Anmeldung und leitet mit Code und State zurück.
  zitadel.session.active = true;
  const state = zitadel.authorizeRequests[0]?.get('state');
  await page.goto(`/auth/callback?code=code-1&state=${state}`, { waitUntil: 'commit' });
  await expect(page).toHaveURL(url('/heute'));
  await expect(
    page.locator('#inhalt').getByRole('heading', { level: 1, name: 'Heute' }),
  ).toBeVisible();
  await expect(
    page.locator('#inhalt').getByText(/· Guten (Morgen|Tag|Abend), Anna\.$/),
  ).toBeVisible();
});

test('Jedes Ziel der globalen Leiste ist von jeder Seite mit einem Klick erreichbar. Die aktive Seite ist markiert.', async ({
  page,
}) => {
  // Die Leiste ist auf jeder Seite derselbe Baustein (AppShell); drei Ausgangsseiten aus
  // verschiedenen Bereichen genügen, statt zehn Seiten mal sechs Ziele (39 s).
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  for (const from of routes.filter((route) => barSources.includes(route.path))) {
    for (const target of barTargets) {
      await page.goto(from.path);
      await expect(page.locator('#inhalt h1')).toBeVisible({ timeout: 15_000 });
      await bar(page).getByRole('link', { name: target.name, exact: true }).click();
      await expect(page).toHaveURL(url(target.path));
      await expect(bar(page).getByRole('link', { name: target.name, exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(bar(page).locator('[aria-current="page"]')).toHaveCount(1);
    }
  }
});

test.describe('Bei 390 px Breite', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Bei 390 px Breite gibt es keine waagerechte Scrollleiste, und das Menü öffnet sich als eigene Seite', async ({
    page,
  }) => {
    await signIn(page, { admin: true });
    for (const route of routes) {
      await page.goto(route.path);
      await pageSettled(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `waagerechte Scrollleiste auf ${route.path}`).toBe(0);
      // Bis 760 px die Tab-Leiste mit fünf Zielen statt der Seitenleiste (NAV-10 2.0, TN-02)
      // Frag ist ein Knopf für die Überlagerung, die anderen sind Links.
      await expect(tabs(page).locator('a, button')).toHaveText([
        'Heute',
        'Beziehungen',
        'Frag',
        'Warengruppen',
        'Wert',
      ]);
      for (const target of await tabs(page).locator('a, button').all()) {
        await expect(target).toBeInViewport();
      }
    }
    await tabs(page).getByRole('link', { name: 'Heute' }).click();
    await expect(page).toHaveURL(url('/heute'));
  });
});

test('Jede Route lässt sich über ihre Adresse direkt öffnen und zeigt Titel und leeren Zustand', async ({
  page,
}) => {
  await signIn(page, { admin: true });
  for (const route of routes) {
    await page.goto(route.path);
    await expect(
      page.locator('#inhalt').getByRole('heading', { level: 1, name: route.title }),
    ).toBeVisible();
    if (route.empty) await expect(page.locator('#inhalt').getByText(route.empty)).toBeVisible();
  }
  // TN-07: Die alten Adressen leiten weiter (NAV-10 2.0).
  for (const [from, to] of [
    ['/start', '/heute'],
    ['/mein-tag', '/heute'],
    ['/uebersicht', '/wert'],
    ['/wirkung', '/wert'],
    ['/lieferanten', '/beziehungen'],
    ['/agenten', '/mein-agent'],
  ]) {
    await page.goto(from ?? '');
    await expect(page).toHaveURL(url(to ?? ''));
  }
});

test('Drei Ebenen hin und zurück, mit Zurück-Pfeil und mit Browser-Zurück, auch nach Speichern und Abbrechen', async ({
  page,
}) => {
  await signIn(page, { admin: true });
  const path = page.getByRole('navigation', { name: 'Pfad' });
  const levels = ['/heute', '/profil', '/einstellungen', '/einstellungen/organisation'];

  const goDown = async () => {
    await page.goto('/heute');
    await pageSettled(page);
    await bar(page).getByRole('link', { name: 'Profil', exact: true }).click();
    await page.getByRole('link', { name: 'Alle Einstellungen' }).click();
    await page.getByRole('link', { name: /^Organisation/ }).click();
    await expect(page).toHaveURL(url(levels[3] ?? ''));
    await expect(path).toContainText('Profil');
    await expect(path).toContainText('Einstellungen');
  };

  // Mit dem Zurück-Pfeil eine Ebene nach der anderen nach oben.
  await goDown();
  await path.getByRole('link', { name: 'Zurück zu Einstellungen' }).click();
  await expect(page).toHaveURL(url('/einstellungen'));
  await path.getByRole('link', { name: 'Zurück zu Profil' }).click();
  await expect(page).toHaveURL(url('/profil'));
  await expect(path).toHaveCount(0);

  // Mit dem Zurück-Knopf des Browsers dieselben Ebenen zurück.
  await goDown();
  for (const level of [...levels].reverse().slice(1)) {
    await page.goBack();
    await expect(page).toHaveURL(url(level));
    await expect(page.locator('#inhalt h1')).toBeVisible();
  }

  // Speichern und Abbrechen führen zur vorigen Ansicht (Formularseite Sprache).
  await page.route('**/api/me/sprache', (route) => route.fulfill({ status: 204 }));
  for (const button of ['Speichern', 'Abbrechen']) {
    await page.goto('/profil');
    await pageSettled(page);
    await page.getByRole('link', { name: /^Sprache/ }).click();
    await expect(page).toHaveURL(url('/profil/sprache'));
    // Abbrechen verwirft die Wahl English; Speichern behält Deutsch.
    if (button === 'Abbrechen') await page.getByText('English', { exact: true }).click();
    await page.getByRole('button', { name: button }).click();
    await expect(page).toHaveURL(url('/profil'));
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  }
});

test('Der Weg zu allen Einstellungen auf /profil ist nur für Admins sichtbar. Jedes Mitglied sieht den Weg zu Einstellungen › Organisation.', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/profil');
  await pageSettled(page);
  await expect(page.getByRole('link', { name: /^Organisation/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Alle Einstellungen' })).toHaveCount(0);

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await signIn(page, { admin: true });
  await page.goto('/profil');
  await pageSettled(page);
  await expect(page.getByRole('link', { name: /^Organisation/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Alle Einstellungen' })).toBeVisible();
});

for (const width of [1440, 390]) {
  test(`Alle Klickflächen sind mindestens 44 × 44 px groß (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, { admin: true });
    for (const route of routes) {
      await page.goto(route.path);
      await pageSettled(page);
      expect(await tooSmallTargets(page), route.path).toEqual([]);
    }
  });
}

test('Alles ist per Tastatur bedienbar, mit sichtbarem Fokus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/heute');
  await pageSettled(page);

  // Seitenleiste von oben: Logo, Frag Reziproq, vier Hauptpunkte, Mein Agent, Einstellungen,
  // Person; danach der Knopf der Karte „Als Nächstes“.
  const expected = [
    'Zum Inhalt springen',
    'Reziproq',
    'Frag Reziproq',
    'Heute',
    'Beziehungen',
    'Warengruppen',
    'Wert',
    'Mein Agent',
    'Einstellungen',
    'Profil',
    'Rheintal',
  ];
  const visited: string[] = [];
  for (const _ of expected) {
    await page.keyboard.press('Tab');
    // Fokusring erst nach dem Übergang messen.
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    const focused = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement;
      const style = getComputedStyle(element);
      const ring = style.boxShadow !== 'none' || style.outlineStyle !== 'none';
      return {
        name: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '',
        ring,
      };
    });
    expect(focused.ring, `sichtbarer Fokus auf „${focused.name}“`).toBe(true);
    visited.push(focused.name);
  }
  expected.forEach((name, index) => {
    expect(visited[index]?.startsWith(name), `${index}: ${visited[index]}`).toBe(true);
  });

  // Enter auf „Frag Reziproq“ öffnet die Überlagerung, Esc schließt sie; Profil und Formular
  // gehen ebenso per Tastatur.
  await bar(page).getByRole('button', { name: 'Frag Reziproq' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Frag Reziproq' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/profil/sprache');
  await pageSettled(page);
  await page.getByRole('radio', { name: 'Deutsch' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'English' })).toBeChecked();
});

test('Der Sprung-Link führt an der Navigation vorbei zum Inhalt', async ({ page }) => {
  await signIn(page);
  await page.goto('/heute');
  await pageSettled(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Zum Inhalt springen' })).toBeVisible();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  // Der erste Halt im Inhalt ist der Knopf der Karte „Als Nächstes“, nicht die Seitenleiste.
  await expect(page.locator('#inhalt [data-slot="next-card"] a')).toBeFocused();
});

test('Es gibt nur ein helles Thema, auch bei dunkler Systemeinstellung', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await signIn(page);
  await page.goto('/profil');
  await pageSettled(page);
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect(page.getByRole('link', { name: /^Erscheinungsbild/ })).toHaveCount(0);
});

test('Unbekannte Adressen zeigen die Nicht-gefunden-Seite', async ({ page }) => {
  await signIn(page);
  for (const path of ['/gibt-es-nicht', '/akten', '/puls', '/pnl']) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Diese Seite gibt es nicht' }),
    ).toBeVisible();
  }
  await page.getByRole('link', { name: 'Zu Start' }).click();
  await expect(page).toHaveURL(url('/heute'));
});
