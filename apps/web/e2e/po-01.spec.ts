import { expect, test } from '@playwright/test';
import type { MailCommitmentsView } from '@reziproq/shared';
import { signIn } from './route-walk.js';

// PO-01 (K2-d.3b): Seite „Zusagen aus Mail“ nach der Vorlage K2-Mail-Zusage, am Schreibtisch und auf
// Telefonbreite ohne seitliches Scrollen. Mit UX_SHOTS entstehen Bilder.

const draftId = '0190a0a0-0000-7000-8000-0000000d0001';
const view: MailCommitmentsView = {
  draftId,
  status: 'draft',
  createdAt: '2026-11-23T08:13:00.000Z',
  relationship: { id: '0190a0a0-0000-7000-8000-0000000d0002', name: 'Rheintal Elektronik' },
  ownOrganization: 'Hollmann Antriebe',
  mail: {
    id: '0190a0a0-0000-7000-8000-0000000d0003',
    subject: 'Musterteile Starrflex und 8D 4711',
    fromName: 'Kim Kaiser',
    fromEmail: 'kim.kaiser@rheintal-elektronik.example',
    sentAt: '2026-11-23T08:12:00.000Z',
    summary:
      'Rheintal kann die Musterteile Starrflex bis 11.12. liefern, wenn eure Zeichnung Rev. C bis 30.11. da ist. Den 8D-Bericht zur Charge 4711 schickt Nils Ott bis Freitag.',
    assignedBy: 'reziproq',
  },
  commitments: [
    {
      title: 'Musterteile Starrflex',
      side: 'supplier',
      ownerName: 'Kim Kaiser',
      ownerUserId: null,
      dueOn: '2026-12-11',
      quote: 'die Musterteile Starrflex können wir bis 11.12. liefern',
      span: [30, 86],
      replaces: {
        id: '0190a0a0-0000-7000-8000-0000000d0005',
        title: 'Musterteile Starrflex liefern',
        dueOn: '2026-12-15',
      },
    },
    {
      title: 'Zeichnung Rev. C',
      side: 'buyer',
      ownerName: 'Jan-Luka von Blittersdorff',
      ownerUserId: 'hollmann-jan-luka',
      dueOn: '2026-11-30',
      quote: 'wenn wir Ihre Zeichnung Rev. C bis 30.11. haben',
      span: [88, 135],
      replaces: null,
    },
    {
      title: '8D-Bericht Charge 4711',
      side: 'supplier',
      ownerName: 'Nils Ott',
      ownerUserId: null,
      dueOn: '2026-11-27',
      quote: 'Den 8D-Bericht zur Charge 4711 schickt Herr Ott bis Freitag',
      span: [137, 196],
      replaces: {
        id: '0190a0a0-0000-7000-8000-0000000d0004',
        title: '8D-Bericht Charge 4711',
        dueOn: '2026-11-05',
      },
    },
  ],
  reply: {
    to: 'kim.kaiser@rheintal-elektronik.example',
    subject: 'AW: Musterteile Starrflex und 8D 4711',
    text: 'Guten Tag Kim Kaiser,\n\ndanke für die Rückmeldung. So halten wir es fest:\n- Musterteile Starrflex bis Fr 11.12. (Kim Kaiser)\n- 8D-Bericht Charge 4711 bis Fr 27.11. (Nils Ott)\n- Zeichnung Rev. C bis Mo 30.11. (Jan-Luka von Blittersdorff)\n\nAlle Punkte stehen jetzt in Reziproq; bitte bestätigen Sie sie kurz über den Link, den Sie gleich bekommen.\n\nViele Grüße\nJan-Luka von Blittersdorff',
  },
  canDecide: true,
};

for (const width of [1440, 390]) {
  test(`Zusagen aus Mail ohne seitliches Scrollen (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await signIn(page, { locale: 'de' });
    await page.route(`**/api/postfach/entwuerfe/${draftId}`, (route) =>
      route.fulfill({ json: view }),
    );
    await page.goto(`/mappe/mail/${draftId}`);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Zusagen aus der Mail von Kim Kaiser freigeben',
      }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Das kommt in die Mitte' })).toContainText(
      '8D-Bericht Charge 4711 bis Fr 27.11.',
    );
    await expect(page.getByRole('button', { name: 'Freigeben und senden' })).toBeDisabled();
    await page.waitForLoadState('networkidle');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    if (process.env.UX_SHOTS) {
      await page.screenshot({
        path: `${process.env.UX_SHOTS}/po-01-entwurf-${width}.png`,
        fullPage: true,
      });
    }
  });
}
