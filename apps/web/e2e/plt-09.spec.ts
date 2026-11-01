import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { de } from '../src/locales/de.js';
import { en } from '../src/locales/en.js';
import { fakeZitadel } from './fake-zitadel.js';

// Tests zu docs/specs/PLT-09.md, die einen echten Browser brauchen: jede Route auf Englisch,
// Sprache bleibt nach Abmelden und erneutem Anmelden.

const id = '0190a0a0-0000-7000-8000-000000000001';
const url = (path: string) => `http://localhost:5174${path}`;

/** Alle Routen der App aus dem erzeugten Routenbaum, mit Beispielwerten für Parameter. */
function allRoutes(): string[] {
  const tree = readFileSync(new URL('../src/routeTree.gen.ts', import.meta.url), 'utf8');
  const block = tree.slice(
    tree.indexOf('export interface FileRoutesByFullPath'),
    tree.indexOf('}', tree.indexOf('export interface FileRoutesByFullPath')),
  );
  return [...block.matchAll(/^\s+'([^']+)':/gm)].map(([, path]) =>
    (path as string)
      .replace('$id', id)
      .replace('$jahr', '2025')
      .replace('$nutzer', 'nina')
      .replace(/\/\$$/, '/gibt-es-nicht')
      .replace(/(.)\/$/, '$1'),
  );
}

/** Schlüsselpfade und Texte eines Katalogs; Funktionen liefern ihre festen Textteile. */
function leaves(value: unknown, prefix = ''): [string, string[]][] {
  if (typeof value === 'function') {
    const text = String((value as (...args: unknown[]) => unknown)('§§', '§§'));
    return [[prefix, text.split(/§§|\d+/)]];
  }
  if (typeof value === 'string') return [[prefix, [value]]];
  if (Array.isArray(value)) return value.flatMap((child, i) => leaves(child, `${prefix}.${i}`));
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    leaves(child, prefix ? `${prefix}.${key}` : key),
  );
}

const englishTexts = new Set(leaves(en).flatMap(([, parts]) => parts.map((part) => part.trim())));
/** Deutsche Texte aus de.ts, die es im Englischen so nicht gibt (z. B. nicht „Team“ oder „SRO“). */
const germanTexts = [
  ...new Set(
    leaves(de)
      .flatMap(([, parts]) => parts.map((part) => part.trim()))
      .filter((text) => text.length >= 4 && /\p{L}/u.test(text) && !englishTexts.has(text)),
  ),
];
const keyPaths = leaves(de)
  .map(([path]) => path)
  .filter((path) => path.includes('.'));

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Fundstellen deutscher Texte als ganze Wörter, damit „Land“ nicht in „Poland“ anschlägt. */
function germanIn(text: string): string[] {
  return germanTexts.filter((german) =>
    new RegExp(`(^|[^\\p{L}])${escapeRegExp(german)}($|[^\\p{L}])`, 'u').test(text),
  );
}

async function signIn(page: Page, stored: { locale: 'de' | 'en' }) {
  const zitadel = await fakeZitadel(page);
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Lena Berger',
        firstName: 'Lena',
        email: 'lena@example.com',
        organization: { id: 'org-1', name: 'Test-OEM (Demo)' },
        supportView: false,
        orgRole: 'admin',
        isControlling: true,
        isOperator: true,
        locale: stored.locale,
        permissions: {
          viewOrganizationSettings: true,
          viewBuyerAreas: true,
          viewSuppliers: true,
          switchCustomer: true,
        },
      },
    }),
  );
  await page.route('**/api/me/sprache', (route) => {
    stored.locale = route.request().postDataJSON().locale;
    return route.fulfill({ status: 204 });
  });
  await page.route('**/api/me/permissions', (route) =>
    route.fulfill({
      json: {
        actions: [
          'organisation.sehen',
          'rollen.aendern',
          'einstellungen.verwalten',
          'lieferanten.sehen',
          'lieferanten.bearbeiten',
          'team.festlegen',
          'verlauf.sehen',
          'prompt.nutzen',
          'kunden.wechseln',
        ],
      },
    }),
  );
  const supplier = {
    relationshipId: id,
    name: 'Rheintal Elektronik GmbH (Demo)',
    country: 'DE',
    externalRef: 'L-10001',
    status: 'active',
    spend: { amountCents: 4_820_000_00, currency: 'EUR' },
  };
  await page.route('**/api/suppliers', (route) =>
    route.fulfill({
      json: {
        suppliers: [supplier],
        count: 1,
        spendYear: 2025,
        totalSpend: [{ amountCents: 4_820_000_00, currency: 'EUR' }],
      },
    }),
  );
  await page.route(`**/api/suppliers/${id}`, (route) =>
    route.fulfill({
      json: {
        ...supplier,
        organizationName: supplier.name,
        vatId: 'DE123456789',
        duns: null,
        notes: null,
        createdAt: '2026-10-01T08:00:00Z',
        endedAt: null,
        spend: [{ year: 2025, amount: { amountCents: 4_820_000_00, currency: 'EUR' } }],
        permissions: { edit: true, editTeam: true },
      },
    }),
  );
  await page.route(`**/api/suppliers/${id}/overview`, (route) =>
    route.fulfill({
      json: {
        head: { segment: null, sro: { userId: 'lena', name: 'Lena Berger' }, nextMeeting: null },
        metrics: [
          {
            tile: 'strategy',
            kind: 'spend',
            year: 2025,
            amount: { amountCents: 4_820_000_00, currency: 'EUR' },
          },
          { tile: 'relationship', kind: 'team_size', count: 2 },
        ],
      },
    }),
  );
  await page.route(`**/api/suppliers/${id}/team`, (route) =>
    route.fulfill({
      json: {
        members: [
          { userId: 'lena', name: 'Lena Berger', teamRole: 'sro', function: 'purchasing' },
          { userId: 'nina', name: 'Nina Roth', teamRole: 'viewer', function: null },
        ],
        candidates: [
          { userId: 'lena', name: 'Lena Berger', defaultFunction: 'purchasing' },
          { userId: 'nina', name: 'Nina Roth', defaultFunction: null },
        ],
      },
    }),
  );
  const members = [
    {
      id: 'lena',
      name: 'Lena Berger',
      email: 'lena@example.com',
      orgRole: 'admin',
      isControlling: true,
      defaultFunction: 'purchasing',
    },
    {
      id: 'nina',
      name: 'Nina Roth',
      email: 'nina@example.com',
      orgRole: 'viewer',
      isControlling: false,
      defaultFunction: null,
    },
  ];
  await page.route('**/api/organisation', (route) =>
    route.fulfill({ json: { name: 'Test-OEM (Demo)', country: 'DE', members } }),
  );
  await page.route('**/api/organisation/mitglieder/*', (route) =>
    route.fulfill({ json: members[1] }),
  );
  await page.route('**/api/betreiber/kunden', (route) =>
    route.fulfill({
      json: { customers: [{ id: 'org-2', name: 'Zweit-OEM (Demo)', country: 'AT' }] },
    }),
  );
  await page.route('**/api/audit**', (route) =>
    route.fulfill({
      json: {
        entries: [
          {
            id: 'e1',
            occurredAt: '2026-11-12T13:05:00Z',
            actorName: 'Lena Berger',
            organization: 'Test-OEM (Demo)',
            action: 'updated',
            changes: { status: { from: 'draft', to: 'active' } },
          },
        ],
      },
    }),
  );
  // Business Units und Warengruppen (PLT-06); der Eintrag mit der ID aus allRoutes() ist bearbeitbar.
  const entry = { id, name: 'Elektronik', code: 'EL', active: true, supplierCount: 0 };
  await page.route('**/api/business-units', (route) =>
    route.fulfill({ json: { businessUnits: [entry, { ...entry, id: 'bu-2', active: false }] } }),
  );
  await page.route('**/api/material-groups', (route) =>
    route.fulfill({ json: { materialGroups: [{ ...entry, parentId: null, childCount: 0 }] } }),
  );
  await page.route(`**/api/suppliers/${id}/zuordnung`, (route) =>
    route.fulfill({
      json: {
        businessUnits: [{ id, name: 'Elektronik', code: 'EL', active: false }],
        materialGroups: [{ id, name: 'Elektronik', code: 'EL', active: true, isPrimary: true }],
        canEdit: true,
      },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  return zitadel;
}

test.describe('auf Englisch', () => {
  test.use({ locale: 'en-GB' });

  test('Der Test kennt jede Route der App', () => {
    const routes = allRoutes();
    expect(routes.length).toBeGreaterThan(30);
    expect(routes).toContain(`/lieferanten/${id}/strategie/spend/2025`);
    expect(routes).toContain('/profil/sprache');
    // Die Prüfung findet deutsche Texte und rohe Schlüssel.
    expect(germanIn('Your profile: Lieferanten')).toEqual(['Lieferanten']);
    expect(germanIn('Poland')).toEqual([]);
    expect(keyPaths).toContain('workspace.areas.plan');
  });

  test('Ein Playwright-Test besucht jede Route auf Englisch. Keine Seite zeigt einen rohen Schlüssel oder deutschen Text aus der Übersetzungsdatei.', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, { locale: 'en' });
    const findings: string[] = [];
    for (const path of allRoutes()) {
      await page.goto(path);
      await expect(page.locator('#inhalt h1, main h1, h1').first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      const text = (await page.locator('body').textContent()) ?? '';
      for (const german of germanIn(text)) findings.push(`${path}: „${german}“`);
      for (const key of keyPaths.filter((key) => text.includes(key))) {
        findings.push(`${path}: Schlüssel ${key}`);
      }
      expect(await page.evaluate(() => document.documentElement.lang), path).toBe('en');
    }
    expect(findings).toEqual([]);
  });
});

test.describe('mit deutschem Browser', () => {
  test.use({ locale: 'de-DE' });

  test('Die Umstellung wirkt sofort und bleibt nach Abmelden und erneutem Anmelden erhalten', async ({
    page,
  }) => {
    const stored = { locale: 'de' as 'de' | 'en' };
    const zitadel = await signIn(page, stored);
    await page.goto('/profil');
    await page.getByRole('link', { name: /Sprache/ }).click();
    await expect(page).toHaveURL(url('/profil/sprache'));
    // Eine Markierung im Fenster überlebt nur, wenn die Seite nicht neu lädt.
    await page.evaluate(() => {
      (window as unknown as { plt09: boolean }).plt09 = true;
    });
    await page.getByText('English', { exact: true }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page).toHaveURL(url('/profil'));
    await expect(page.locator('#inhalt h1')).toHaveText('Profile');
    expect(await page.evaluate(() => (window as unknown as { plt09?: boolean }).plt09)).toBe(true);
    expect(stored.locale).toBe('en');

    // Abmelden; danach gilt bis zur Anmeldung die Browsersprache.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible();
    // Erneut anmelden, wie nach Eingabe der Zugangsdaten bei Zitadel.
    zitadel.session.active = true;
    await page.getByRole('button', { name: 'Anmelden' }).click();
    // Nach der Anmeldung gilt wieder die gespeicherte Sprache.
    await expect(page.locator('#inhalt h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
    await expect(
      page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', {
        name: 'Suppliers',
      }),
    ).toBeVisible();
  });
});
