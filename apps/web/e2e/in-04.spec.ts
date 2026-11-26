import { expect, test } from '@playwright/test';
import type { ActivityFeed } from '@reziproq/shared';
import { id, signIn } from './route-walk.js';

// IN-04: abgelegte Mails in den Aktivitäten und eine weitergeleitete Mail in „Neu eingegangen“,
// auf Telefonbreite und am Schreibtisch, ohne seitliches Scrollen.

const uuid = (n: number) => `0190a0a0-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`;
const mailId = uuid(2);
const feed: ActivityFeed = {
  canWrite: true,
  items: [
    {
      id: `mail:${mailId}`,
      kind: 'mail',
      occurredAt: '2026-11-20T09:30:00Z',
      actor: { type: 'person', name: 'Sara Ost' },
      title:
        'Kapazitätsplanung 2028 mit sehr langem Betreff für die zweite Fertigungslinie in Gliwice',
      code: 'addin',
      meta: 'Tom Weber',
      href: null,
      visibility: 'team',
      pinned: false,
      mine: true,
      mail: {
        id: mailId,
        fromEmail: 'tom.weber@rheintal-elektronik.example',
        fromName: 'Tom Weber',
        sentAt: '2026-11-20T09:30:00Z',
        summary:
          'Rheintal plant 2028 eine zweite Fertigungslinie, die Kapazität steigt um 30 Prozent. Tom möchte den Plan im nächsten Quartalsreview besprechen.',
        source: 'addin',
        attachments: [
          {
            id: uuid(3),
            fileName: 'Kapazitaetsplan-2028-Entwurf-mit-langem-Namen.pdf',
            mime: 'application/pdf',
            size: 182_000,
            stored: true,
          },
        ],
      },
    },
    {
      id: `mail:${uuid(4)}`,
      kind: 'mail',
      occurredAt: '2026-11-22T14:05:00Z',
      actor: { type: 'person', name: 'Sara Ost' },
      title: 'Lieferplan Januar',
      code: 'forward',
      meta: 'disposition@rheintal-elektronik.example',
      href: null,
      visibility: 'private',
      pinned: false,
      mine: false,
      mail: {
        id: uuid(4),
        fromEmail: 'disposition@rheintal-elektronik.example',
        fromName: null,
        sentAt: '2026-11-22T14:05:00Z',
        summary: null,
        source: 'forward',
        attachments: [],
      },
    },
  ],
};
const mailReview = {
  items: [
    {
      id: uuid(5),
      source: 'inbound',
      kind: 'inbound',
      objectType: 'inbound_item',
      subject: 'Kapazitätsplanung 2028',
      counterpart: 'Rheintal Elektronik',
      relationshipId: id,
      title: 'Mail zuordnen: Kapazitätsplanung 2028',
      lines: [],
      sources: [],
      createdAt: '2026-11-23T08:00:00Z',
      reviewSeconds: 20,
      adjust: 'place',
      text: null,
      href: '/kurz-pruefen',
      canAccept: true,
      inbound: {
        kind: 'mail',
        from: 'tom@rheintal.example',
        startsAt: '2026-11-23T08:00:00Z',
        suggestionKind: 'supplier',
        suggestions: [{ relationshipId: id, name: 'Rheintal Elektronik' }],
        suggestedType: 'other',
        reason: 'Absender von rheintal.example',
        options: [{ relationshipId: id, name: 'Rheintal Elektronik' }],
      },
    },
  ],
  minutes: 1,
};
const noScroll = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const width of [390, 1440]) {
  test(`Mails in den Aktivitäten ohne seitliches Scrollen (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, { locale: 'de' });
    await page.route('**/api/me/permissions', (route) =>
      route.fulfill({
        json: { actions: ['lieferanten.sehen', 'aktivitaeten.sehen', 'notizen.schreiben'] },
      }),
    );
    await page.route(`**/api/suppliers/${id}/aktivitaeten**`, (route) =>
      route.fulfill({ json: feed }),
    );
    await page.route(`**/api/suppliers/${id}/mails/${mailId}`, (route) =>
      route.fulfill({
        json: {
          id: mailId,
          subject: 'Kapazitätsplanung 2028',
          toEmails: ['sara.ost@hollmann-antriebe.example'],
          bodyText:
            'Hallo Sara,\n\nwir planen für 2028 eine zweite Fertigungslinie in Gliwice. Damit steigt unsere Kapazität um 30 Prozent.\n\nViele Grüße\nTom',
        },
      }),
    );
    await page.goto(`/lieferanten/${id}/aktivitaeten`);
    await expect(page.getByText('Zusammengefasst von Reziproq')).toBeVisible();
    await page.getByRole('button', { name: 'Text anzeigen' }).first().click();
    await expect(page.getByText(/zweite Fertigungslinie in Gliwice\. Damit/)).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(await noScroll(page)).toBe(0);
    if (process.env.IN04_SHOTS) {
      await page.screenshot({
        path: `${process.env.IN04_SHOTS}/aktivitaeten-${width}.png`,
        fullPage: true,
      });
    }
  });

  test(`weitergeleitete Mail in Kurz prüfen ohne seitliches Scrollen (${width})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, { locale: 'de' });
    await page.route('**/api/me/permissions', (route) =>
      route.fulfill({
        json: { actions: ['termine.sehen', 'notizen.schreiben', 'lieferanten.sehen'] },
      }),
    );
    // Seit K1-e.3 steht die Mail als Eintrag in Kurz prüfen (Neu eingegangen ist aufgelöst).
    await page.route(/\/api\/kurz-pruefen(\?.*)?$/, (route) => route.fulfill({ json: mailReview }));
    await page.goto('/kurz-pruefen');
    await expect(page.getByText('Mail von tom@rheintal.example')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Übernehmen' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(await noScroll(page)).toBe(0);
    if (process.env.IN04_SHOTS) {
      await page.screenshot({
        path: `${process.env.IN04_SHOTS}/kurz-pruefen-mail-${width}.png`,
        fullPage: true,
      });
    }
  });
}
