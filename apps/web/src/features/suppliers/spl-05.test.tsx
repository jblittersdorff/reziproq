// @vitest-environment jsdom
import type { SupplierProfile } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/SPL-05.md in der Oberfläche: Abschnitte mit Quelle je Kennzahl, Unser Anteil
// als große Zahl und Hinweis bei anderer Währung, Kennzahl nur mit Quelle, Quoten in Basispunkten,
// Import mit markierten Zeilen, Geschäftsleitung als Liste.

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
let profile: SupplierProfile;
let sent: { method: string; url: string; body: unknown }[];
let importAnswer: unknown;

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  sent = [];
  profile = {
    company: {
      headquarters: 'Freiburg',
      foundedYear: 1987,
      employees: 1200,
      businessSegments: null,
    },
    implications: 'Wir sind ein wichtiger Kunde.',
    updatedByName: 'Anna Schmidt',
    updatedAt: '2026-11-01T08:00:00Z',
    executives: [{ id: uuid(5), name: 'Petra Wolf', role: 'CEO', since: 2019 }],
    financials: [2024, 2025].map((year, index) => ({
      id: uuid(10 + index),
      year,
      metric: 'revenue',
      value: (year === 2025 ? 20_000_000 : 18_000_000) * 100,
      unit: 'cents',
      currency: 'EUR',
      source: `Bundesanzeiger ${year}`,
    })),
    share: { status: 'ok', year: 2025, basisPoints: 500 },
    canEdit: true,
  };
  importAnswer = { imported: 12, rows: [] };
  api.handle = (request) => {
    if (request.method !== 'GET') sent.push(request);
    if (request.url === `/api/suppliers/${rel}`) return Response.json(detail);
    if (request.url === `/api/suppliers/${rel}/profil/kennzahlen/import`)
      return Response.json(importAnswer);
    if (request.url.startsWith(`/api/suppliers/${rel}/profil`)) {
      return Response.json(profile, { status: request.method === 'POST' ? 201 : 200 });
    }
    if (request.url.startsWith('/api/audit')) return Response.json({ entries: [] });
    return undefined;
  };
});

afterEach(tearDownApp);

const base = `/lieferanten/${rel}/strategie/profil`;

describe('SPL-05 Profil und Finanzen in der Oberfläche', () => {
  it('zeigt Unternehmen, Geschäftsleitung, Kennzahlen mit Quelle, unseren Anteil und die Einschätzung', async () => {
    renderAt(base);
    const share = await screen.findByRole('region', { name: 'Unser Anteil' });
    expect(share.textContent).toContain('5 %');
    expect(share.textContent).toContain('Unser Spend 2025 am Umsatz des Lieferanten');
    const revenue = screen.getByRole('list', { name: 'Umsatz' });
    expect(
      within(revenue).getAllByRole('listitem')[1]?.textContent?.replaceAll(' ', ' '),
    ).toContain('Quelle: Bundesanzeiger 2025');
    expect(screen.getByRole('list', { name: 'Geschäftsleitung' }).textContent).toContain(
      'Petra Wolf',
    );
    expect(screen.getByText('Wir sind ein wichtiger Kunde.')).toBeDefined();
  });

  it('bei unterschiedlichen Währungen steht ein Hinweis statt des Anteils', async () => {
    profile = { ...profile, share: { status: 'currency_mismatch', year: 2025 } };
    renderAt(base);
    const share = await screen.findByRole('region', { name: 'Unser Anteil' });
    expect(share.textContent).toContain('unterschiedliche Währungen');
    expect(share.textContent).not.toContain('%');
  });

  it('eine Kennzahl ohne Quelle wird nicht gespeichert; Quoten gehen als Basispunkte ohne Währung', async () => {
    const router = renderAt(`${base}/kennzahlen/neu`);
    fireEvent.change(await screen.findByLabelText('Kennzahl'), {
      target: { value: 'ebit_margin' },
    });
    expect(screen.queryByLabelText('Währung')).toBeNull();
    fireEvent.change(screen.getByLabelText('Jahr'), { target: { value: '2025' } });
    fireEvent.change(screen.getByLabelText('Wert', { exact: false }), { target: { value: '8,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Bitte eine Quelle angeben.')).toBeDefined();
    expect(sent).toEqual([]);
    fireEvent.change(screen.getByLabelText('Quelle', { exact: false }), {
      target: { value: 'Geschäftsbericht' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(base));
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: `/api/suppliers/${rel}/profil/kennzahlen`,
      body: {
        year: 2025,
        metric: 'ebit_margin',
        value: 850,
        currency: null,
        source: 'Geschäftsbericht',
      },
    });
  });

  it('der Import markiert fehlerhafte Zeilen und übernimmt dann nichts', async () => {
    importAnswer = { imported: 0, rows: [{ row: 3, issues: ['invalid_year', 'source_required'] }] };
    renderAt(`${base}/kennzahlen/import`);
    const input = (await screen.findByLabelText('Datei')) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['Jahr;Kennzahl'], 'kennzahlen.csv', { type: 'text/csv' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Importieren' }));
    const marked = await screen.findByRole('list', { name: /Nichts übernommen/ });
    expect(marked.textContent).toBe('Zeile 3: Jahr fehlt oder ist ungültig, Quelle fehlt');
  });

  it('die Geschäftsleitung wird als Liste mit Name, Rolle und Jahr gespeichert', async () => {
    const router = renderAt(`${base}/geschaeftsleitung`);
    fireEvent.click(await screen.findByRole('button', { name: 'Person hinzufügen' }));
    fireEvent.change(screen.getByLabelText('Name 2'), { target: { value: 'Jan Weber' } });
    fireEvent.change(screen.getByLabelText('Rolle 2'), { target: { value: 'CFO' } });
    fireEvent.change(screen.getByLabelText('Seit 2'), { target: { value: '2022' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(base));
    expect(sent[0]?.body).toEqual({
      executives: [
        { name: 'Petra Wolf', role: 'CEO', since: 2019 },
        { name: 'Jan Weber', role: 'CFO', since: 2022 },
      ],
    });
  });
});
