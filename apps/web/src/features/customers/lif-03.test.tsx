// @vitest-environment jsdom
import type { AccountPlan } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { anna, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/LIF-03.md in der Oberfläche: eigene Sicht mit Kennzeichen „Nur für Sie
// sichtbar“ auf jeder Seite, Abschnitte Zusammenfassung, Sicht auf den Kunden und eigene Ziele,
// Bearbeiten auf eigenen Seiten, Leser nur lesend.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const rel = '0190a0a0-0000-7000-8000-00000000000a';
const objectiveId = '0190a0a0-0000-7000-8000-0000000000b1';
let plan: AccountPlan;
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = {
    ...anna,
    name: 'Kim Kaiser',
    firstName: 'Kim',
    organization: { id: 'org-lieferant', name: 'Rheintal Elektronik (Demo)' },
    orgRole: 'admin',
    permissions: {
      viewOrganizationSettings: true,
      viewBuyerAreas: false,
      viewSuppliers: false,
      viewCustomers: true,
      switchCustomer: false,
    },
  };
  api.permissions = [
    'organisation.sehen',
    'start.sehen',
    'kunden.sehen',
    'eigene_sicht.bearbeiten',
  ];
  sent = [];
  plan = {
    plan: {
      summary: 'A-Kunde, Wachstum 2028.',
      ownView: 'Preisfokussiert, aber fair.',
      importance: 4,
      updatedAt: '2026-11-10T09:00:00Z',
      updatedByName: 'Kim Kaiser',
    },
    objectives: [
      {
        id: objectiveId,
        text: 'Anteil auf 45 %',
        ownerUserId: 'kim',
        ownerName: 'Kim Kaiser',
        targetYear: 2028,
      },
    ],
    people: [
      { userId: 'kim', name: 'Kim Kaiser' },
      { userId: 'lea', name: 'Lea Lang' },
    ],
    canEdit: true,
  };
  api.handle = (request) => {
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
    if (request.url.startsWith(`/api/kunden/${rel}/eigene-sicht`)) {
      if (request.method !== 'GET') sent.push(request);
      return Response.json(plan, { status: request.method === 'POST' ? 201 : 200 });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

const base = `/kunden/${rel}/eigene-sicht`;

describe('LIF-03 Eigene Sicht in der Oberfläche', () => {
  it('zeigt Zusammenfassung, Sicht auf den Kunden und eigene Ziele mit dem Kennzeichen', async () => {
    renderAt(base);
    expect(await screen.findByText('A-Kunde, Wachstum 2028.')).toBeDefined();
    expect(screen.getByText('Nur für Sie sichtbar')).toBeDefined();
    expect(screen.getByText('4 von 5')).toBeDefined();
    const goals = screen
      .getByRole('heading', { name: 'Eigene Ziele' })
      .closest('section') as HTMLElement;
    expect(within(goals).getByText('2028 · Kim Kaiser')).toBeDefined();
    expect(within(goals).getByRole('link', { name: 'Anteil auf 45 %' }).getAttribute('href')).toBe(
      `${base}/ziele/${objectiveId}`,
    );
  });

  it.each([
    ['Übersicht', ''],
    ['Zusammenfassung', '/zusammenfassung'],
    ['Sicht', '/sicht'],
    ['Neues Ziel', '/ziele/neu'],
    ['Ziel bearbeiten', `/ziele/${objectiveId}`],
  ])('die Seite %s trägt das Kennzeichen „Nur für Sie sichtbar“', async (_, path) => {
    renderAt(`${base}${path}`);
    expect(await screen.findByText('Nur für Sie sichtbar')).toBeDefined();
  });

  it('die Zusammenfassung und die Sicht werden auf eigenen Seiten bearbeitet', async () => {
    const router = renderAt(`${base}/sicht`);
    fireEvent.change(await screen.findByLabelText('Sicht auf den Kunden'), {
      target: { value: 'Sehr partnerschaftlich.' },
    });
    fireEvent.change(screen.getByLabelText('Bedeutung des Kunden'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(base));
    expect(sent[0]).toMatchObject({
      method: 'PUT',
      url: `/api/kunden/${rel}/eigene-sicht/sicht`,
      body: { ownView: 'Sehr partnerschaftlich.', importance: 5 },
    });
  });

  it('ein neues Ziel mit verantwortlicher Person und Zieljahr', async () => {
    renderAt(`${base}/ziele/neu`);
    fireEvent.click(await screen.findByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Bitte ausfüllen.')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Ziel'), {
      target: { value: 'Zweites Werk beliefern' },
    });
    fireEvent.change(screen.getByLabelText('Verantwortlich (optional)'), {
      target: { value: 'lea' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: `/api/kunden/${rel}/eigene-sicht/ziele`,
      body: { text: 'Zweites Werk beliefern', ownerUserId: 'lea' },
    });
  });

  it('Leser sehen die eigene Sicht ohne Bearbeiten', async () => {
    plan = { ...plan, canEdit: false, people: [] };
    renderAt(base);
    expect(
      await screen.findByText('Bearbeiten können Admins und Nutzer eurer Organisation.'),
    ).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Bearbeiten' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Ziel hinzufügen/ })).toBeNull();
  });
});
