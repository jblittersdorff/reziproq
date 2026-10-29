import { expect, test } from '@playwright/test';

test('Startseite zeigt die Begrüßung der API', async ({ page }) => {
  // Die API wird hier simuliert, damit der Test ohne Datenbank läuft.
  await page.route('**/api/hello*', (route) =>
    route.fulfill({ json: { message: 'Hallo, Welt!' } }),
  );

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'reziproq' })).toBeVisible();
  await expect(page.getByText('Hallo, Welt!')).toBeVisible();
});
