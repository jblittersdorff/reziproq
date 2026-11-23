import { expect, type Page, test } from '@playwright/test';
import type { MeetingCapture, MeetingTranscriptState, TranscriptSettings } from '@reziproq/shared';
import { id, signIn } from './route-walk.js';

// IN-05: Transkript im Reiter Ergebnisse und Einstellungen › Anbindungen › Transkripte, auf
// Telefonbreite und am Schreibtisch, ohne seitliches Scrollen.

const mid = '0190a0a0-0000-7000-8000-000000000010';
const state: MeetingTranscriptState = {
  orgEnabled: true,
  optIn: true,
  canManage: true,
  canUpload: true,
  canRead: true,
  transcript: {
    id: '0190a0a0-0000-7000-8000-000000000020',
    source: 'teams',
    status: 'fetched',
    unavailableReason: null,
    durationS: 3120,
    speakers: [
      { label: 'Lena Berger', name: 'Lena Berger', side: 'buyer' },
      { label: 'Tom Weber', name: 'Tom Weber', side: 'supplier' },
      { label: 'Gast', name: 'Teilnehmer 1', side: 'unknown' },
    ],
    fetchedAt: '2026-11-20T10:30:00Z',
    deleteAfter: '2027-02-18T10:30:00Z',
    released: false,
  },
};
const capture: MeetingCapture = {
  open: true,
  canCapture: true,
  canDecide: true,
  notes: null,
  drafts: [],
  protocol: { text: '', sharedCount: 0, internalCount: 0, sharedAt: null },
  participants: [],
};
const settings: TranscriptSettings = {
  enabled: true,
  worksAgreement: { confirmedAt: '2026-11-18', confirmedBy: 'Lena Berger', hasFile: true },
  retentionDays: 90,
  teamsMode: 'meeting',
  inviteNotice:
    'Hinweis: Mit Zustimmung aller Teilnehmenden wird das Transkript dieses Termins in Reziproq übernommen.',
  canManage: true,
};

async function meetingPage(page: Page) {
  await signIn(page, { locale: 'de' });
  await page.route('**/api/me/permissions', (route) =>
    route.fulfill({
      json: {
        actions: [
          'lieferanten.sehen',
          'termine.sehen',
          'termine.bearbeiten',
          'einstellungen.verwalten',
        ],
      },
    }),
  );
  await page.route('**/api/suppliers/*/kommentare/meeting/*', (route) =>
    route.fulfill({
      json: {
        comments: [],
        canComment: false,
        objectVisibility: 'shared',
        people: { internal: [], shared: [] },
      },
    }),
  );
  await page.route(`**/api/suppliers/${id}/termine/${mid}`, (route) =>
    route.fulfill({
      json: {
        meeting: {
          id: mid,
          type: 'jbp',
          title: 'JBP Rheintal Planung 2027',
          startsAt: '2026-11-20T09:00:00Z',
          durationMinutes: 60,
          location: 'Teams',
          status: 'planned',
          ownerSide: 'buyer',
          protocol: null,
          createdByName: 'Lena Berger',
        },
        participants: [],
        agenda: [],
        decisions: [],
        note: null,
        canEditMeeting: true,
        canContribute: true,
        live: { sections: [], frozenAt: null },
        canClose: true,
      },
    }),
  );
  await page.route(`**/api/suppliers/${id}/termine/${mid}/zusammenfassung`, (route) =>
    route.fulfill({ json: { canDraft: true, draft: null, accepted: null } }),
  );
  await page.route(`**/api/suppliers/${id}/termine/${mid}/ergebnisse`, (route) =>
    route.fulfill({ json: capture }),
  );
  await page.route(`**/api/suppliers/${id}/termine/${mid}/transkript`, (route) =>
    route.fulfill({ json: state }),
  );
  await page.route(`**/api/suppliers/${id}/termine/${mid}/transkript/text`, (route) =>
    route.fulfill({
      json: {
        entries: [
          {
            at: 5,
            speaker: 'Lena Berger',
            text: 'Wir verlängern den Rahmenvertrag bis Ende März.',
          },
          {
            at: 70,
            speaker: 'Tom Weber',
            text: 'Den Kapazitätsplan 2028 schicke ich bis Freitag.',
          },
        ],
        quotes: ['Den Kapazitätsplan 2028 schicke ich bis Freitag.'],
      },
    }),
  );
}

const noScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const width of [390, 1440]) {
  test(`Transkript im Reiter Ergebnisse ohne seitliches Scrollen (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await meetingPage(page);
    await page.goto(`/lieferanten/${id}/umsetzung/termine/${mid}?reiter=ergebnisse`);
    await expect(page.getByText('Transkript aus Teams übernommen.')).toBeVisible();
    await page.getByRole('button', { name: 'Transkript ansehen' }).click();
    await expect(page.getByText('Wir verlängern den Rahmenvertrag bis Ende März.')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(await noScroll(page)).toBe(0);
    if (process.env.IN05_SHOTS) {
      await page.screenshot({
        path: `${process.env.IN05_SHOTS}/termin-${width}.png`,
        fullPage: true,
      });
    }
  });

  test(`Transkripte in den Anbindungen ohne seitliches Scrollen (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await meetingPage(page);
    await page.route('**/api/einstellungen/anbindungen', (route) =>
      route.fulfill({ json: { connectors: [], events: [], issue: null } }),
    );
    await page.route('**/api/einstellungen/transkripte', (route) =>
      route.fulfill({ json: settings }),
    );
    await page.goto('/einstellungen/anbindungen');
    await expect(page.getByRole('heading', { level: 2, name: 'Transkripte' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(await noScroll(page)).toBe(0);
    if (process.env.IN05_SHOTS) {
      await page.screenshot({
        path: `${process.env.IN05_SHOTS}/anbindungen-${width}.png`,
        fullPage: true,
      });
    }
  });
}
