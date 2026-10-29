import { expect, test } from '@playwright/test';

test.use({ locale: 'de-DE', colorScheme: 'light' });

test('Styleguide zeigt alle Abschnitte und die vier Diagramme', async ({ page }) => {
  await page.goto('/styleguide');

  await expect(page.getByRole('heading', { level: 1, name: 'Styleguide' })).toBeVisible();
  for (const section of [
    'Farben',
    'Schrift',
    'Knöpfe',
    'Formulare',
    'Tabellen',
    'Leere Zustände',
    'Diagramme',
  ]) {
    await expect(page.getByRole('heading', { level: 2, name: section })).toBeVisible();
  }

  for (const chart of [
    'Zwei Lieferanten sollen in die strategische Zone wechseln',
    'Die größte Lücke liegt bei der Kommunikation',
    'Service bewertet die Beziehung durchweg schwächer',
    'Die Hebel heben die EBIT-Wirkung auf 9,8 Mio. €',
  ]) {
    const figure = page.getByRole('img', { name: chart });
    await expect(figure).toBeVisible();
    await expect(figure.locator('svg').first()).toBeVisible();
  }

  await expect(page.getByText('Noch keine Bewertungen')).toBeVisible();
});

test('Darstellung und Sprache lassen sich per Tastatur umschalten', async ({ page }) => {
  await page.goto('/styleguide');

  await page.getByRole('radio', { name: 'System' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Dunkel' })).toBeChecked();
  await expect(page.locator('html')).toHaveClass(/dark/);

  await page.getByRole('radio', { name: 'Deutsch' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { level: 1, name: 'Style guide' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
});
