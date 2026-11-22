// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/PNL-11.md in der Oberfläche: „Excel herunterladen“ holt die Datei für die
// aktuelle Auswahl und speichert sie unter dem Namen vom Server.

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const portfolio = {
  view: 'geschaeftsjahr',
  fiscalYear: 2026,
  fiscalYearStartMonth: 4,
  fiscalYears: [2026],
  focusSuppliers: 1,
  pipeline: [],
  businessUnits: { years: [2025, 2026, 2027], rows: [] },
  top: [],
};
let requests: string[];
let saved: string[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = [...actionsFor.admin, 'wirkung.sehen'];
  requests = [];
  saved = [];
  Object.assign(URL, { createObjectURL: () => 'blob:wirkung', revokeObjectURL: () => undefined });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved.push(this.download);
  });
  api.handle = (request) => {
    requests.push(request.url);
    if (request.url.startsWith('/api/wirkung/portfolio')) return Response.json(portfolio);
    if (request.url.startsWith('/api/wirkung/freigaben')) return Response.json({ validations: [] });
    if (request.url.startsWith('/api/wirkung/export')) {
      return new Response('xlsx', {
        headers: {
          'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'content-disposition': `attachment; filename="x.xlsx"; filename*=UTF-8''${encodeURIComponent('Wirkung_Test-OEM_GJ_2026_2026-11-15.xlsx')}`,
        },
      });
    }
    return undefined;
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  tearDownApp();
});

describe('PNL-11 in der Oberfläche', () => {
  it('„Excel herunterladen“ holt die Datei für Sicht und Geschäftsjahr und nimmt den Namen vom Server', async () => {
    renderAt('/uebersicht/ergebnisse?sicht=geschaeftsjahr&gj=2026');
    fireEvent.click(await screen.findByRole('button', { name: 'Excel herunterladen' }));
    await waitFor(() => expect(saved).toEqual(['Wirkung_Test-OEM_GJ_2026_2026-11-15.xlsx']));
    expect(requests).toContain('/api/wirkung/export?sicht=geschaeftsjahr&gj=2026');
  });
});
