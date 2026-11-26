import { expect, type Page, test } from '@playwright/test';
import type { ActionItem, ActionList, Commitment, Commitments } from '@reziproq/shared';
import { id, signIn } from './route-walk.js';

// ZQ-01 Regel 2, T2-ZQ2 (K2-a.2): Im Gemeinsamen Plan bucht „Gehalten“ erst mit Beleg. Die Zeile
// fragt nach Art und Notiz, ohne Überlagerung, und lässt sich mit der Tastatur bedienen. Ein
// gebuchter Beleg steht in der Zeile. Bei 390 und 1440 px ohne seitliches Scrollen; mit UX_SHOTS
// entstehen Bilder. Seit K2-a.3 gilt dasselbe auf den alten Maßnahmen-Seiten, die bis zur Akte
// (K2-c) Zusagen und Aufgaben zeigen; das Formular fragt nach der Art statt nach der Sichtbarkeit.

test.use({ locale: 'de-DE', colorScheme: 'light' });

const sideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const shot = async (page: Page, name: string) => {
  if (process.env.UX_SHOTS) {
    await page.screenshot({ path: `${process.env.UX_SHOTS}/${name}.png`, fullPage: true });
  }
};

const row = (n: number, extra: Partial<Commitment>): Commitment => ({
  id: `0190a0a0-0000-7000-8000-0000000000c${n}`,
  side: 'buyer',
  own: true,
  title: `Zusage ${n}`,
  ownerUserId: 'lena',
  ownerName: 'Lena Berger',
  dueOn: '2099-11-30',
  status: 'open',
  evidence: null,
  overdue: false,
  initiative: null,
  ...extra,
});

const commitments: Commitments = {
  hasPlan: true,
  ownSide: 'buyer',
  canEdit: true,
  people: [{ userId: 'lena', name: 'Lena Berger' }],
  initiatives: [],
  buyer: [row(1, { title: 'Zeichnung Rev. C an Rheintal' })],
  supplier: [
    row(2, {
      side: 'supplier',
      own: false,
      title: '8D-Bericht Charge 4711',
      ownerUserId: null,
      ownerName: 'Nils Ott',
      status: 'kept',
      evidence: { kind: 'goods_receipt', byName: 'Lena Berger', note: 'WE 4711' },
    }),
  ],
};

for (const width of [390, 1440]) {
  test(`Zusage im Gemeinsamen Plan: „Gehalten“ erst mit Beleg, mit der Tastatur, ${width} px (ZQ-01)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, { locale: 'de' });
    const sent: unknown[] = [];
    await page.route(`**/api/suppliers/${id}/jbp/zusagen`, (route) =>
      route.fulfill({ json: commitments }),
    );
    await page.route(`**/api/suppliers/${id}/jbp/zusagen/*/status`, (route) => {
      sent.push(route.request().postDataJSON());
      return route.fulfill({ json: commitments });
    });
    await page.goto(`/lieferanten/${id}/plan/zusagen`);
    await expect(
      page.getByText('Beleg: Wareneingang · gebucht von Lena Berger · WE 4711'),
    ).toBeVisible();

    const status = page.getByRole('combobox', { name: 'Status: Zeichnung Rev. C an Rheintal' });
    await status.focus();
    await status.selectOption('kept');
    const form = page.getByRole('form', { name: 'Beleg für „Zeichnung Rev. C an Rheintal“' });
    await expect(form).toBeVisible();
    await expect(form.getByRole('button', { name: 'Als gehalten buchen' })).toBeDisabled();
    expect(sent).toEqual([]);
    expect(await sideScroll(page)).toBe(0);
    await form.scrollIntoViewIfNeeded();
    await shot(page, `zq-01-beleg-${width}`);

    await form.getByRole('combobox', { name: 'Beleg' }).selectOption('document');
    await form
      .getByRole('textbox', { name: 'Notiz (optional)' })
      .fill('Zeichnung per Mail an Kim Kaiser');
    await form.getByRole('button', { name: 'Als gehalten buchen' }).focus();
    await page.keyboard.press('Enter');
    await expect
      .poll(() => sent)
      .toEqual([
        {
          status: 'kept',
          evidence: { kind: 'document', note: 'Zeichnung per Mail an Kim Kaiser' },
        },
      ]);
    await expect(form).toBeHidden();
  });
}

const meeting = '0190a0a0-0000-7000-8000-0000000000e1';
const entry = (n: number, extra: Partial<ActionItem>): ActionItem => ({
  id: `0190a0a0-0000-7000-8000-0000000000d${n}`,
  kind: 'commitment',
  title: `Eintrag ${n}`,
  description: null,
  visibility: 'shared',
  side: 'buyer',
  own: true,
  ownerSide: 'buyer',
  ownerUserId: 'lena',
  ownerName: 'Lena Berger',
  dueDate: '2099-11-30',
  status: 'open',
  evidence: null,
  overdue: false,
  sourceType: 'manual',
  sourceId: null,
  sourceTitle: null,
  sourceDimension: null,
  canEdit: true,
  canChangeStatus: true,
  ...extra,
});

const workItems: ActionList = {
  actions: [
    entry(1, {
      title: 'Zweitquelle für Gehäuse prüfen',
      dueDate: '2026-11-20',
      overdue: true,
      sourceType: 'meeting',
      sourceId: meeting,
      sourceTitle: 'Quartalsreview Q3',
    }),
    entry(2, {
      title: 'Wöchentlicher Bericht zur Leiterplatten-Lage',
      side: 'supplier',
      own: false,
      ownerSide: 'supplier',
      ownerUserId: null,
      ownerName: 'Nils Ott',
      canEdit: false,
      status: 'kept',
      evidence: { kind: 'delivery_advice', byName: 'Lena Berger', note: 'Avis KW 47' },
    }),
    entry(3, {
      kind: 'task',
      visibility: 'internal',
      title: 'Preisspielraum für 2027 klären',
      status: 'in_progress',
    }),
    entry(4, {
      title: 'Muster bis März',
      visibility: 'internal',
      ownerSide: 'supplier',
      ownerUserId: null,
      ownerName: 'Kim Kaiser',
      sourceType: 'meeting',
      sourceId: meeting,
      sourceTitle: 'Quartalsreview Q3',
    }),
  ],
  canCreate: true,
  people: [{ userId: 'lena', name: 'Lena Berger' }],
};

for (const width of [390, 1440]) {
  test(`Zusagen und Aufgaben: Status je Art, „Gehalten“ erst mit Beleg, ${width} px (ZQ-01, K2-a.3)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, { locale: 'de' });
    const sent: unknown[] = [];
    await page.route(`**/api/suppliers/${id}/massnahmen`, (route) =>
      route.fulfill({ json: workItems }),
    );
    await page.route(`**/api/suppliers/${id}/massnahmen/*/status`, (route) => {
      sent.push(route.request().postDataJSON());
      return route.fulfill({ json: workItems.actions[0] });
    });
    await page.goto(`/lieferanten/${id}/umsetzung/massnahmen?status=alle`);
    await expect(
      page.getByRole('heading', { name: 'Zusagen und Aufgaben', level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText('Beleg: Lieferavis · gebucht von Lena Berger · Avis KW 47'),
    ).toBeVisible();
    const task = page.getByRole('combobox', {
      name: 'Status von „Preisspielraum für 2027 klären“',
    });
    await expect(task.locator('option')).toHaveText([
      'Offen',
      'In Arbeit',
      'Erledigt',
      'Abgebrochen',
    ]);
    expect(await sideScroll(page)).toBe(0);
    await shot(page, `zq-01-liste-${width}`);

    const status = page.getByRole('combobox', {
      name: 'Status von „Zweitquelle für Gehäuse prüfen“',
    });
    await expect(status.locator('option')).toHaveText([
      'Offen',
      'Gehalten',
      'Nicht gehalten',
      'Zurückgezogen',
    ]);
    await status.focus();
    await status.selectOption('kept');
    const form = page.getByRole('form', { name: 'Beleg für „Zweitquelle für Gehäuse prüfen“' });
    await expect(form).toBeVisible();
    await expect(form.getByRole('button', { name: 'Als gehalten buchen' })).toBeDisabled();
    expect(sent).toEqual([]);
    expect(await sideScroll(page)).toBe(0);
    await form.scrollIntoViewIfNeeded();
    await shot(page, `zq-01-liste-beleg-${width}`);

    await form.getByRole('combobox', { name: 'Beleg' }).selectOption('confirmation');
    await form.getByRole('button', { name: 'Als gehalten buchen' }).focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => sent).toEqual([{ status: 'kept', evidence: { kind: 'confirmation' } }]);
    await expect(form).toBeHidden();
  });

  test(`Neue Zusage oder Aufgabe: Art statt Sichtbarkeit, ${width} px (ZQ-01, K2-a.3)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, { locale: 'de' });
    await page.route(`**/api/suppliers/${id}/massnahmen`, (route) =>
      route.fulfill({ json: workItems }),
    );
    await page.goto(`/lieferanten/${id}/umsetzung/massnahmen/neu`);
    await expect(
      page.getByRole('heading', { name: 'Neue Zusage oder Aufgabe', level: 1 }),
    ).toBeVisible();
    const kind = page.getByRole('combobox', { name: 'Art' });
    await expect(kind).toHaveValue('commitment');
    await expect(page.getByRole('combobox', { name: 'Verantwortliche Seite' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zusage anlegen' })).toBeVisible();
    expect(await sideScroll(page)).toBe(0);
    await shot(page, `zq-01-neu-${width}`);
    // Eine Aufgabe gehört der eigenen Seite: keine Wahl der Seite
    await kind.selectOption('task');
    await expect(page.getByRole('combobox', { name: 'Verantwortliche Seite' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Aufgabe anlegen' })).toBeVisible();
  });
}
