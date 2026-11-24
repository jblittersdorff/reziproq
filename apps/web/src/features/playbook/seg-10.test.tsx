// @vitest-environment jsdom
import type {
  CustomerRuleSet,
  RuleSet,
  RuleSetResponse,
  RuleSetSharePreview,
  SupplierDetail,
} from '@reziproq/shared';
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

// Oberflächentests zu docs/specs/SEG-10.md: teilen beim Käufer, lesen beim Lieferanten.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const rel = '0190a0a0-0000-7000-8000-000000000001';
const uuid = (n: number) => `0190a0a0-0000-7000-8000-${String(n).padStart(12, '0')}`;
const text = (de: string) => ({ de, en: de });
const item = {
  kind: 'right' as const,
  group: 'cost' as const,
  title: text('Kostenworkshops'),
  description: text('Gemeinsam sparen'),
  cadence: null,
};
const detail: SupplierDetail = {
  relationshipId: rel,
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
};
const set = (version: number, status: RuleSet['status']): RuleSet => ({
  id: uuid(50 + version),
  version,
  status,
  visibility: status === 'shared' ? 'shared' : 'internal',
  target: { impactLevel: 3, qualityLevel: 3, typeName: 'Strategischer Partner' },
  items: [
    { ...item, id: uuid(60), catalogItemId: uuid(1), origin: 'catalog', level: null, reason: null },
  ],
  removed: [],
  approvedBy: 'Sara Ost',
  approvedAt: '2026-11-01T10:00:00Z',
});

let response: RuleSetResponse;
let sent: { method: string; url: string }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  sent = [];
  response = {
    current: set(1, 'approved'),
    target: set(1, 'approved').target,
    targetChanged: false,
    canManage: true,
    shared: null,
  };
  api.handle = (request) => {
    if (request.url === `/api/suppliers/${rel}`) return Response.json(detail);
    if (request.url.startsWith(`/api/suppliers/${rel}/overview`)) {
      return Response.json({ head: { segment: null, sro: null, nextMeeting: null }, metrics: [] });
    }
    if (request.url === `/api/suppliers/${rel}/spielregeln/teilen`) {
      if (request.method === 'POST') {
        sent.push(request);
        return Response.json(response);
      }
      const preview: RuleSetSharePreview = {
        version: 1,
        typeName: 'Strategischer Partner',
        typeDescription: 'Hohe Bedeutung, starke Zusammenarbeit.',
        items: [item],
      };
      return Response.json(preview);
    }
    if (request.url === `/api/suppliers/${rel}/spielregeln`) return Response.json(response);
    return undefined;
  };
});

afterEach(tearDownApp);

describe('SEG-10 beim Käufer', () => {
  it('eine intern freigegebene Version lässt sich mit dem Lieferanten teilen', async () => {
    renderAt(`/lieferanten/${rel}/beziehung/spielregeln`);
    fireEvent.click(await screen.findByRole('link', { name: 'Mit Lieferant teilen' }));
    expect(await screen.findByText('Strategischer Partner')).toBeDefined();
    expect(screen.getByText('Hohe Bedeutung, starke Zusammenarbeit.')).toBeDefined();
    expect(screen.getByText('Kostenworkshops')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Mit Lieferant teilen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ja, teilen' }));
    await waitFor(() => expect(sent).toHaveLength(1));
  });

  it('ein Entwurf wird nicht geteilt; eine neue Version nennt, welche der Lieferant sieht', async () => {
    response = {
      ...response,
      current: set(2, 'draft'),
      shared: {
        version: 1,
        typeName: 'Strategischer Partner',
        typeDescription: '',
        sharedAt: '2026-11-02T10:00:00Z',
      },
    };
    renderAt(`/lieferanten/${rel}/beziehung/spielregeln`);
    expect(await screen.findByText(/Der Lieferant sieht Version 1, geteilt am/)).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Mit Lieferant teilen' })).toBeNull();
  });
});

describe('SEG-10 beim Lieferanten', () => {
  const idA = rel;
  let rules: CustomerRuleSet;

  beforeEach(() => {
    api.me = {
      ...anna,
      organization: { id: 'org-lieferant', name: 'Test-Lieferant (Demo)' },
      orgRole: 'admin',
      permissions: {
        viewOrganizationSettings: true,
        viewBuyerAreas: false,
        viewSuppliers: false,
        viewCustomers: true,
        switchCustomer: false,
      },
    };
    api.permissions = ['organisation.sehen', 'start.sehen', 'kunden.sehen'];
    rules = {
      target: {
        version: 1,
        typeName: 'Strategischer Partner',
        typeDescription: 'Hohe Bedeutung, starke Zusammenarbeit.',
        sharedAt: '2026-11-02T10:00:00Z',
      },
      items: [item],
    };
    api.handle = (request) => {
      if (request.url === `/api/kunden/${idA}`) {
        return Response.json({
          relationshipId: idA,
          name: 'Test-OEM (Demo)',
          relationshipType: 'Strategischer Partner',
          nextMeeting: null,
        });
      }
      if (request.url === `/api/kunden/${idA}/spielregeln`) return Response.json(rules);
      return undefined;
    };
  });

  it('der Überblick zeigt den geteilten Beziehungstyp im Kopf', async () => {
    renderAt(`/kunden/${idA}`);
    expect(await screen.findByText('Strategischer Partner')).toBeDefined();
  });

  it('Beziehung › Spielregeln zeigt Typ, Beschreibung, Spielregeln und „Geteilt am …“', async () => {
    const router = renderAt(`/kunden/${idA}/beziehung`);
    fireEvent.click(await screen.findByRole('link', { name: /Spielregeln/ }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/kunden/${idA}/beziehung/spielregeln`),
    );
    expect(await screen.findByText('Hohe Bedeutung, starke Zusammenarbeit.')).toBeDefined();
    expect(screen.getByText('Kostenworkshops')).toBeDefined();
    expect(screen.getByText(/Geteilt am/)).toBeDefined();
  });

  it('vor dem Teilen erklärt die Seite, dass noch nichts geteilt ist', async () => {
    rules = { target: null, items: [] };
    renderAt(`/kunden/${idA}/beziehung/spielregeln`);
    expect(await screen.findByText('Noch keine Spielregeln geteilt')).toBeDefined();
  });
});
