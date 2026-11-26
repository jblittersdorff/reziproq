import { expect, type Page, test } from '@playwright/test';
import type { Commitment, Commitments } from '@reziproq/shared';
import { id, signIn } from './route-walk.js';

// ZQ-01 Regel 2, T2-ZQ2 (K2-a.2): Im Gemeinsamen Plan bucht „Gehalten“ erst mit Beleg. Die Zeile
// fragt nach Art und Notiz, ohne Überlagerung, und lässt sich mit der Tastatur bedienen. Ein
// gebuchter Beleg steht in der Zeile. Bei 390 und 1440 px ohne seitliches Scrollen; mit UX_SHOTS
// entstehen Bilder.

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
