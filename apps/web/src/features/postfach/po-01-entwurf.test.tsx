// @vitest-environment jsdom
import type { MailCommitmentsView } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// PO-01 (K2-d.3b): Seite „Zusagen aus Mail“ nach der Vorlage K2-Mail-Zusage, aus Heute geöffnet
// (E-K0-27). Freigeben und senden kommt mit K2-d.4.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const draftId = '0190a0a0-0000-7000-8000-0000000d0001';
const reply =
  'Guten Tag Kim Kaiser,\n\ndanke für die Rückmeldung. So halten wir es fest:\n- Musterteile Starrflex bis Fr 11.12. (Kim Kaiser)\n\nViele Grüße\nJan-Luka von Blittersdorff';
const view = (): MailCommitmentsView => ({
  draftId,
  status: 'draft',
  createdAt: '2026-11-23T08:13:00.000Z',
  relationship: { id: '0190a0a0-0000-7000-8000-0000000d0002', name: 'Rheintal Elektronik' },
  ownOrganization: 'Hollmann Antriebe',
  mail: {
    id: '0190a0a0-0000-7000-8000-0000000d0003',
    subject: 'Musterteile Starrflex und 8D 4711',
    fromName: 'Kim Kaiser',
    fromEmail: 'kim.kaiser@rheintal.example',
    sentAt: '2026-11-23T08:12:00.000Z',
    summary: 'Rheintal liefert die Musterteile bis 11.12., wenn die Zeichnung bis 30.11. da ist.',
    assignedBy: 'reziproq',
  },
  commitments: [
    {
      title: '8D-Bericht Charge 4711',
      side: 'supplier',
      ownerName: 'Nils Ott',
      ownerUserId: null,
      dueOn: '2026-11-27',
      quote: 'Den 8D-Bericht zur Charge 4711 schickt Herr Ott bis Freitag',
      span: [120, 179],
      replaces: {
        id: '0190a0a0-0000-7000-8000-0000000d0004',
        title: '8D-Bericht Charge 4711',
        dueOn: '2026-11-05',
      },
    },
    {
      title: 'Zeichnung Rev. C',
      side: 'buyer',
      ownerName: 'Jan-Luka von Blittersdorff',
      ownerUserId: 'hollmann-jan-luka',
      dueOn: '2026-11-30',
      quote: 'wenn wir Ihre Zeichnung Rev. C bis 30.11. haben',
      span: [80, 119],
      replaces: null,
    },
  ],
  reply: { to: 'kim.kaiser@rheintal.example', subject: 'AW: Musterteile', text: reply },
  canDecide: true,
});

let current: MailCommitmentsView;
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  current = view();
  sent = [];
  api.handle = (request) => {
    if (!request.url.startsWith(`/api/postfach/entwuerfe/${draftId}`)) return undefined;
    sent.push(request);
    if (request.method === 'GET') return Response.json(current);
    if (request.url.endsWith('/antwort')) {
      current = { ...current, reply: { ...current.reply, text: 'Hello Kim Kaiser,\n\nthanks.' } };
    } else if (request.url.endsWith('/verwerfen')) {
      current = { ...current, status: 'discarded', canDecide: false };
    } else {
      current = { ...current, reply: { ...current.reply, text: 'Guten Tag Kim Kaiser,\n\nok.' } };
    }
    return Response.json(current);
  };
});
afterEach(tearDownApp);

const page = `/mappe/mail/${draftId}`;

describe('PO-01 Zusagen aus Mail (K2-d.3b)', () => {
  it('Titel mit der Aufgabe, Mail nur für dich, was in die Mitte kommt, Antwort im Ton', async () => {
    renderAt(page);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Zusagen aus der Mail von Kim Kaiser freigeben',
      }),
    ).toBeTruthy();
    expect(
      screen.getByText('Rheintal Elektronik · Postfach · zugeordnet von Reziproq'),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        name: 'Zwei Zusagen aus der Mail von Kim Kaiser eintragen und antworten',
      }),
    ).toBeTruthy();
    const middle = screen.getByRole('region', { name: 'Das kommt in die Mitte' });
    expect(middle.textContent).toContain('8D-Bericht Charge 4711 bis Fr 27.11.');
    expect(middle.textContent).toContain('Nils Ott · ersetzt die überfällige Zusage vom Do 05.11.');
    expect(middle.textContent).toContain('eure Seite · Jan-Luka von Blittersdorff · neue Zusage');
    expect(screen.getByText(/Rheintal liefert die Musterteile bis 11\.12\./)).toBeTruthy();
    expect(screen.getByText('Antwort im Ton von Hollmann Antriebe')).toBeTruthy();
    expect(screen.getByText(/Guten Tag Kim Kaiser,/)).toBeTruthy();
    const approve = screen.getByRole('button', { name: 'Freigeben und senden' });
    expect(approve.hasAttribute('disabled')).toBe(true);
    // Rechts: So geht es weiter, Was sich in Heute ändert, Leitplanke
    expect(screen.getByText('Nils Ott und Kim Kaiser bekommen einen Link')).toBeTruthy();
    expect(screen.getByText(/„8D-Bericht Charge 4711“ hat wieder eine Frist/)).toBeTruthy();
    expect(
      screen.getByText('Bis Fr 27.11.; verstreicht sie, meldet Reziproq sich erneut.'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Jan-Luka von Blittersdorff bekommt sie nach der Freigabe als Aufgabe in Heute\./,
      ),
    ).toBeTruthy();
  });

  it('Ton ändern, anpassen und verwerfen mit Grund', async () => {
    renderAt(page);
    fireEvent.click(await screen.findByRole('button', { name: 'Auf Englisch' }));
    expect(await screen.findByText(/Hello Kim Kaiser,/)).toBeTruthy();
    expect(sent.some((request) => request.url.endsWith('/antwort'))).toBe(true);
    expect(sent.find((request) => request.url.endsWith('/antwort'))?.body).toEqual({
      variant: 'englisch',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Anpassen' }));
    fireEvent.change(screen.getByLabelText('Frist: Zeichnung Rev. C'), {
      target: { value: '2026-12-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(sent.find((request) => request.method === 'PATCH')?.body).toEqual({
        commitments: [{ index: 1, dueOn: '2026-12-01' }],
      }),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Verwerfen' }));
    const yes = screen.getByRole('button', { name: 'Ja, verwerfen' });
    expect(yes.hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByLabelText('Warum verwerfen?'), {
      target: { value: 'schon telefonisch geklärt' },
    });
    fireEvent.click(yes);
    expect(await screen.findByText('Verworfen: schon telefonisch geklärt')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Anpassen' })).toBeNull();
  });

  it('ein unbekannter Entwurf hat einen eigenen Zustand', async () => {
    api.handle = (request) =>
      request.url.startsWith('/api/postfach/entwuerfe/')
        ? Response.json({ statusCode: 404, code: 'nicht_gefunden' }, { status: 404 })
        : undefined;
    renderAt(page);
    expect(
      await screen.findByText('Diesen Entwurf gibt es nicht oder nicht für dich.'),
    ).toBeTruthy();
    expect(within(document.body).queryByRole('button', { name: 'Erneut versuchen' })).toBeNull();
  });
});
