// @vitest-environment jsdom
import type { CustomerImpact, ImpactList } from '@reziproq/shared';
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

// Tests zu docs/specs/PNL-07.md in der Oberfläche: je Wirkungsart eine Kachel und keine
// Gesamtsumme, Kennzeichen für Teilung und Savings-Tracking, Anteile ergeben 100 %, beim
// Lieferanten Wirkung erst nach Bestätigung und eigener Nutzen nur für ihn.

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
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
const share = (agreed: boolean) => ({
  id: uuid(30),
  buyerSharePct: 60,
  supplierSharePct: 40,
  ruleText: 'Nach Abzug der Werkzeugkosten',
  proposedByName: 'Sara Ost',
  proposedAt: '2026-11-10T08:00:00Z',
  supplierConfirmedByName: agreed ? 'Kim Kaiser' : null,
  agreedAt: agreed ? '2026-11-11T08:00:00Z' : null,
});
const list: ImpactList = {
  canEdit: true,
  canLead: true,
  totals: [
    { effectType: 'ebit', plan: 0, actual: 34_00 },
    { effectType: 'cost_avoidance', plan: 0, actual: 20_00 },
  ],
  initiatives: [
    {
      id: uuid(10),
      title: 'Preis',
      source: 'jbp',
      maturity: 2,
      impact: null,
      share: share(true),
      savingsReference: null,
    },
    {
      id: uuid(11),
      title: 'Qualität',
      source: 'jbp',
      maturity: 2,
      impact: null,
      share: null,
      savingsReference: { system: 'Coupa', reference: 'SAV-17' },
    },
  ],
};
let customer: CustomerImpact;
const detail = {
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
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  sent = [];
  customer = {
    initiatives: [
      {
        id: uuid(10),
        title: 'Preis',
        share: share(false),
        value: null,
        benefits: [
          {
            id: uuid(40),
            month: '2099-03-01',
            amountCents: 7_77,
            currency: 'EUR',
            note: 'Rüstzeit',
          },
        ],
      },
    ],
    totals: [],
    benefitTotals: [{ currency: 'EUR', amountCents: 7_77 }],
    canConfirm: true,
    canEditBenefit: true,
  };
  api.handle = (request) => {
    if (request.method !== 'GET') sent.push(request);
    if (request.url === `/api/suppliers/${rel}`) return Response.json(detail);
    if (request.url.startsWith(`/api/suppliers/${rel}/wirkung`)) return Response.json(list);
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
    if (request.url.startsWith(`/api/kunden/${rel}/wirkung`)) {
      if (request.url.endsWith('/bestaetigen')) {
        return Response.json({
          ...customer,
          initiatives: [
            {
              ...customer.initiatives[0],
              share: share(true),
              value: { effectType: 'ebit', plan: 0, actual: 34_00 },
            },
          ],
          totals: [{ effectType: 'ebit', plan: 0, actual: 34_00 }],
        });
      }
      return Response.json(customer);
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('PNL-07 in der Oberfläche', () => {
  it('je Wirkungsart eine eigene Kachel, keine Gesamtsumme; Teilung und Savings-Tracking sind markiert', async () => {
    renderAt(`/lieferanten/${rel}/wirkung/initiativen`);
    const tiles = await screen.findByRole('list', { name: 'Wirkung je Wirkungsart' });
    const items = within(tiles).getAllByRole('listitem');
    expect(items.map((item) => item.getAttribute('data-effect'))).toEqual([
      'ebit',
      'cost_avoidance',
    ]);
    expect(tiles.textContent?.replaceAll(' ', ' ')).not.toContain('54,00');
    expect(screen.getAllByText('Teilung 60 : 40 vereinbart').length).toBeGreaterThan(0);
    expect(screen.getAllByText('bereits im Savings-Tracking').length).toBeGreaterThan(0);
  });

  it('die Anteile müssen zusammen 100 % ergeben', async () => {
    const router = renderAt(`/lieferanten/${rel}/wirkung/initiativen/${uuid(10)}/teilung`);
    fireEvent.change(await screen.findByLabelText('Anteil Käufer in %', { exact: false }), {
      target: { value: '70' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Die Anteile müssen zusammen 100 % ergeben.')).toBeDefined();
    expect(sent).toEqual([]);
    fireEvent.change(screen.getByLabelText('Anteil Lieferant in %'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/lieferanten/${rel}/wirkung/initiativen/${uuid(10)}`,
      ),
    );
    expect(sent[0]).toMatchObject({
      method: 'PUT',
      url: `/api/suppliers/${rel}/wirkung/initiativen/${uuid(10)}/teilung`,
      body: { buyerSharePct: 70, supplierSharePct: 30, ruleText: 'Nach Abzug der Werkzeugkosten' },
    });
  });

  it('beim Lieferanten erscheint die Wirkung erst nach der Bestätigung; der eigene Nutzen ist nur für ihn', async () => {
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
    api.permissions = [
      'organisation.sehen',
      'start.sehen',
      'kunden.sehen',
      'teilung.vereinbaren',
      'eigene_sicht.bearbeiten',
    ];
    renderAt(`/kunden/${rel}/wirkung`);
    expect(
      await screen.findByText('Die Wirkung erscheint, sobald die Teilung vereinbart ist.'),
    ).toBeDefined();
    const benefit = screen.getByRole('region', { name: 'Eigener Nutzen: Preis' });
    expect(within(benefit).getByText('Nur für Sie sichtbar')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Teilung bestätigen' }));
    expect(await screen.findByText('Teilung 60 : 40 vereinbart')).toBeDefined();
    expect(screen.getByRole('list', { name: 'Wirkung je Wirkungsart' }).textContent).toContain(
      'EBIT',
    );
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: `/api/kunden/${rel}/wirkung/initiativen/${uuid(10)}/teilung/bestaetigen`,
    });
  });
});
