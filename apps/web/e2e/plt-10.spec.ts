import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';

// Tests zu docs/specs/PLT-10.md, die einen echten Browser brauchen: Darstellung in Hell und
// Dunkel, Tastatur, Bewegung, Diagrammfarben und Klickflächen.

test.use({ locale: 'de-DE', colorScheme: 'light' });

const tokensCss = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const chartTokens = [
  ...new Set([...tokensCss.matchAll(/--(chart-[\w-]+):\s*#/g)].map((match) => match[1] ?? '')),
];

async function signIn(page: Page) {
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
        supportView: false,
        permissions: { viewOrganizationSettings: true, viewSuppliers: true, switchCustomer: false },
      },
    }),
  );
  await page.route('**/api/suppliers', (route) =>
    route.fulfill({ json: { suppliers: [], count: 0, totalSpend: [], spendYear: null } }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
}

async function openStyleguide(page: Page) {
  await signIn(page);
  await page.goto('/styleguide');
  await expect(page.getByRole('heading', { level: 1, name: 'Styleguide' })).toBeVisible();
  // Die Diagramme sind fertig, wenn alle vier gezeichnet sind.
  await expect(page.locator('figure [role="img"] svg')).toHaveCount(4);
  await page.waitForLoadState('networkidle');
}

const sections = ['Farben', 'Schrift', 'Abstände, Radien und Schatten', 'Bausteine', 'Diagramme'];
const subsections = [
  'Flächen',
  'Text',
  'Akzentfarbe – nur für Hauptaktion und Auswahl',
  'Statusfarben – nur für Status mit Bedeutung',
  'Diagrammfarben',
  'Text auf Hintergrund – gemessener Kontrast',
  'Abstände',
  'Radien',
  'Schatten',
  'Breakpoints',
  'Bewegung',
  'Knöpfe',
  'Eingabefeld, Auswahl, Schalter und Checkbox',
  'Suchfeld',
  'Dialog, Seitenpanel und Hinweis',
  'Status-Abzeichen',
  'Tabelle',
  'Kacheln',
  'Seitenleiste',
  'Leer, Laden, Fehler',
];
const charts = [
  'Zwei Lieferanten sollen in die strategische Zone wechseln',
  'Die größte Lücke liegt bei der Kommunikation',
  'Service bewertet die Beziehung durchweg schwächer',
  'Die Hebel heben die EBIT-Wirkung auf 9,8 Mio. €',
];

test('Ohne Login zeigt /styleguide die Anmeldung', async ({ page }) => {
  await page.goto('/styleguide');
  await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Styleguide' })).toHaveCount(0);
});

for (const mode of ['Hell', 'Dunkel'] as const) {
  test(`/styleguide zeigt alle Abschnitte und Bausteine (${mode})`, async ({ page }) => {
    await openStyleguide(page);
    await page.getByText(mode, { exact: true }).click();
    await expect(page.locator('html')).toHaveClass(mode === 'Dunkel' ? /dark/ : /^(?!.*dark)/);

    // Die Fläche der Seite kommt aus dem Token des gewählten Modus.
    const background = await page.evaluate(() => {
      const token = getComputedStyle(document.documentElement).getPropertyValue('--background');
      const probe = document.createElement('div');
      probe.style.color = token;
      document.body.append(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      return { actual: getComputedStyle(document.body).backgroundColor, expected };
    });
    expect(background.actual).toBe(background.expected);

    for (const name of sections) {
      await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
    }
    for (const name of subsections) {
      await expect(page.getByRole('heading', { level: 3, name, exact: true })).toBeVisible();
    }

    // Jedes Farb-Token mit Name und Wert, jedes Paar mit gemessenem Kontrast, keines zu schwach.
    for (const token of ['background', 'primary', 'chart-seq-5']) {
      await expect(page.getByText(`--${token}`, { exact: true }).first()).toBeVisible();
    }
    await expect(page.locator('[data-pair]').first()).toContainText('Kontrast');
    await expect(page.getByText('zu schwach')).toHaveCount(0);

    // Schrift von Großtitel bis Fußnote
    for (const level of ['Großtitel', 'Titel', 'Text', 'Fußnote']) {
      await expect(page.getByText(level, { exact: true }).first()).toBeVisible();
    }

    // Knöpfe in allen Zuständen
    for (const state of ['Normal', 'Hover', 'Fokus', 'Deaktiviert', 'Lädt']) {
      await expect(page.getByRole('button', { name: state, exact: true })).toHaveCount(4);
    }
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(4);

    // Übrige Bausteine
    await expect(page.getByRole('textbox', { name: 'Name der Beziehung' })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Lieferanten suchen' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Warengruppe' })).toBeVisible();
    await expect(
      page.getByRole('switch', { name: 'Puls mit dem Lieferanten teilen' }),
    ).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'An offene Pulse erinnern' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByText('Risiko').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Beziehungspuls.*Release 0\.2/ })).toBeVisible();
    await expect(page.getByRole('heading', { level: 4, name: 'Nordstahl (Demo)' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();
    await expect(page.getByText('Noch keine Initiativen')).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: 'Lieferanten werden geladen' }),
    ).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'nicht geladen' })).toBeVisible();

    await page.getByRole('button', { name: 'Dialog öffnen' }).click();
    await expect(page.getByRole('dialog', { name: 'Initiative freigeben?' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Seitenpanel öffnen' }).click();
    await expect(page.getByRole('dialog', { name: 'Details zum Lieferanten' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Hinweis zeigen' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Gespeichert' })).toBeVisible();

    // Diagramme mit Hinweis auf Beispieldaten und einem leeren Zustand
    for (const name of charts) {
      await expect(page.getByRole('img', { name }).locator('svg').first()).toBeVisible();
    }
    await expect(page.getByText('Beispieldaten', { exact: true })).toBeVisible();
    await expect(page.getByText('Noch keine Bewertungen')).toBeVisible();

    // Jeder Abschnitt nennt die Datei, aus der seine Bausteine kommen, jeder Baustein seine eigene.
    const withoutSource = await page.evaluate(() =>
      [
        ...[...document.querySelectorAll('main section')].filter(
          (section) => !section.querySelector('[data-slot="source-files"]'),
        ),
        ...[...document.querySelectorAll('#blocks h3')].filter(
          (heading) => !heading.closest('div')?.querySelector('[data-slot="source-files"]'),
        ),
      ].map((element) => element.id || element.textContent),
    );
    expect(withoutSource).toEqual([]);
  });
}

test('Der Umschalter gilt nur für den Styleguide', async ({ page }) => {
  await openStyleguide(page);
  await page.getByText('Dunkel', { exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);

  await page.goto('/uebersicht');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem('reziproq-theme'))).toBeNull();
});

test('Der Styleguide ist nicht in der Seitenleiste verlinkt', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/uebersicht');
  const navigation = page.getByRole('navigation', { name: 'Hauptnavigation' });
  await expect(navigation).toBeVisible();
  await expect(navigation.locator('a[href="/styleguide"]')).toHaveCount(0);
});

test('Alle Bausteine sind per Tastatur erreichbar und haben einen sichtbaren Fokus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openStyleguide(page);

  // Vorher festhalten, wie jedes Element ohne Fokus aussieht. Als Fokus zählt nur, was man sieht:
  // eine gezeichnete Kontur oder ein nicht durchsichtiger Schatten (Tailwinds ring).
  await page.evaluate(() => {
    const look = (element: Element) => {
      const style = getComputedStyle(element);
      const outline =
        style.outlineStyle === 'none' || Number.parseFloat(style.outlineWidth) === 0
          ? 'none'
          : `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`;
      const shadow = style.boxShadow
        .split(/,(?![^(]*\))/)
        .map((part) => part.trim())
        .filter((part) => !/^(rgba\(0, 0, 0, 0\)|transparent)/.test(part) && part !== 'none')
        .join(', ');
      return `${outline}|${shadow || 'none'}`;
    };
    Object.assign(window, { focusLook: look });
    for (const element of document.querySelectorAll<HTMLElement>(
      'a, button, input, select, textarea, [tabindex]',
    )) {
      element.dataset.unfocused = look(element);
      if (element.parentElement)
        element.parentElement.dataset.unfocused = look(element.parentElement);
    }
  });

  const visited: { name: string; visible: boolean }[] = [];
  for (let i = 0; i < 150; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;
      // Radio-Knöpfe im Umschalter sind unsichtbar; den Fokus zeigt ihr Label.
      const shown = element.matches('input[type="radio"]') ? element.parentElement : element;
      if (!shown) return null;
      const look = (window as unknown as { focusLook: (e: Element) => string }).focusLook(shown);
      const name =
        element.getAttribute('aria-label') ??
        (element.matches('input[type="radio"]') ? shown.textContent : null) ??
        // Felder, Schalter und Checkbox heißen wie ihr <label>.
        (element as HTMLInputElement).labels?.[0]?.textContent?.trim() ??
        element.textContent?.trim() ??
        '';
      return {
        name: name || element.id || element.tagName,
        // Die Beispiel-Knöpfe „Fokus“ zeigen den Ring schon vorher, absichtlich.
        visible:
          look !== 'none|none' &&
          (look !== shown.dataset.unfocused || shown.dataset.preview === 'focus'),
      };
    });
    if (!focused) continue;
    if (visited.some((entry) => entry.name === focused.name) && focused.name === visited[0]?.name)
      break;
    visited.push(focused);
  }

  const withoutFocus = visited.filter((entry) => !entry.visible).map((entry) => entry.name);
  expect(withoutFocus, 'Elemente ohne sichtbaren Fokus').toEqual([]);

  const names = visited.map((entry) => entry.name);
  for (const expected of [
    'Deutsch',
    'System',
    'Farben',
    'Diagramme',
    'Normal',
    'Exportieren',
    'Details',
    'Initiative anlegen',
    'Name der Beziehung',
    'Warengruppe',
    'Notiz',
    'Puls mit dem Lieferanten teilen',
    'An offene Pulse erinnern',
    'Lieferanten suchen',
    'Dialog öffnen',
    'Seitenpanel öffnen',
    'Hinweis zeigen',
    'Übersicht',
    'Erneut versuchen',
  ]) {
    expect(
      names.some((name) => name === expected || name.startsWith(expected)),
      `${expected} per Tab erreichbar`,
    ).toBe(true);
  }
});

test('Bei „Bewegung reduzieren“ laufen keine Animationen', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openStyleguide(page);

  // Kreisel im Knopf „Lädt“ steht still.
  const spinner = page.locator('[aria-busy="true"] svg').first();
  await expect(spinner).toHaveCSS('animation-name', 'none');

  // Dialog und Seitenpanel erscheinen ohne Übergang.
  await page.getByRole('button', { name: 'Dialog öffnen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Initiative freigeben?' });
  await expect(dialog).toBeVisible();
  for (const property of ['animation-duration', 'transition-duration']) {
    expect(
      await dialog.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property),
    ).toBe('0s');
  }
  await page.keyboard.press('Escape');

  // Ein Knopf wechselt die Farbe beim Hover ohne Übergang.
  await expect(page.getByRole('button', { name: 'Exportieren' })).toHaveCSS(
    'transition-duration',
    '0s',
  );

  // Diagramme stehen sofort fertig da und verändern sich danach nicht mehr.
  const bridge = page.getByRole('img', { name: 'Die Hebel heben die EBIT-Wirkung auf 9,8 Mio. €' });
  const first = await bridge.innerHTML();
  await page.waitForTimeout(600);
  expect(await bridge.innerHTML()).toBe(first);
});

for (const mode of ['Hell', 'Dunkel'] as const) {
  test(`Die Diagramm-Beispiele nutzen nur Diagramm-Tokens (${mode})`, async ({ page }) => {
    await openStyleguide(page);
    await page.getByText(mode, { exact: true }).click();
    // Neu gezeichnet nach dem Wechsel
    await page.waitForTimeout(300);

    const result = await page.evaluate(
      ({ tokens, titles }) => {
        // Alle Farben in dieselbe Schreibweise bringen, wie der Browser sie berechnet.
        const probe = document.createElement('div');
        document.body.append(probe);
        const normalize = (value: string) => {
          probe.style.color = '';
          probe.style.color = value;
          return getComputedStyle(probe).color;
        };
        const root = getComputedStyle(document.documentElement);
        const allowed = new Set(
          tokens.map((name) => normalize(root.getPropertyValue(`--${name}`))),
        );

        const used = new Set<string>();
        for (const title of titles) {
          const figure = [...document.querySelectorAll('[role="img"]')].find(
            (element) => element.getAttribute('aria-label') === title,
          );
          for (const element of figure?.querySelectorAll('svg *') ?? []) {
            // Zuschnitt- und Vorlagen-Formen werden nie gezeichnet, ihre Füllung ist bedeutungslos.
            if (element.closest('defs, clipPath, mask')) continue;
            for (const attribute of ['fill', 'stroke', 'stop-color']) {
              const value = element.getAttribute(attribute);
              if (!value || value === 'none' || value === 'transparent') continue;
              if (value.startsWith('url(')) continue;
              used.add(normalize(value));
            }
          }
        }
        probe.remove();
        return { foreign: [...used].filter((color) => !allowed.has(color)), count: used.size };
      },
      { tokens: chartTokens, titles: charts },
    );
    expect(result.count).toBeGreaterThan(3);
    expect(result.foreign, 'Farben, die kein Diagramm-Token sind').toEqual([]);
  });
}

/**
 * Alle sichtbaren Klickflächen, die kleiner als 44 × 44 px sind. Eine unsichtbare Erweiterung
 * über ::after (z. B. bei Checkbox und kleinem Knopf) zählt zur Klickfläche.
 */
async function tooSmallTargets(page: Page) {
  return page.evaluate(() => {
    const selector = [
      'a[href]',
      'button',
      'select',
      'textarea',
      'input:not([type="radio"])',
      '[role="switch"]',
      '[role="checkbox"]',
      'label:has(> input[type="radio"])',
    ].join(', ');
    return [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        // Versteckte Hilfsfelder (z. B. Radix hinter Checkbox und Schalter) sind keine Klickflächen.
        const hidden = element.closest('[aria-hidden="true"]') || style.pointerEvents === 'none';
        return !hidden && style.visibility !== 'hidden' && box.width > 1 && box.height > 1;
      })
      .map((element) => {
        const box = element.getBoundingClientRect();
        const after = getComputedStyle(element, '::after');
        let { width, height } = box;
        if (after.content !== 'none' && after.position === 'absolute') {
          const px = (value: string) => Number.parseFloat(value) || 0;
          width = Math.max(width, box.width - px(after.left) - px(after.right));
          height = Math.max(height, box.height - px(after.top) - px(after.bottom));
        }
        const label = element.getAttribute('aria-label') ?? element.textContent?.trim();
        return { label, width, height };
      })
      .filter(({ width, height }) => width < 44 - 0.5 || height < 44 - 0.5)
      .map(({ label, width, height }) => `${label}: ${Math.round(width)} × ${Math.round(height)}`);
  });
}

for (const width of [1440, 390]) {
  test(`Jede Klickfläche im Styleguide ist mindestens 44 × 44 px groß (${width} px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await openStyleguide(page);
    expect(await tooSmallTargets(page), 'Seite').toEqual([]);

    await page.getByRole('button', { name: 'Dialog öffnen' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Erst messen, wenn das Einblenden (Zoom von 95 %) fertig ist.
    await dialog.evaluate((element) =>
      Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)),
    );
    expect(await tooSmallTargets(page), 'Dialog').toEqual([]);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Hinweis zeigen' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Gespeichert' })).toBeVisible();
    expect(await tooSmallTargets(page), 'Hinweis').toEqual([]);
  });
}

test('Bei 390 px Breite gibt es keine waagerechte Scrollleiste', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openStyleguide(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
