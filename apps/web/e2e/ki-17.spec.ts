import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// KI-17: Ergebnisse nach dem Termin auf Telefonbreite und am Schreibtisch, ohne seitliches
// Scrollen; private Punkte grau mit Schloss, geteilte Mint, Protokoll als Vorschau.

test.use({ locale: 'de-DE' });

const uuid = (n: number) => `0190a0a0-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`;
const id = uuid(1);
const mid = uuid(10);
const meeting = {
  meeting: {
    id: mid,
    type: 'jbp',
    title: 'JBP mit Rheintal Elektronik',
    startsAt: '2026-11-20T09:00:00Z',
    durationMinutes: 120,
    location: 'Teams',
    status: 'held',
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
};
const item = (overrides: Record<string, unknown>) => ({
  kind: 'commitment',
  title: 'Punkt',
  visibility: 'shared',
  quote: '',
  side: null,
  owner: null,
  ownerUnclear: false,
  dueOn: null,
  dateUnclear: false,
  addressee: null,
  commitmentId: null,
  commitmentTitle: null,
  proposal: null,
  goalKey: null,
  goalStatus: null,
  reason: null,
  createdId: null,
  ...overrides,
});
const draft = (n: number, entry: Record<string, unknown>) => ({
  id: uuid(n),
  status: 'draft',
  content: JSON.stringify(entry),
  model: 'test',
  createdAt: '2026-11-20T12:00:00Z',
  decidedAt: null,
  item: entry,
});
const notes = [
  'Zusage: Liefertreue-Bericht Oktober ist erledigt, liegt im Portal.',
  'Zusage: Tom Weber schickt den Kapazitätsplan 2028 bis 15.01.2027',
  'Zusage: Lena Berger teilt die rollierende Prognose bis 15.01.2027',
  'Zusage: Lea Brandt liefert ein Angebot für die Preisgleitklausel bis 19.12.2026',
  'Maßnahme: 8D-Prozess bei Reklamationen vereinheitlichen, Jonas Feld bis 31.01.2027',
  'Entscheidung: Pilot Konsignationslager ab Q2 2027 gemeinsam prüfen.',
  'Frage: Woher kommt das Laminat? (an Tom Weber)',
  'Preisgrenze: einer Erhöhung über 2 % nicht zustimmen.',
].join('\n');
const capture = {
  open: true,
  canCapture: true,
  canDecide: true,
  notes: {
    id: uuid(50),
    source: 'pasted',
    text: notes,
    createdAt: '2026-11-20T12:00:00Z',
    createdByName: 'Lena Berger',
  },
  drafts: [
    draft(
      60,
      item({
        kind: 'commitment_change',
        title: 'Liefertreue-Bericht Oktober',
        side: 'supplier',
        commitmentId: uuid(80),
        commitmentTitle: 'Liefertreue-Bericht Oktober',
        proposal: 'kept',
        quote: 'Zusage: Liefertreue-Bericht Oktober ist erledigt, liegt im Portal.',
      }),
    ),
    draft(
      61,
      item({
        title: 'Tom Weber schickt den Kapazitätsplan 2028',
        side: 'supplier',
        owner: 'Tom Weber',
        dueOn: '2027-01-15',
        quote: 'Zusage: Tom Weber schickt den Kapazitätsplan 2028 bis 15.01.2027',
      }),
    ),
    draft(
      62,
      item({
        title: 'Lena Berger teilt die rollierende Prognose',
        side: 'buyer',
        owner: 'Lena Berger',
        dueOn: '2027-01-15',
        quote: 'Zusage: Lena Berger teilt die rollierende Prognose bis 15.01.2027',
      }),
    ),
    draft(
      63,
      item({
        title: 'Lea Brandt liefert ein Angebot für die Preisgleitklausel',
        side: 'supplier',
        ownerUnclear: true,
        dueOn: '2026-12-19',
        quote: 'Zusage: Lea Brandt liefert ein Angebot für die Preisgleitklausel bis 19.12.2026',
      }),
    ),
    draft(
      64,
      item({
        kind: 'action',
        title: '8D-Prozess bei Reklamationen vereinheitlichen',
        owner: 'Jonas Feld',
        dueOn: '2027-01-31',
        quote: 'Maßnahme: 8D-Prozess bei Reklamationen vereinheitlichen, Jonas Feld bis 31.01.2027',
      }),
    ),
    draft(
      65,
      item({
        kind: 'decision',
        title: 'Pilot Konsignationslager ab Q2 2027 gemeinsam prüfen',
        quote: 'Entscheidung: Pilot Konsignationslager ab Q2 2027 gemeinsam prüfen.',
      }),
    ),
    draft(
      66,
      item({
        kind: 'open_question',
        title: 'Woher kommt das Laminat?',
        addressee: 'Tom Weber',
        quote: 'Frage: Woher kommt das Laminat? (an Tom Weber)',
      }),
    ),
    draft(
      67,
      item({
        kind: 'decision',
        title: 'einer Erhöhung über 2 % nicht zustimmen',
        visibility: 'internal',
        quote: 'Preisgrenze: einer Erhöhung über 2 % nicht zustimmen.',
      }),
    ),
    draft(
      68,
      item({
        kind: 'goal_check',
        title: '„Liefertreue“ wieder auf Kurs bringen',
        visibility: 'internal',
        goalKey: 'g1',
        goalStatus: 'partly',
        reason: 'Im Termin besprochen, noch nicht vereinbart.',
        quote: 'Zusage: Liefertreue-Bericht Oktober ist erledigt, liegt im Portal.',
      }),
    ),
  ],
  protocol: {
    text: 'Teilnehmer: Lena Berger, Jonas Feld, Tom Weber\n\nEntscheidungen\n- Pilot Konsignationslager ab Q2 2027 gemeinsam prüfen\n\nZusagen\n- Tom Weber schickt den Kapazitätsplan 2028 (Rheintal Elektronik GmbH (Demo), Tom Weber, bis 15.01.2027)\n- Lena Berger teilt die rollierende Prognose (Wir, Lena Berger, bis 15.01.2027)\n\nStand bestehender Zusagen\n- Liefertreue-Bericht Oktober: erledigt\n\nOffene Fragen\n- Woher kommt das Laminat? (an Tom Weber)',
    sharedCount: 7,
    internalCount: 1,
    sharedAt: null,
  },
  participants: [
    { name: 'Lena Berger', side: 'buyer' },
    { name: 'Jonas Feld', side: 'buyer' },
    { name: 'Tom Weber', side: 'supplier' },
  ],
};

async function mock(page: Page) {
  await fakeZitadel(page);
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Lena Berger',
        firstName: 'Lena',
        email: 'lena@example.com',
        organization: { id: 'org-1', name: 'Test-OEM (Demo)' },
        supportView: false,
        orgRole: 'admin',
        permissions: {
          viewOrganizationSettings: true,
          viewBuyerAreas: true,
          viewSuppliers: true,
          switchCustomer: false,
        },
      },
    }),
  );
  await page.route('**/api/me/permissions', (route) =>
    route.fulfill({
      json: { actions: ['lieferanten.sehen', 'termine.sehen', 'termine.bearbeiten'] },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route(`**/api/suppliers/${id}`, (route) =>
    route.fulfill({
      json: {
        relationshipId: id,
        name: 'Rheintal Elektronik GmbH (Demo)',
        organizationName: 'Rheintal Elektronik GmbH (Demo)',
        country: 'DE',
        vatId: null,
        duns: null,
        externalRef: 'L-10001',
        notes: null,
        status: 'active',
        createdAt: '2026-10-01T08:00:00Z',
        endedAt: null,
        spend: [],
        permissions: { edit: true, editTeam: true },
      },
    }),
  );
  await page.route(`**/api/suppliers/${id}/overview`, (route) =>
    route.fulfill({
      json: {
        head: { segment: null, sro: { userId: 'lena', name: 'Lena Berger' }, nextMeeting: null },
        metrics: [],
      },
    }),
  );
  await page.route('**/api/audit**', (route) => route.fulfill({ json: { entries: [] } }));
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
    route.fulfill({ json: meeting }),
  );
  await page.route(`**/api/suppliers/${id}/termine/${mid}/zusammenfassung`, (route) =>
    route.fulfill({ json: { canDraft: true, draft: null, accepted: null } }),
  );
  await page.route(`**/api/suppliers/${id}/termine/${mid}/ergebnisse`, (route) =>
    route.fulfill({ json: capture }),
  );
  await page.route(`**/api/suppliers/${id}/termine/${mid}/briefing`, (route) =>
    route.fulfill({ status: 404, json: { statusCode: 404 } }),
  );
}

for (const width of [390, 1440]) {
  test(`Ergebnisse nach dem Termin ohne seitliches Scrollen (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mock(page);
    await page.goto(`/lieferanten/${id}/umsetzung/termine/${mid}?reiter=ergebnisse`);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Zusagen', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Verantwortlich unklar')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    if (process.env.KI17_SHOTS) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `${process.env.KI17_SHOTS}/ergebnisse-${width}.png`,
        fullPage: true,
      });
    }
  });
}
