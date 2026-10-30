import { expect, type Page, test } from '@playwright/test';

// Tests zu docs/specs/PLT-11.md, die einen echten Browser brauchen: Layout, Maße, Tastatur.

test.use({ locale: 'de-DE' });

const areas = [
  { title: 'Lieferanten', path: '/lieferanten' },
  { title: 'Beziehungen', path: '/beziehungen' },
  { title: 'Beziehungspuls', path: '/puls' },
  { title: 'Joint Business Plans', path: '/jbp' },
  { title: 'QBRs und Maßnahmen', path: '/qbr' },
  { title: 'P&L-Impact', path: '/pnl' },
];
const allPaths = ['/uebersicht', ...areas.map((a) => a.path), '/einstellungen', '/gibt-es-nicht'];

/**
 * Nachgebauter Login: legt eine Sitzung so ab, wie oidc-client-ts sie nach dem Login speichert,
 * und beantwortet die API-Aufrufe. Den echten Ablauf mit PKCE prüft home.spec.ts.
 */
async function signIn(page: Page, { admin = false } = {}) {
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id_token: `${b64({ alg: 'none' })}.${b64({ iss: 'https://zitadel.test', aud: 'web-client', sub: 'user-1', exp: now + 3600 })}.`,
    access_token: 'access-token-1',
    token_type: 'Bearer',
    scope: 'openid profile email',
    profile: { sub: 'user-1' },
    expires_at: now + 3600,
  };
  await page.addInitScript((value) => {
    sessionStorage.setItem('oidc.user:https://zitadel.test:web-client', value);
  }, JSON.stringify(user));
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Anna Schmidt',
        firstName: 'Anna',
        email: 'anna.schmidt@beispiel-einkauf.de',
        organization: { id: 'org-1', name: 'Beispiel-OEM (Demo)' },
        permissions: { viewOrganizationSettings: admin, viewSuppliers: true },
      },
    }),
  );
  await page.route('**/api/suppliers', (route) =>
    route.fulfill({ json: { suppliers: [], count: 0, totalSpend: [] } }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
}

/**
 * Wartet, bis die Seite im Rahmen fertig ist: Die Überschrift steht im Inhaltsbereich des Rahmens
 * (#inhalt) und es laufen keine Anfragen mehr. Vorher könnte noch die Zwischenseite
 * „Anmeldung wird geprüft“ zu sehen sein, die auch eine Überschrift hat.
 */
async function pageSettled(page: Page) {
  await expect(page.locator('#inhalt h1')).toBeVisible();
  await page.waitForLoadState('networkidle');
}

/** Alle sichtbaren Klickflächen, die kleiner als 44 × 44 px sind. */
async function tooSmallTargets(page: Page) {
  return page.evaluate(() => {
    const selector = 'a[href], button, [role="menuitem"], label:has(> input[type="radio"])';
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

test('Ein Klick irgendwo auf eine Kachel öffnet die richtige Route', async ({ page }) => {
  await signIn(page);
  for (const [index, area] of areas.entries()) {
    await page.goto('/uebersicht');
    const tile = page.getByRole('region', { name: 'Bereiche' }).getByRole('link').nth(index);
    // Unten rechts in die Kachel klicken, weit weg von Titel und Text.
    const box = await tile.boundingBox();
    if (!box) throw new Error('Kachel nicht sichtbar');
    await tile.click({ position: { x: box.width - 8, y: box.height - 8 } });
    await expect(page).toHaveURL(`http://localhost:5174${area.path}`);
    await expect(page.getByRole('heading', { level: 1, name: area.title })).toBeVisible();
  }
});

test('Kacheln sind gleich hoch und auf breiten Bildschirmen dreispaltig', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/uebersicht');
  const tiles = page.getByRole('region', { name: 'Bereiche' }).getByRole('link');
  await expect(tiles).toHaveCount(6);
  const boxes = await tiles.evaluateAll((tiles) =>
    tiles.map((tile) => tile.getBoundingClientRect().toJSON()),
  );
  expect(new Set(boxes.map((box) => Math.round(box.height))).size).toBe(1);
  expect(new Set(boxes.map((box) => Math.round(box.x))).size).toBe(3);
});

test.describe('Bei 390 px Breite', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Seitenleiste eingeklappt, Kacheln einspaltig, keine waagerechte Scrollleiste', async ({
    page,
  }) => {
    await signIn(page);
    for (const path of allPaths) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeHidden();
      await expect(page.getByRole('button', { name: 'Navigation öffnen' })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `waagerechte Scrollleiste auf ${path}`).toBe(0);
    }

    await page.goto('/uebersicht');
    const tiles = page.getByRole('region', { name: 'Bereiche' }).getByRole('link');
    await expect(tiles).toHaveCount(6);
    const xs = await tiles.evaluateAll((tiles) =>
      tiles.map((tile) => Math.round(tile.getBoundingClientRect().x)),
    );
    expect(new Set(xs).size).toBe(1);
  });

  test('Die eingeklappte Seitenleiste öffnet und schließt sich', async ({ page }) => {
    await signIn(page);
    await page.goto('/uebersicht');
    await page.getByRole('button', { name: 'Navigation öffnen' }).click();
    const sheet = page.getByRole('dialog', { name: 'Hauptnavigation' });
    await sheet.getByRole('link', { name: 'Beziehungspuls' }).click();
    await expect(page).toHaveURL('http://localhost:5174/puls');
    await expect(sheet).toBeHidden();

    await page.getByRole('button', { name: 'Navigation öffnen' }).click();
    await expect(sheet).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  });
});

for (const width of [1440, 390]) {
  test(`Alle Klickflächen sind mindestens 44 × 44 px groß (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, { admin: true });
    for (const path of allPaths) {
      await page.goto(path);
      await pageSettled(page);
      expect(await tooSmallTargets(page), path).toEqual([]);
    }

    // Auch in eingeblendeter Seitenleiste und offenem Nutzer-Menü.
    await page.goto('/uebersicht');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    if (width < 1024) await page.getByRole('button', { name: 'Navigation öffnen' }).click();
    await page.getByRole('button', { name: /Anna Schmidt/ }).click();
    await expect(page.getByRole('menuitem', { name: 'Abmelden' })).toBeVisible();
    expect(await tooSmallTargets(page), 'Nutzer-Menü').toEqual([]);
  });
}

test('Die Übersicht ist per Tastatur bedienbar, mit sichtbarem Fokus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/uebersicht');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const expected = [
    'Zum Inhalt springen',
    'Übersicht',
    ...areas.map((a) => a.title),
    'Einstellungen',
    'Anna Schmidt',
    ...areas.map((a) => a.title),
  ];
  const visited: string[] = [];
  for (const _ of expected) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement;
      const style = getComputedStyle(element);
      const ring = style.boxShadow !== 'none' || style.outlineStyle !== 'none';
      return { text: element.textContent?.trim() ?? '', ring };
    });
    expect(focused.ring, `sichtbarer Fokus auf „${focused.text}“`).toBe(true);
    visited.push(focused.text);
  }
  // Jede Station beginnt mit dem erwarteten Namen (Kacheln enthalten noch Satz und Release).
  expected.forEach((name, index) => {
    expect(visited[index]?.startsWith(name), `${index}: ${visited[index]}`).toBe(true);
  });

  // Enter auf der fokussierten letzten Kachel öffnet sie.
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('http://localhost:5174/pnl');
});

test('Der Sprung-Link führt an der Navigation vorbei zum Inhalt', async ({ page }) => {
  await signIn(page);
  await page.goto('/uebersicht');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Zum Inhalt springen' })).toBeVisible();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  // Nach dem Sprung ist die erste Kachel das nächste Ziel.
  await expect(page.locator(':focus')).toContainText('Lieferanten');
});

test('Hell und dunkel folgen der Systemeinstellung und lassen sich umschalten', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await signIn(page);
  await page.goto('/einstellungen');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('radio', { name: 'System' })).toBeChecked();

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).not.toHaveClass(/dark/);

  await page.getByText('Dunkel', { exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('radio', { name: 'Dunkel' })).toBeChecked();
});

test('Organisation erscheint in den Einstellungen nur für Admins', async ({ page }) => {
  await signIn(page, { admin: true });
  await page.goto('/einstellungen');
  await expect(page.getByRole('heading', { level: 2, name: 'Organisation' })).toBeVisible();
});

test('Unbekannte Adressen zeigen die Nicht-gefunden-Seite', async ({ page }) => {
  await signIn(page);
  await page.goto('/gibt-es-nicht');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Diese Seite gibt es nicht' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Zur Übersicht' }).click();
  await expect(page).toHaveURL('http://localhost:5174/uebersicht');
});
