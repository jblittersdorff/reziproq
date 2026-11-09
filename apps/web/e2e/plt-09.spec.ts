import { expect, test } from '@playwright/test';
import { de } from '../src/locales/de.js';
import { en } from '../src/locales/en.js';
import { allRoutes, id, signIn } from './route-walk.js';

// Tests zu docs/specs/PLT-09.md, die einen echten Browser brauchen: jede Route auf Englisch,
// Sprache bleibt nach Abmelden und erneutem Anmelden.

const url = (path: string) => `http://localhost:5174${path}`;

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
/**
 * Fundstellen deutscher Texte als ganze Wörter, damit „Land“ nicht in „Poland“ anschlägt. Ein
 * Bindestrich gehört zum Wort: Namen wie „Test-Lieferant (Demo)“ sind Eigennamen.
 */
function germanIn(text: string): string[] {
  return germanTexts.filter((german) =>
    new RegExp(`(^|[^\\p{L}-])${escapeRegExp(german)}($|[^\\p{L}-])`, 'u').test(text),
  );
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
    expect(germanIn('Acme-Lieferant')).toEqual([]);
    expect(keyPaths).toContain('workspace.areas.plan');
  });

  test('Ein Playwright-Test besucht jede Route auf Englisch. Keine Seite zeigt einen rohen Schlüssel oder deutschen Text aus der Übersetzungsdatei.', async ({
    page,
  }) => {
    // Rund 60 Routen; auf dem langsameren CI-Rechner braucht der Rundgang mehrere Minuten.
    test.setTimeout(480_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, { locale: 'en' });
    const findings: string[] = [];
    for (const path of allRoutes()) {
      await page.goto(path);
      // Weich, damit ein Lauf alle Routen ohne Titel meldet statt nur die erste.
      await expect
        .soft(page.locator('#inhalt h1, main h1, h1').first(), path)
        .toBeVisible({ timeout: 15_000 });
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
    // Die Sprache aus dem Konto gilt, sobald /me geladen ist; der Titel steht schon vorher.
    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('en');
    await expect(
      page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', {
        name: 'Suppliers',
      }),
    ).toBeVisible();
  });
});
