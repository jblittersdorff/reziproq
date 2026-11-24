// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
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

// Tests zu docs/specs/QBR-04.md in der Oberfläche: Admins beider Seiten stellen unter
// Einstellungen › Erinnerungen ein, wie viele Tage vor der Frist erinnert wird.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  sent = [];
  api.handle = (request) => {
    if (request.url === '/api/massnahmen/einstellungen') {
      if (request.method === 'PUT') {
        sent.push(request);
        return Response.json(request.body);
      }
      return Response.json({ reminderDays: 3 });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('QBR-04 Erinnerungen in der Oberfläche', () => {
  it('der Admin des Lieferanten findet die Einstellung und speichert andere Tage', async () => {
    api.me = {
      ...anna,
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
      'einstellungen.verwalten',
    ];
    const router = renderAt('/einstellungen');
    fireEvent.click(await screen.findByRole('link', { name: /^Erinnerungen/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/einstellungen/erinnerungen'));
    const field = (await screen.findByLabelText('Tage vor der Frist')) as HTMLInputElement;
    expect(field.value).toBe('3');
    fireEvent.change(field, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Gespeichert.')).toBeDefined();
    expect(sent[0]).toMatchObject({
      method: 'PUT',
      url: '/api/massnahmen/einstellungen',
      body: { reminderDays: 5 },
    });
  });

  it('ohne Admin-Recht steht nur der Hinweis da', async () => {
    api.permissions = actionsFor.member;
    renderAt('/einstellungen/erinnerungen');
    expect(await screen.findByText(/nur ein Admin ändern/)).toBeDefined();
    expect(screen.queryByLabelText('Tage vor der Frist')).toBeNull();
  });
});
