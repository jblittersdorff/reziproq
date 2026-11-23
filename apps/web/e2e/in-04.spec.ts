import { expect, test } from '@playwright/test';
import type { ActivityFeed, Inbox } from '@reziproq/shared';
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
const inbox: Inbox = {
  open: [
    {
      id: uuid(10),
      kind: 'mail',
      source: 'inbound_mail',
      receivedAt: '2026-11-23T08:00:00Z',
      subject: 'Einladung Fachmesse Kunststoffe',
      startsAt: '2026-11-22T14:05:00Z',
      organizer: 'info@messe-kunststoffe.example',
      attendees: 0,
      suggestionKind: 'none',
      suggestions: [],
      suggestionReason:
        'Absender von messe-kunststoffe.example sind noch keinem Lieferanten zugeordnet.',
      suggestedType: 'other',
      status: 'needs_review',
      objectType: null,
      assigned: [],
    },
  ],
  today: [
    {
      id: uuid(11),
      kind: 'mail',
      source: 'inbound_mail',
      receivedAt: '2026-11-23T07:00:00Z',
      subject: 'Lieferplan Januar',
      startsAt: '2026-11-22T14:05:00Z',
      organizer: 'disposition@rheintal-elektronik.example',
      attendees: 1,
      suggestionKind: 'supplier',
      suggestions: [],
      suggestionReason: null,
      suggestedType: 'other',
      status: 'assigned',
      objectType: 'filed_mail',
      assigned: [
        { relationshipId: id, name: 'Rheintal Elektronik', meetingId: null, mailId: uuid(4) },
      ],
    },
  ],
  suppliers: [{ relationshipId: id, name: 'Rheintal Elektronik' }],
  active: true,
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
          toEmails: ['sara.ost@nordwind-antriebe.example'],
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

  test(`weitergeleitete Mail in „Neu eingegangen“ ohne seitliches Scrollen (${width})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, { locale: 'de' });
    await page.route('**/api/me/permissions', (route) =>
      route.fulfill({
        json: { actions: ['termine.sehen', 'notizen.schreiben', 'lieferanten.sehen'] },
      }),
    );
    await page.route('**/api/mein-tag/eingang', (route) => route.fulfill({ json: inbox }));
    await page.goto('/mein-tag/eingang');
    await expect(page.getByText('Weitergeleitete Mail').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ablegen' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(await noScroll(page)).toBe(0);
    if (process.env.IN04_SHOTS) {
      await page.screenshot({
        path: `${process.env.IN04_SHOTS}/eingang-${width}.png`,
        fullPage: true,
      });
    }
  });
}
