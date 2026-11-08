import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Tests zu docs/specs/PLT-11.md, die einen echten Browser brauchen: globale Leiste, Maße,
// Tastatur, Zurück-Knopf des Browsers und Menüseite.

test.use({ locale: 'de-DE' });

const barTargets = [
  { name: 'Start', path: '/start' },
  { name: 'Lieferanten', path: '/lieferanten' },
  { name: 'Portfolio', path: '/portfolio' },
  { name: 'Wirkung', path: '/wirkung' },
  { name: 'Fragen', path: '/fragen' },
  { name: 'Profil', path: '/profil' },
];

const greeting = /^Guten (Morgen|Tag|Abend), Anna$/;

/** Alle Routen dieser Spec mit Titel (h1) und, wo vorhanden, leerem Zustand. */
const routes = [
  { path: '/start', title: greeting, empty: 'Nichts fällig.' },
  { path: '/lieferanten', title: 'Lieferanten', empty: 'Noch keine Lieferanten.' },
  { path: '/portfolio', title: 'Portfolio' },
  { path: '/wirkung', title: 'Wirkung', empty: 'Noch keine Wirkung' },
  { path: '/fragen', title: 'Frag Reziproq', empty: 'Vorschläge' },
  { path: '/profil', title: 'Profil' },
  { path: '/profil/erscheinungsbild', title: 'Erscheinungsbild' },
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

const bar = (page: Page) => page.getByRole('navigation', { name: 'Hauptnavigation' });
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

test('Nach dem Login landet der Nutzer auf /start', async ({ page }) => {
  const zitadel = await signIn(page);
  zitadel.session.active = false;
  await page.goto('/');
  await expect(page.getByText('Zitadel-Login')).toBeVisible();

  // Zitadel bestätigt die Anmeldung und leitet mit Code und State zurück.
  zitadel.session.active = true;
  const state = zitadel.authorizeRequests[0]?.get('state');
  await page.goto(`/auth/callback?code=code-1&state=${state}`, { waitUntil: 'commit' });
  await expect(page).toHaveURL(url('/start'));
  await expect(
    page.locator('#inhalt').getByRole('heading', { level: 1, name: greeting }),
  ).toBeVisible();
});

test('Jedes Ziel der globalen Leiste ist von jeder Seite mit einem Klick erreichbar. Die aktive Seite ist markiert.', async ({
  page,
}) => {
  // Zehn Seiten mal sechs Ziele, je mit Anmeldung über das nachgebaute Zitadel.
  // Jede Seite mal jedes Ziel; auf dem langsameren CI-Rechner braucht das mehrere Minuten.
  test.setTimeout(480_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  for (const from of routes) {
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
      // Die Ziele stecken hinter dem Menüknopf.
      await expect(bar(page).getByRole('link', { name: 'Portfolio' })).toBeHidden();
    }

    await page.goto('/portfolio');
    await pageSettled(page);
    await bar(page).getByRole('link', { name: 'Menü öffnen' }).click();
    await expect(page).toHaveURL(url('/menu'));
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const fixed = await page.evaluate(
      () =>
        [...document.querySelectorAll('*')].filter(
          (el) => getComputedStyle(el).position === 'fixed',
        ).length,
    );
    expect(fixed).toBe(0);
    const menu = page.getByRole('navigation', { name: 'Menü' });
    for (const target of barTargets) {
      await expect(menu.getByRole('link', { name: target.name })).toBeVisible();
    }
    await menu.getByRole('link', { name: 'Wirkung' }).click();
    await expect(page).toHaveURL(url('/wirkung'));
    // Zurück führt wieder ins Menü und dann zur Seite davor.
    await page.goBack();
    await expect(page).toHaveURL(url('/menu'));
    await page.goBack();
    await expect(page).toHaveURL(url('/portfolio'));
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
  // Die frühere Startseite leitet weiter.
  await page.goto('/uebersicht');
  await expect(page).toHaveURL(url('/start'));
});

test('Drei Ebenen hin und zurück, mit Zurück-Pfeil und mit Browser-Zurück, auch nach Speichern und Abbrechen', async ({
  page,
}) => {
  await signIn(page, { admin: true });
  const path = page.getByRole('navigation', { name: 'Pfad' });
  const levels = ['/start', '/profil', '/einstellungen', '/einstellungen/organisation'];

  const goDown = async () => {
    await page.goto('/start');
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

  // Speichern und Abbrechen führen zur vorigen Ansicht.
  for (const button of ['Speichern', 'Abbrechen']) {
    await page.goto('/profil');
    await pageSettled(page);
    await page.getByRole('link', { name: /^Erscheinungsbild/ }).click();
    await expect(page).toHaveURL(url('/profil/erscheinungsbild'));
    await page.getByText('Dunkel', { exact: true }).click();
    await page.getByRole('button', { name: button }).click();
    await expect(page).toHaveURL(url('/profil'));
    if (button === 'Speichern') await expect(page.locator('html')).toHaveClass(/dark/);
    else {
      // Abbrechen verwirft; davor war Dunkel gespeichert, also zurück auf System.
      await page.getByRole('link', { name: /^Erscheinungsbild/ }).click();
      await page.getByText('System', { exact: true }).click();
      await page.getByRole('button', { name: 'Speichern' }).click();
      await expect(page).toHaveURL(url('/profil'));
      await page.getByRole('link', { name: /^Erscheinungsbild/ }).click();
      await page.getByText('Dunkel', { exact: true }).click();
      await page.getByRole('button', { name: 'Abbrechen' }).click();
      await expect(page).toHaveURL(url('/profil'));
      await expect(page.locator('html')).not.toHaveClass(/dark/);
    }
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
  await page.goto('/start');
  await pageSettled(page);

  const expected = [
    'Zum Inhalt springen',
    'Reziproq',
    ...barTargets.map((target) => target.name),
    'Deine Frage an Reziproq',
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

  // Enter auf dem Feld öffnet die Fragen; Profil und Formular gehen ebenso per Tastatur.
  await page.keyboard.type('Wer ist mein Fokuslieferant?');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/fragen\?q=/);
  await page.goto('/profil/erscheinungsbild');
  await pageSettled(page);
  await page.getByRole('radio', { name: 'System' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Hell' })).toBeChecked();
});

test('Der Sprung-Link führt an der Navigation vorbei zum Inhalt', async ({ page }) => {
  await signIn(page);
  await page.goto('/start');
  await pageSettled(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Zum Inhalt springen' })).toBeVisible();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('aria-label', 'Deine Frage an Reziproq');
});

test('Hell- und Dunkelmodus folgen dem System', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await signIn(page);
  await page.goto('/profil/erscheinungsbild');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('radio', { name: 'System' })).toBeChecked();
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('Unbekannte Adressen zeigen die Nicht-gefunden-Seite', async ({ page }) => {
  await signIn(page);
  for (const path of ['/gibt-es-nicht', '/beziehungen', '/puls', '/pnl']) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Diese Seite gibt es nicht' }),
    ).toBeVisible();
  }
  await page.getByRole('link', { name: 'Zu Start' }).click();
  await expect(page).toHaveURL(url('/start'));
});
