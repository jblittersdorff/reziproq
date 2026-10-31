import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Tests zu docs/specs/PLT-10.md, die einen echten Browser brauchen: Darstellung in Hell und
// Dunkel, Tastatur, Bewegung, Diagrammfarben und Klickflächen.

test.use({ locale: 'de-DE', colorScheme: 'light' });

const tokensCss = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const chartTokens = [
  ...new Set([...tokensCss.matchAll(/--(chart-[\w-]+):\s*#/g)].map((match) => match[1] ?? '')),
];

async function signIn(page: Page) {
  // Seit PLT-01 über den echten Ablauf mit nachgebautem Zitadel; Tokens liegen nur im Speicher.
  await fakeZitadel(page);
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
  // Die Diagramme sind fertig, wenn alle fünf gezeichnet sind.
  await expect(page.locator('figure [role="img"] svg')).toHaveCount(5);
  await page.waitForLoadState('networkidle');
}

const sections = [
  'Farben',
  'Schrift',
  'Abstände, Radien und Schatten',
  'Navigation',
  'Bausteine',
  'Diagramme',
];
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
  'Globale Leiste',
  'Lokale Leiste eines Lieferanten',
  'Pfad mit Zurück-Pfeil',
  'Kachel',
  'Knöpfe',
  'Formularseite',
  'Abläufe in Schritten',
  'Bestätigung auf der Seite',
  'Rückmeldezeile',
  'Kennzeichen Intern und Geteilt',
  'Zustände: leer, lädt, Fehler',
  'Tabellen und Listen',
];
const charts = [
  'Zwei Lieferanten sollen in die strategische Zone wechseln',
  'Die größte Lücke liegt bei der Kommunikation',
  'Service bewertet die Beziehung durchweg schwächer',
  'Die Hebel heben die EBIT-Wirkung auf 9,8 Mio. €',
  'Drei Initiativen laufen bis Ende 2028',
];

test('Ohne Login leitet /styleguide zur Anmeldung weiter und zeigt bis dahin nichts', async ({
  page,
}) => {
  const zitadel = await fakeZitadel(page);
  zitadel.session.active = false;
  await page.goto('/styleguide');
  await expect(page.getByText('Zitadel-Login')).toBeVisible();
  expect(new URL(zitadel.authorizeRequests[0]?.get('redirect_uri') ?? '').pathname).toBe(
    '/auth/callback',
  );
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

    // Navigation (PLT-10): globale und lokale Leiste, Pfad mit Zurück-Pfeil
    const globalBar = page.getByRole('navigation', {
      name: 'Hauptnavigation (Beispiel)',
      exact: true,
    });
    await expect(globalBar.getByRole('link', { name: 'Lieferanten' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const localBar = page.getByRole('navigation', {
      name: 'Bereiche des Lieferanten (Beispiel)',
      exact: true,
    });
    await expect(localBar.getByRole('link', { name: 'Strategie' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(localBar.getByRole('button', { name: /Nächster Schritt/ })).toBeVisible();
    const path = page.getByRole('navigation', { name: 'Pfad (Beispiel)', exact: true });
    await expect(path.getByRole('link', { name: 'Zurück zu Einstellungen' })).toBeVisible();
    await expect(path.getByText('Organisation', { exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );

    // Kachel nach NAV-10: Titel, Satz, Kennzahl, höchstens zwei Knöpfe
    const tile = page.locator('[data-slot="tile"]').filter({ hasText: 'Wohin wir die Beziehung' });
    await expect(tile.getByText('Hoch · stark')).toBeVisible();
    expect(await tile.getByRole('button').count()).toBeLessThanOrEqual(2);

    // Formularseite: Fehler am Feld, Mehrfachauswahl, Datum, Speichern und Abbrechen unten
    const name = page.getByRole('textbox', { name: 'Name der Beziehung' });
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Bitte einen Namen eingeben.')).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Lieferanten suchen' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Warengruppe' })).toBeVisible();
    await expect(
      page.getByRole('group', { name: 'Business Units' }).getByRole('checkbox'),
    ).toHaveCount(3);
    await expect(page.getByLabel('Frist')).toHaveAttribute('type', 'date');
    await expect(
      page.getByRole('switch', { name: 'Puls mit dem Lieferanten teilen' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Speichern', exact: true }).first().click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Gespeichert.' }).first(),
    ).toBeVisible();

    // Abläufe in Schritten
    await expect(page.getByText('Schritt 2 von 4')).toBeVisible();
    await page.getByRole('button', { name: 'Weiter', exact: true }).click();
    await expect(page.getByText('Schritt 3 von 4')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Später fortsetzen' })).toBeVisible();

    // Bestätigung auf der Seite statt Fenster
    await page.getByRole('button', { name: 'Beziehung beenden' }).click();
    const confirmRow = page.getByRole('group', { name: 'Wirklich beenden?' });
    await expect(confirmRow.getByRole('button', { name: 'Ja' })).toBeVisible();
    await confirmRow.getByRole('button', { name: 'Ja' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Die Beziehung ist beendet.' }),
    ).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Kennzeichen, Zustände, Tabellen und Listen mit Verlauf
    await expect(page.locator('[data-visibility="internal"]')).toContainText('Intern');
    await expect(page.locator('[data-visibility="shared"]')).toContainText('Geteilt');
    await expect(page.getByText('Noch keine Initiativen')).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: 'Lieferanten werden geladen' }),
    ).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'nicht geladen' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByText('Risiko').first()).toBeVisible();
    await expect(page.getByText('Status: angelegt → aktiv')).toBeVisible();
    await expect(page.getByText('Noch keine Änderungen')).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: 'Verlauf wird geladen' }),
    ).toBeVisible();

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
        ...[...document.querySelectorAll('#blocks [data-slot="subsection"] > div > h3')].filter(
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

  await page.goto('/start');
  await expect(page.locator('#inhalt h1')).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem('reziproq-theme'))).toBeNull();
});

test('Der Styleguide ist nicht in der Navigation verlinkt', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/start');
  const navigation = page.getByRole('navigation', { name: 'Hauptnavigation', exact: true });
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
    const focused = await page.evaluate(async () => {
      // Fokus-Ringe blenden kurz ein; erst messen, wenn der Übergang fertig ist.
      // Zwei Bildaufbauten, damit der Übergang begonnen hat; dann nur auf Übergänge warten.
      // Ladekreisel drehen endlos und wären nie fertig.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await Promise.all(
        document
          .getAnimations()
          .filter((animation) => animation instanceof CSSTransition)
          .map((animation) => animation.finished.catch(() => undefined)),
      );
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;
      // Browsereigene Teile wie das Kalender-Symbol im Datumsfeld: Der Fokus liegt im Inneren des
      // Feldes, das Feld selbst ist nicht :focus. Diesen Fokus zeichnet der Browser selbst.
      if (!element.matches(':focus')) return null;
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
    'Lieferanten suchen',
    'Antriebe',
    'Frist',
    'Weiter',
    'Später fortsetzen',
    'Beziehung beenden',
    'Öffnen',
    'Lieferanten',
    'Zurück zu Einstellungen',
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

  // Die Rückmeldezeile erscheint ohne Einblenden.
  await page.getByRole('button', { name: 'Speichern', exact: true }).last().click();
  const line = page.locator('[data-slot="status-line"]').first();
  await expect(line).toBeVisible();
  await expect(line).toHaveCSS('animation-name', 'none');

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

    // Auch die Zeile der Bestätigung auf der Seite
    await page.getByRole('button', { name: 'Beziehung beenden' }).click();
    await expect(page.getByRole('group', { name: 'Wirklich beenden?' })).toBeVisible();
    expect(await tooSmallTargets(page), 'Bestätigung').toEqual([]);
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
