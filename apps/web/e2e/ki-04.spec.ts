import { expect, test } from '@playwright/test';
import { id, signIn } from './route-walk.js';

const path = '/einstellungen/ki/agenten';
const run = {
  id,
  agentName: 'QBR-Vorbereitung',
  version: 1,
  status: 'done',
  isTest: false,
  isOwn: true,
  stepsUsed: 2,
  costCents: 1,
  createdAt: '2026-11-22T14:30:00Z',
  startedAt: '2026-11-22T14:30:01Z',
  finishedAt: '2026-11-22T14:30:03Z',
  cancellationPending: false,
  canResume: false,
  startedBy: 'Lena Berger',
};

for (const width of [390, 1440]) {
  test(`Agentenliste und Laufdetails sind bei ${width} px bedienbar`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, { locale: 'de' });
    await page.route('**/api/ki/agenten', (route) =>
      route.fulfill({
        json: {
          agents: [{ id, key: 'qbr_prep', enabled: true, version: 1, runCount: 1 }],
          recentRuns: [run],
          nextRunId: id,
          canManage: true,
        },
      }),
    );
    await page.route('**/api/ki/kontingent', (route) =>
      route.fulfill({
        json: {
          month: '2026-11',
          budgetMonthCents: 15000,
          usedCents: 1,
          calls: 1,
          byFeature: null,
        },
      }),
    );
    await page.route(`**/api/ki/agenten/laeufe/${id}`, (route) =>
      route.fulfill({
        json: {
          run,
          detailsAllowed: true,
          testResult: null,
          draftHref: `/lieferanten/${id}/umsetzung/termine/${id}`,
          sourceHref: `/lieferanten/${id}/umsetzung/termine/${id}`,
          steps: [
            { seq: 1, key: 'plan', status: 'done', finishedAt: run.finishedAt },
            { seq: 2, key: 'read', status: 'done', finishedAt: run.finishedAt },
          ],
        },
      }),
    );
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: 'Agenten' })).toBeVisible();
    await expect(page.getByText('Agenten von Reziproq')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: testInfo.outputPath(`agenten-${width}.png`), fullPage: true });
    await page.getByRole('region', { name: 'Letzte Läufe' }).getByRole('link').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Agentenlauf' })).toBeVisible();
    await expect(page.getByText('Terminfakten lesen')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Entwurf am Termin öffnen' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: testInfo.outputPath(`lauf-${width}.png`), fullPage: true });
  });
}
