import { expect, test } from '@playwright/test';
import type { InboundItemView, Inbox } from '@reziproq/shared';
import { signIn } from './route-walk.js';

// IN-03: Neu eingegangen auf Telefonbreite und am Schreibtisch, das Outlook-Add-in schmal wie ein
// Aufgabenbereich; ohne seitliches Scrollen.

const uuid = (n: number) => `0190a0a0-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`;
const item = (n: number, overrides: Partial<InboundItemView>): InboundItemView => ({
  id: uuid(n),
  source: 'inbound_mail',
  receivedAt: '2026-11-23T08:00:00Z',
  subject: 'Termin',
  startsAt: '2026-12-09T13:00:00Z',
  organizer: 'Ida Roth',
  attendees: 4,
  suggestionKind: 'supplier',
  suggestions: [{ relationshipId: uuid(50), name: 'Rheintal Elektronik' }],
  suggestionReason: null,
  suggestedType: 'other',
  status: 'needs_review',
  objectType: null,
  assigned: [],
  ...overrides,
});
const inbox: Inbox = {
  open: [
    item(1, {
      subject: 'Abstimmung Musterteile Starrflex',
      suggestedType: 'site_visit',
      suggestionReason: 'Rheintal Elektronik: Teilnehmer von rheintal-elektronik.de.',
    }),
    item(2, {
      subject: 'Call Guss Q1',
      source: 'calendar_sync',
      organizer: null,
      suggestionKind: 'several',
      suggestionReason:
        'Silesia Guss: Teilnehmer von silesia-guss.pl · Lombardia Fonderie: Teilnehmer von lombardia.it.',
      suggestions: [
        { relationshipId: uuid(51), name: 'Silesia Guss' },
        { relationshipId: uuid(52), name: 'Lombardia Fonderie' },
      ],
    }),
    item(3, {
      subject: 'Lieferantentag 2027',
      attendees: 46,
      suggestionKind: 'event',
      suggestions: [],
      suggestionReason: 'Teilnehmer von mehr als 5 Lieferanten: eher ein Ereignis ohne Lieferant.',
    }),
  ],
  today: [
    item(4, {
      subject: 'JBP Rheintal Elektronik · Planung 2027',
      source: 'outlook_addin',
      status: 'auto_assigned',
      objectType: 'meeting',
      suggestedType: 'jbp',
      assigned: [{ relationshipId: uuid(50), name: 'Rheintal Elektronik', meetingId: uuid(60) }],
    }),
  ],
  suppliers: [
    { relationshipId: uuid(50), name: 'Rheintal Elektronik' },
    { relationshipId: uuid(51), name: 'Silesia Guss' },
    { relationshipId: uuid(52), name: 'Lombardia Fonderie' },
  ],
  active: true,
};

for (const width of [390, 1440]) {
  test(`Neu eingegangen ohne seitliches Scrollen (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, { locale: 'de' });
    await page.route('**/api/me/permissions', (route) =>
      route.fulfill({ json: { actions: ['termine.sehen', 'termine.bearbeiten', 'lieferanten.sehen'] } }),
    );
    await page.route('**/api/mein-tag/eingang', (route) => route.fulfill({ json: inbox }));
    await page.goto('/mein-tag/eingang');
    await expect(page.getByRole('heading', { level: 1, name: 'Neu eingegangen' })).toBeVisible();
    await expect(page.getByText('3 Termine warten auf eine Zuordnung')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    if (process.env.IN03_SHOTS) {
      await page.screenshot({ path: `${process.env.IN03_SHOTS}/eingang-${width}.png`, fullPage: true });
    }
  });
}

test('Outlook-Add-in im schmalen Aufgabenbereich', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await signIn(page, { locale: 'de' });
  await page.route('**/api/termine/addin/erkennen', (route) =>
    route.fulfill({
      json: {
        supplier: { relationshipId: uuid(50), name: 'Rheintal Elektronik' },
        candidates: [{ relationshipId: uuid(50), name: 'Rheintal Elektronik' }],
        reason: 'Rheintal Elektronik: Teilnehmer von rheintal-elektronik.de.',
        suggestedType: 'quarterly_review',
      },
    }),
  );
  await page.goto('/addin/outlook');
  await expect(page.getByRole('button', { name: 'Als Aktivität speichern' })).toBeVisible();
  await expect(page.getByText('Erkannter Lieferant')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);
  if (process.env.IN03_SHOTS) {
    await page.screenshot({ path: `${process.env.IN03_SHOTS}/addin-320.png`, fullPage: true });
  }
});
