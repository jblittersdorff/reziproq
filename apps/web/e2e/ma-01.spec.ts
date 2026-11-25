import { expect, type Page, test } from '@playwright/test';
import type { MyAgent, MyAgentTask } from '@reziproq/shared';
import { signIn } from './route-walk.js';

// MA-01 Mein Agent (K1-f.3, Vorlage Mein-Agent) im Browser: bei 390 und 1440 px ohne seitliches
// Scrollen, die Stufe mit der Tastatur wählbar, gesperrte Stufen nicht. Mit UX_SHOTS entstehen
// Bilder zum Vergleich mit der Vorlage.

test.use({ locale: 'de-DE', colorScheme: 'light' });

const sideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const task = (key: string, extra: Partial<MyAgentTask> = {}): MyAgentTask => ({
  key,
  allowedLevels: ['suggest', 'prepare', 'do'],
  selectable: ['suggest', 'prepare', 'do'],
  defaultLevel: 'prepare',
  chosen: null,
  level: 'prepare',
  enabled: true,
  cap: null,
  adoption: null,
  ...extra,
});

const agent: MyAgent = {
  week: { since: '2026-11-23T00:00:00.000+01:00', done: 61, prepared: 23 },
  adoption: { unchanged: 87, decided: 100 },
  tasks: [
    task('inbox', { defaultLevel: 'do', level: 'do', adoption: { unchanged: 50, decided: 52 } }),
    task('meeting_brief', {
      allowedLevels: ['suggest', 'prepare'],
      selectable: ['prepare'],
      adoption: { unchanged: 6, decided: 7 },
    }),
    task('meeting_capture', {
      allowedLevels: ['suggest', 'prepare'],
      selectable: ['prepare'],
      adoption: { unchanged: 4, decided: 6 },
    }),
    task('import_assign', { selectable: ['prepare'] }),
    task('early_warning', {
      allowedLevels: ['suggest', 'prepare'],
      selectable: ['suggest'],
      defaultLevel: 'suggest',
      level: 'suggest',
    }),
    task('value_finder', {
      allowedLevels: ['suggest', 'prepare'],
      selectable: ['suggest'],
      defaultLevel: 'suggest',
      level: 'suggest',
    }),
    task('market_signals', {
      allowedLevels: ['suggest'],
      selectable: ['suggest'],
      defaultLevel: 'suggest',
      level: 'suggest',
    }),
  ],
  canEdit: true,
  canManage: true,
};

async function mockAgent(page: Page, saved: unknown[]) {
  await page.route('**/api/mein-agent', (route) => route.fulfill({ json: agent }));
  await page.route('**/api/mein-agent/*', (route) => {
    const body = route.request().postDataJSON() as { level: MyAgentTask['level'] };
    saved.push({ url: new URL(route.request().url()).pathname, body });
    const key = new URL(route.request().url()).pathname.split('/').at(-1);
    const updated = agent.tasks.find((entry) => entry.key === key);
    return route.fulfill({ json: { ...updated, chosen: body.level, level: body.level } });
  });
}

for (const width of [390, 1440]) {
  test(`Mein Agent bei ${width} px: alle Aufgaben, ohne seitliches Scrollen`, async ({ page }) => {
    await signIn(page, { locale: 'de' });
    await mockAgent(page, []);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/mein-agent');
    await expect(page.getByRole('heading', { level: 1, name: 'Mein Agent' })).toBeVisible();
    await expect(page.getByRole('group', { name: /Wie viel Reziproq bei/ })).toHaveCount(7);
    await page.waitForLoadState('networkidle');
    expect(await sideScroll(page)).toBe(0);
    // Jede Stufe hat eine Klickfläche von mindestens 44 px (PLT-10)
    const heights = await page
      .getByRole('group', { name: 'Wie viel Reziproq bei „Postfach“ selbst tut' })
      .locator('label')
      .evaluateAll((labels) => labels.map((label) => label.getBoundingClientRect().height));
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
    if (process.env.UX_SHOTS) {
      await page.screenshot({
        path: `${process.env.UX_SHOTS}/mein-agent-${width}.png`,
        fullPage: true,
      });
    }
  });
}

test('Mit der Tastatur: Pfeiltasten wählen eine Stufe, gesperrte werden übersprungen', async ({
  page,
}) => {
  const saved: unknown[] = [];
  await signIn(page, { locale: 'de' });
  await mockAgent(page, saved);
  await page.goto('/mein-agent');
  const inbox = page.getByRole('group', { name: 'Wie viel Reziproq bei „Postfach“ selbst tut' });
  await inbox.getByRole('radio', { name: 'Erledigen' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(inbox.getByRole('radio', { name: 'Vorbereiten' })).toBeChecked();
  await expect
    .poll(() => saved)
    .toEqual([{ url: '/api/mein-agent/inbox', body: { level: 'prepare' } }]);
  // Termin-Briefing: nur Vorbereiten ist wählbar; die Pfeiltasten bleiben dort
  const brief = page.getByRole('group', {
    name: 'Wie viel Reziproq bei „Termin-Briefing“ selbst tut',
  });
  await brief.getByRole('radio', { name: 'Vorbereiten' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(brief.getByRole('radio', { name: 'Vorbereiten' })).toBeChecked();
  await expect(brief.getByRole('radio', { name: 'Erledigen' })).toBeDisabled();
});
