// @vitest-environment jsdom
import type { Touchpoint, TouchpointList } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  actionsFor,
  anna,
  api,
  renderAt,
  setUpApp,
  signedIn,
  tearDownApp,
} from '@/testing/app-harness';

// Tests zu docs/specs/PLB-06.md in der Oberfläche: Bild und Liste zeigen dieselben Kontaktpunkte
// (auch 20), Lücken oben, „geprüft“, Teilen mit Bestätigung, eine geteilte Zeile ohne Kontakt,
// beim Lieferanten nur lesend.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const uuid = (n: number) => `0190a0a0-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`;
const rel = uuid(1);
const contact = uuid(2);
const levels = ['executive', 'management', 'operational'] as const;
const touchpoint = (n: number, overrides: Partial<Touchpoint> = {}): Touchpoint => ({
  id: uuid(10 + n),
  visibility: 'internal',
  buyerUserId: null,
  buyerName: `Käufer ${n}`,
  buyerLevel: levels[n % 3] as Touchpoint['buyerLevel'],
  supplierContactId: null,
  supplierName: `Lieferant ${n}`,
  supplierLevel: levels[(n + 1) % 3] as Touchpoint['supplierLevel'],
  format: `Format ${n}`,
  cadence: 'quarterly',
  notes: null,
  ...overrides,
});
const supplierDetail = {
  relationshipId: rel,
  name: 'Rheintal Elektronik GmbH (Demo)',
  organizationName: 'Rheintal Elektronik GmbH (Demo)',
  country: 'DE',
  vatId: null,
  duns: null,
  externalRef: null,
  notes: null,
  status: 'active',
  createdAt: '2026-10-01T08:00:00Z',
  endedAt: null,
  spend: [],
  permissions: { edit: true, editTeam: true },
};
let list: TouchpointList;
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  sent = [];
  list = {
    touchpoints: [touchpoint(1, { format: 'Strategiedialog' }), touchpoint(2)],
    gaps: [
      { title: { de: 'Operative Abstimmung', en: 'Operational alignment' }, level: 'operational' },
    ],
    formats: [
      {
        title: { de: 'Strategiedialog', en: 'Strategy dialogue' },
        level: 'executive',
        cadence: 'semiannual',
      },
    ],
    people: [{ userId: 'anna', name: 'Anna Schmidt' }],
    contacts: [{ id: contact, name: 'Petra Wolf' }],
    canEdit: true,
    review: null,
    canReview: true,
  };
  api.handle = (request) => {
    if (request.method !== 'GET') sent.push(request);
    if (request.url === `/api/suppliers/${rel}`) return Response.json(supplierDetail);
    if (request.url === `/api/suppliers/${rel}/kontaktpunkte/geprueft`) {
      return Response.json({
        ...list,
        canReview: false,
        review: { reviewedAt: '2026-11-14T10:00:00Z', reviewedByName: 'Anna Schmidt' },
      });
    }
    if (
      request.url.startsWith(`/api/suppliers/${rel}/kontaktpunkte/`) &&
      request.url.endsWith('/teilen')
    ) {
      return Response.json({ ...touchpoint(1), visibility: 'shared' });
    }
    if (request.url === `/api/suppliers/${rel}/kontaktpunkte`) {
      if (request.method === 'POST') return Response.json(touchpoint(9), { status: 201 });
      return Response.json(list);
    }
    if (request.url === '/api/kunden') {
      return Response.json({
        customers: [{ relationshipId: rel, name: 'OEM 1', nextMeeting: null }],
      });
    }
    if (request.url === `/api/kunden/${rel}`) {
      return Response.json({
        relationshipId: rel,
        name: 'OEM 1',
        relationshipType: null,
        nextMeeting: null,
      });
    }
    if (request.url === `/api/kunden/${rel}/kontaktpunkte`) {
      return Response.json({
        ...list,
        touchpoints: [touchpoint(1, { visibility: 'shared' })],
        gaps: [],
        formats: [],
        people: [],
        contacts: [],
        canEdit: false,
        canReview: false,
      });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

const base = `/lieferanten/${rel}/beziehung/kontaktpunkte`;

describe('PLB-06 Kontaktpunkte in der Oberfläche', () => {
  it('Bild und Liste zeigen dieselben Kontaktpunkte, auch 20; Lücken stehen oben', async () => {
    list = { ...list, touchpoints: Array.from({ length: 20 }, (_, n) => touchpoint(n + 1)) };
    renderAt(base);
    const picture = await screen.findByRole('list', { name: 'Bild der Kontaktpunkte' });
    const rows = screen.getByRole('list', { name: 'Liste der Kontaktpunkte' });
    const lines = within(picture).getAllByRole('listitem');
    expect(lines).toHaveLength(20);
    expect(within(rows).getAllByRole('listitem')).toHaveLength(20);
    // Jede Linie trägt Personen, Ebenen, Format und Takt; nach Ebene der Käuferseite sortiert.
    expect(lines[0]?.getAttribute('aria-label')).toBe(
      'Käufer 3 (Geschäftsleitung) mit Lieferant 3 (Management): Format 3, quartalsweise',
    );
    const named = new Set(lines.map((line) => line.getAttribute('aria-label')?.split(' mit ')[0]));
    expect(named.size).toBe(20);
    expect(screen.getByText('Operative Abstimmung fehlt')).toBeDefined();
  });

  it('„Kontaktpunkte geprüft“ markiert den Zyklus und zeigt, wer geprüft hat', async () => {
    renderAt(base);
    fireEvent.click(await screen.findByRole('button', { name: 'Kontaktpunkte geprüft' }));
    expect(await screen.findByText(/Geprüft von Anna Schmidt/)).toBeDefined();
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: `/api/suppliers/${rel}/kontaktpunkte/geprueft`,
    });
  });

  it('Teilen fragt erst auf der Seite nach', async () => {
    renderAt(base);
    fireEvent.click(await screen.findByRole('button', { name: 'Teilen: Lieferant 1' }));
    expect(sent).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Ja, teilen' }));
    await waitFor(() =>
      expect(sent[0]).toMatchObject({
        method: 'POST',
        url: `/api/suppliers/${rel}/kontaktpunkte/${uuid(11)}/teilen`,
      }),
    );
  });

  it('eine geteilte Zeile kann nicht auf einen Kontakt verweisen; intern geht es', async () => {
    const router = renderAt(`${base}/neu`);
    fireEvent.change(await screen.findByLabelText('Person bei uns'), { target: { value: 'anna' } });
    fireEvent.change(screen.getByLabelText('Person beim Lieferanten'), {
      target: { value: contact },
    });
    fireEvent.change(screen.getByLabelText('Format', { exact: false }), {
      target: { value: 'Strategiedialog' },
    });
    // Das Format aus den Spielregeln übernimmt Ebene und Takt.
    expect((screen.getByLabelText('Takt') as HTMLSelectElement).value).toBe('semiannual');
    fireEvent.change(screen.getByLabelText('Sichtbarkeit', { exact: false }), {
      target: { value: 'shared' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText(/kann nicht auf einen Kontakt verweisen/)).toBeDefined();
    expect(sent).toEqual([]);
    fireEvent.change(screen.getByLabelText('Sichtbarkeit', { exact: false }), {
      target: { value: 'internal' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(base));
    expect(sent[0]?.body).toEqual({
      visibility: 'internal',
      buyerUserId: 'anna',
      buyerName: null,
      buyerLevel: 'executive',
      supplierContactId: contact,
      supplierName: null,
      supplierLevel: 'executive',
      format: 'Strategiedialog',
      cadence: 'semiannual',
      notes: null,
    });
  });

  it('der Lieferant sieht geteilte Kontaktpunkte gespiegelt, ohne Bearbeiten', async () => {
    api.me = {
      ...anna,
      organization: { id: 'org-lieferant', name: 'Rheintal Elektronik (Demo)' },
      permissions: {
        viewOrganizationSettings: true,
        viewBuyerAreas: false,
        viewSuppliers: false,
        viewCustomers: true,
        switchCustomer: false,
      },
    };
    api.permissions = ['organisation.sehen', 'start.sehen', 'kunden.sehen', 'kontaktpunkte.sehen'];
    renderAt(`/kunden/${rel}/beziehung/kontaktpunkte`);
    expect(await screen.findByText('Kontaktpunkte, die euer Kunde mit euch teilt.')).toBeDefined();
    expect(
      within(await screen.findByRole('list', { name: 'Liste der Kontaktpunkte' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Teilen/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Kontaktpunkt anlegen/ })).toBeNull();
  });
});
