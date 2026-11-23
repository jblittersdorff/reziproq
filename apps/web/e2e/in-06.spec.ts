import { expect, test } from '@playwright/test';
import { defaultNotificationModes, type NotificationPrefs } from '@reziproq/shared';
import { signIn } from './route-walk.js';

// IN-06: Profil › Benachrichtigungen auf Telefonbreite und am Schreibtisch, ohne seitliches Scrollen.

const prefs: NotificationPrefs = {
  modes: defaultNotificationModes,
  quietHours: { from: '19:00', to: '07:00', weekend: true },
  teamsAvailable: true,
  teamsLinked: true,
  mailEnabled: true,
  canManageOrganization: true,
  recent: [
    {
      id: '0190a0a0-0000-7000-8000-000000000001',
      channel: 'teams',
      kind: 'brief_ready',
      title: 'JBP Rheintal am 04.12.: Briefing steht',
      status: 'sent',
      delivery: 'now',
      createdAt: '2026-11-26T09:00:00Z',
    },
    {
      id: '0190a0a0-0000-7000-8000-000000000002',
      channel: 'mail',
      kind: 'hint_high',
      title: 'Liefertreue Rheintal unter 90 %',
      status: 'queued',
      delivery: 'digest',
      createdAt: '2026-11-26T08:10:00Z',
    },
  ],
};

for (const width of [390, 1440]) {
  test(`Benachrichtigungen ohne seitliches Scrollen (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, { locale: 'de' });
    await page.route('**/api/profil/benachrichtigungen', (route) => route.fulfill({ json: prefs }));
    await page.goto('/profil/benachrichtigungen');
    await expect(page.getByRole('heading', { level: 1, name: 'Benachrichtigungen' })).toBeVisible();
    await expect(page.getByText('Briefing fertig', { exact: true })).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    if (process.env.IN06_SHOTS) {
      await page.screenshot({
        path: `${process.env.IN06_SHOTS}/benachrichtigungen-${width}.png`,
        fullPage: true,
      });
    }
  });
}
