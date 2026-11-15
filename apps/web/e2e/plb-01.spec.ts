import { readFileSync } from 'node:fs';
import { expect, type Page, type TestInfo, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Browsertests zu docs/specs/PLB-01.md: Übersicht, Rechte und Pflichten, Formular und Vorschau.
// Die Daten stammen aus dem Standardkatalog; Screenshots hell und dunkel, breit und schmal.

test.use({ locale: 'de-DE' });

const read = (language: string) =>
  JSON.parse(
    readFileSync(
      new URL(`../../../packages/db/seed/catalog.${language}.json`, import.meta.url),
      'utf8',
    ),
  );
const de = read('de');
const en = read('en');
const uuid = (n: number) => `0190a0a0-0000-7000-8000-${String(n).padStart(12, '0')}`;
const keys: string[] = de.rules.map((rule: { key: string }) => rule.key);
const rules = de.rules.map(
  (
    rule: {
      key: string;
      kind: string;
      group: string;
      counterpart: string;
      minImpactLevel: number;
      title: string;
      description: string;
    },
    index: number,
  ) => {
    const english = en.rules.find((entry: { key: string }) => entry.key === rule.key);
    return {
      id: uuid(index + 1),
      kind: rule.kind,
      group: rule.group,
      title: { de: rule.title, en: english.title },
      description: { de: rule.description, en: english.description },
      // Ein Recht ohne Gegenpflicht, damit die Warnung sichtbar ist.
      counterpartId:
        rule.key === 'fast_approvals' || rule.key === 'mutual_feedback'
          ? null
          : uuid(keys.indexOf(rule.counterpart) + 1),
      minImpactLevel: rule.minImpactLevel,
    };
  },
);
const formats = de.formats.map(
  (
    format: {
      key: string;
      level: string;
      cadence: string;
      minImpactLevel: number;
      forQualityLevels: number[];
      name: string;
      purpose: string;
    },
    index: number,
  ) => {
    const english = en.formats.find((entry: { key: string }) => entry.key === format.key);
    return {
      id: uuid(100 + index),
      name: { de: format.name, en: english.name },
      purpose: { de: format.purpose, en: english.purpose },
      level: format.level,
      cadence: format.cadence,
      minImpactLevel: format.minImpactLevel,
      forQualityLevels: format.forQualityLevels,
    };
  },
);

async function mockAdmin(page: Page) {
  await fakeZitadel(page);
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Lena Berger',
        firstName: 'Lena',
        email: 'lena@example.com',
        organization: { id: 'org-1', name: 'Test-OEM (Demo)' },
        supportView: false,
        orgRole: 'admin',
        permissions: {
          viewOrganizationSettings: true,
          viewBuyerAreas: true,
          viewSuppliers: true,
          viewCustomers: false,
          switchCustomer: false,
        },
      },
    }),
  );
  await page.route('**/api/me/permissions', (route) =>
    route.fulfill({
      json: {
        actions: [
          'organisation.sehen',
          'einstellungen.verwalten',
          'spielregeln.sehen',
          'spielregeln.verwalten',
        ],
      },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route('**/api/segment-model', (route) =>
    route.fulfill({ json: { active: null, draft: null } }),
  );
  await page.route('**/api/playbook', (route) =>
    route.fulfill({ json: { rules, formats, canManage: true } }),
  );
  await page.route('**/api/playbook/preview/3/1', (route) =>
    route.fulfill({
      json: {
        impactLevel: 3,
        qualityLevel: 1,
        typeName: null,
        rules,
        formats: formats.filter(
          (format: { forQualityLevels: number[] }) =>
            format.forQualityLevels.length === 0 || format.forQualityLevels.includes(1),
        ),
      },
    }),
  );
}

/** Kein Element ragt über den Rand; Screenshots hell und dunkel, 1440 und 390 Pixel breit. */
async function shoot(page: Page, testInfo: TestInfo, name: string) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    // Es gibt nur ein helles Thema (Designsprache).
    for (const colorScheme of ['light'] as const) {
      await page.emulateMedia({ colorScheme });
      // Farbübergänge der Kacheln abwarten, sonst zeigt der Screenshot Zwischenfarben.
      await page.waitForTimeout(300);
      const overflowing = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('body *')]
          .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
          .map((element) => `${element.tagName.toLowerCase()}.${String(element.className)}`)
          .slice(-12),
      );
      expect(overflowing).toEqual([]);
      const path = testInfo.outputPath(`${name}-${colorScheme}-${width}.png`);
      await page.screenshot({ path, fullPage: true });
      await testInfo.attach(`${name}-${colorScheme}-${width}`, { path, contentType: 'image/png' });
    }
  }
}

test('PLB-01 Spielregeln: Übersicht, Rechte und Pflichten, Formular, Vorschau', async ({
  page,
}, testInfo) => {
  await mockAdmin(page);
  await page.goto('/einstellungen/spielregeln');
  await expect(page.locator('#inhalt h1')).toHaveText('Spielregeln');
  await expect(page.getByText('1 Recht ohne Gegenpflicht')).toBeVisible();
  await shoot(page, testInfo, 'plb-01-uebersicht');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('link', { name: /Rechte und Pflichten/ }).click();
  await expect(page.getByRole('table', { name: 'Kosten' })).toBeVisible();
  await expect(page.getByText('Ohne Gegenpflicht')).toBeVisible();
  await shoot(page, testInfo, 'plb-01-rechte');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('link', { name: 'Neu', exact: true }).click();
  await expect(
    page.getByText('Dieses Recht hat noch keine Gegenpflicht. Du kannst trotzdem speichern.'),
  ).toBeVisible();
  await shoot(page, testInfo, 'plb-01-formular');

  await page.goto('/einstellungen/spielregeln/formate');
  await expect(page.getByRole('table', { name: 'Formate' })).toBeVisible();
  await shoot(page, testInfo, 'plb-01-formate');

  await page.goto('/einstellungen/spielregeln/typ/3-1');
  await expect(page.getByRole('heading', { name: 'Pflichten' })).toBeVisible();
  await shoot(page, testInfo, 'plb-01-vorschau');
});
