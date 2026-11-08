// @vitest-environment jsdom
import type { InvitationList, PublicInvitation, SupplierDetail } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Oberflächentests zu docs/specs/LIF-01.md, Teil a: einladen auf der Team-Seite und annehmen
// ohne Login in drei Schritten.

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const id = '0190a0a0-0000-7000-8000-000000000001';
const token = 'abcDEF_123-abcDEF_123-abcDEF_123-abcDEF_12';
const detail: SupplierDetail = {
  relationshipId: id,
  name: 'Rheintal Elektronik GmbH (Demo)',
  organizationName: 'Rheintal Elektronik GmbH (Demo)',
  country: 'DE',
  vatId: null,
  duns: null,
  externalRef: 'L-10001',
  notes: null,
  status: 'draft',
  createdAt: '2026-10-01T08:00:00Z',
  endedAt: null,
  spend: [],
  permissions: { edit: true, editTeam: true },
};
const invitation = (
  n: number,
  status: InvitationList['invitations'][number]['status'],
): InvitationList['invitations'][number] => ({
  id: `0190a0a0-0000-7000-8000-00000000010${n}`,
  email: `person${n}@rheintal.example`,
  status,
  invitedBy: 'Lena Berger',
  createdAt: '2026-11-01T08:00:00Z',
  expiresAt: '2026-11-08T08:00:00Z',
  acceptedAt: status === 'accepted' ? '2026-11-02T08:00:00Z' : null,
});
const openInvitation: PublicInvitation = {
  status: 'open',
  customer: 'Test-OEM (Demo)',
  sro: 'Lena Berger',
  supplier: 'Rheintal Elektronik GmbH (Demo)',
  kamTaken: false,
};

let requests: { method: string; url: string; body: unknown }[] = [];
let list: InvitationList;
let preview: PublicInvitation | null;
let acceptStatus: number;

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  requests = [];
  list = {
    invitations: [invitation(1, 'accepted'), invitation(2, 'open')],
    canInvite: true,
    suggestions: [{ name: 'Kim Kaiser', email: 'kim@rheintal.example' }],
  };
  preview = openInvitation;
  acceptStatus = 200;
  api.handle = (request) => {
    requests.push(request);
    if (request.url === `/api/suppliers/${id}`) return Response.json(detail);
    if (request.url === `/api/suppliers/${id}/team`) {
      return Response.json({ members: [], candidates: [] });
    }
    if (request.url === `/api/suppliers/${id}/einladungen`) {
      if (request.method === 'POST') {
        const email = (request.body as { email: string }).email;
        if (email === 'doppelt@rheintal.example') {
          return Response.json({ code: 'already_invited' }, { status: 409 });
        }
        list = { ...list, invitations: [{ ...invitation(3, 'open'), email }, ...list.invitations] };
        return Response.json(list, { status: 201 });
      }
      return Response.json(list);
    }
    if (request.url.endsWith('/zurueckziehen')) {
      list = {
        ...list,
        invitations: list.invitations.map((entry) =>
          request.url.includes(entry.id) ? { ...entry, status: 'revoked' as const } : entry,
        ),
      };
      return Response.json(list);
    }
    if (request.url.startsWith('/api/audit')) return Response.json({ entries: [] });
    if (request.url === `/api/einladungen/${token}`) {
      return preview ? Response.json(preview) : Response.json({}, { status: 404 });
    }
    if (request.url === `/api/einladungen/${token}/annahme`) {
      return acceptStatus === 200
        ? Response.json({ next: '/start' })
        : Response.json({ code: 'x' }, { status: acceptStatus });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

const teamPath = `/lieferanten/${id}/beziehung/team`;

describe('LIF-01a einladen', () => {
  it('die Team-Seite zeigt Personen des Lieferanten mit Stand; eine angenommene Einladung ist aktiv', async () => {
    renderAt(teamPath);
    const table = await screen.findByRole('table', { name: 'Personen des Lieferanten' });
    const rows = within(table).getAllByRole('row');
    expect(rows[1]?.textContent).toContain('Aktiv');
    expect(rows[2]?.textContent).toContain('Offen');
    expect(screen.getByRole('link', { name: 'Lieferant einladen' })).toBeDefined();
  });

  it('ohne Recht gibt es weder Einladen noch Zurückziehen', async () => {
    list = { ...list, canInvite: false, suggestions: [] };
    renderAt(teamPath);
    await screen.findByRole('table', { name: 'Personen des Lieferanten' });
    expect(screen.queryByRole('link', { name: 'Lieferant einladen' })).toBeNull();
    expect(screen.queryByRole('button', { name: /zurückziehen/ })).toBeNull();
  });

  it('eine offene Einladung lässt sich zurückziehen', async () => {
    renderAt(teamPath);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Einladung an person2@rheintal.example zurückziehen',
      }),
    );
    expect(await screen.findByText('Die Einladung ist zurückgezogen.')).toBeDefined();
    expect(requests.some((request) => request.url.endsWith('/zurueckziehen'))).toBe(true);
  });

  it('das Formular schlägt Kontakte vor und schickt E-Mail und Nachricht', async () => {
    const router = renderAt(`${teamPath}/einladen`);
    const email = await screen.findByLabelText('E-Mail');
    expect(document.querySelector('datalist option')?.getAttribute('value')).toBe(
      'kim@rheintal.example',
    );
    fireEvent.change(email, { target: { value: 'kim@rheintal.example' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Persönliche Nachricht' }), {
      target: { value: 'Hallo Kim' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Einladen' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(teamPath));
    expect(
      await screen.findByText('Die Einladung an kim@rheintal.example ist unterwegs.'),
    ).toBeDefined();
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      email: 'kim@rheintal.example',
      message: 'Hallo Kim',
    });
  });

  it('eine ungültige oder schon eingeladene Adresse zeigt einen Fehler am Feld', async () => {
    renderAt(`${teamPath}/einladen`);
    const email = await screen.findByLabelText('E-Mail');
    fireEvent.change(email, { target: { value: 'keine-adresse' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einladen' }));
    expect(await screen.findByText('Keine gültige E-Mail-Adresse.')).toBeDefined();
    fireEvent.change(email, { target: { value: 'doppelt@rheintal.example' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einladen' }));
    expect(await screen.findByText('Diese Person ist schon eingeladen.')).toBeDefined();
  });
});

describe('LIF-01a annehmen ohne Login', () => {
  beforeEach(() => {
    auth.state = { ...signedIn, isAuthenticated: false, user: null };
  });

  it('in drei Schritten: Begrüßung mit Kunde und SRO, nur Name und Rolle, dann Passkey', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const router = renderAt(`/einladung/${token}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Test-OEM (Demo) lädt dich ein' }),
    ).toBeDefined();
    expect(
      screen.getByText(
        'Lena Berger von Test-OEM (Demo) möchte mit euch in Reziproq zusammenarbeiten.',
      ),
    ).toBeDefined();
    expect(screen.getByText('Schritt 1 von 3')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/einladung/${token}/name`));

    // Nur Name und Rolle; ohne Angaben geht es nicht weiter.
    const form = (await screen.findByRole('textbox', { name: 'Dein Name' })).closest('form');
    expect(form?.querySelectorAll('input[type="text"], input:not([type]), textarea')).toHaveLength(
      1,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(await screen.findByText('Bitte gib deinen Namen ein.')).toBeDefined();
    fireEvent.change(screen.getByRole('textbox', { name: 'Dein Name' }), {
      target: { value: 'Kim Kaiser' },
    });
    fireEvent.click(screen.getByRole('radio', { name: /Key Account Manager/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/einladung/${token}/passkey`));

    fireEvent.click(await screen.findByRole('button', { name: 'Passkey einrichten' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/start'));
    expect(requests.find((request) => request.url.endsWith('/annahme'))?.body).toEqual({
      name: 'Kim Kaiser',
      teamRole: 'sro',
      locale: 'de',
    });
  });

  it('gibt es schon einen Key Account Manager, steht die Rolle nicht zur Wahl', async () => {
    preview = { ...openInvitation, kamTaken: true };
    renderAt(`/einladung/${token}/name`);
    await screen.findByRole('textbox', { name: 'Dein Name' });
    expect(screen.queryByRole('radio', { name: /Key Account Manager/ })).toBeNull();
    expect(
      screen.getByText('Einen Key Account Manager gibt es für diese Beziehung schon.'),
    ).toBeDefined();
  });

  it('nach einem Neuladen im Passkey-Schritt geht es zurück zu Name und Rolle', async () => {
    const router = renderAt(`/einladung/${token}/passkey`);
    await waitFor(() => expect(router.state.location.pathname).toBe(`/einladung/${token}/name`));
  });

  it.each([
    ['expired', 'Der Link ist abgelaufen'],
    ['used', 'Diese Einladung ist schon angenommen'],
    ['revoked', 'Diese Einladung gilt nicht mehr'],
  ] as const)('ein Link mit Stand %s zeigt einen klaren Hinweis', async (status, title) => {
    preview = { ...openInvitation, status };
    renderAt(`/einladung/${token}`);
    expect(await screen.findByText(title)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Weiter' })).toBeNull();
  });

  it('ein unbekannter Link zeigt einen Hinweis statt eines Fehlers', async () => {
    preview = null;
    renderAt(`/einladung/${token}`);
    expect(await screen.findByText('Diesen Link kennen wir nicht')).toBeDefined();
  });

  it('scheitert die Annahme, bleibt die Person auf der Seite und sieht den Grund', async () => {
    acceptStatus = 503;
    renderAt(`/einladung/${token}/name`);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Dein Name' }), {
      target: { value: 'Kim Kaiser' },
    });
    fireEvent.click(screen.getByRole('radio', { name: /Mitglied im Team/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Passkey einrichten' }));
    expect(
      await screen.findByText(
        'Die Annahme ist hier noch nicht eingerichtet. Bitte versuche es später.',
      ),
    ).toBeDefined();
  });
});
