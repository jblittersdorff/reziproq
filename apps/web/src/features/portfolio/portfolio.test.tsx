// @vitest-environment jsdom
import type { PortfolioMatrix, PortfolioOpen } from '@reziproq/shared';
import { screen, waitFor } from '@testing-library/react';
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
import { spread } from './matrix-page';

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const id = (n: number) => `0190a0a0-0000-7000-8000-${String(n).padStart(12, '0')}`;
const levels = (impactLevel: number, qualityLevel: number) => ({
  impactLevel,
  qualityLevel,
  typeName: `Typ ${impactLevel}${qualityLevel}`,
});
const point = (n: number) => ({
  relationshipId: id(n),
  name: `Lieferant ${n}`,
  spendCents: 100_000 * n,
  currency: 'EUR',
  businessUnit: null,
  materialGroup: null,
  ist: levels(2, 2),
  soll: levels(3, 3),
});
let matrix: PortfolioMatrix;
let open: PortfolioOpen;
let matrixUrls: string[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = actionsFor.member;
  matrixUrls = [];
  matrix = {
    spendYear: 2025,
    businessUnits: [{ id: id(900), name: 'Antrieb' }],
    materialGroups: [{ id: id(901), name: 'Stahl' }],
    points: Array.from({ length: 50 }, (_, n) => point(n + 1)),
  };
  open = {
    deviationThreshold: 30,
    groups: {
      ratings_open: [
        { relationshipId: id(1), name: 'Alpha GmbH', submitted: 1, total: 3, deviation: null },
      ],
      not_consolidated: [
        { relationshipId: id(2), name: 'Beta AG', submitted: 3, total: 3, deviation: 5 },
      ],
      deviation: [
        { relationshipId: id(3), name: 'Gamma KG', submitted: 3, total: 3, deviation: 42 },
      ],
    },
  };
  api.handle = ({ url }) => {
    if (url === '/api/portfolio')
      return Response.json({ matrixCount: 50, openCount: 3, openRounds: 1, focusCount: 2 });
    if (url.startsWith('/api/portfolio/matrix')) {
      matrixUrls.push(url);
      return Response.json(matrix);
    }
    if (url === '/api/portfolio/open') return Response.json(open);
    return undefined;
  };
});

afterEach(tearDownApp);

describe('SEG-07 Portfolio', () => {
  it('die Seiten des Portfolios stehen mit Kennzahl in der Linse Segmente (K2-b.5, ZYK-04)', async () => {
    // BZ-01: /portfolio ist die Linse Segmente; die fünf Kacheln sind dort Zeilen unter
    // „Portfolio im Detail“ und „Bewertungsrunden“, bis K2-e sie ersetzt.
    renderAt('/portfolio');
    const open = await screen.findByRole('link', { name: /Offene Entscheidungen/ });
    expect(open.getAttribute('href')).toBe('/portfolio/offen');
    await waitFor(() => expect(open.textContent).toContain('3 Lieferanten warten'));
    expect(screen.getByRole('link', { name: /Fokuslieferanten/ }).textContent).toContain(
      '2 im Fokus',
    );
    expect(screen.getByRole('link', { name: /Matrix mit Filtern/ }).getAttribute('href')).toBe(
      '/portfolio/matrix',
    );
    expect(screen.getByRole('link', { name: /Stand der Zyklen/ }).getAttribute('href')).toBe(
      '/portfolio/zyklen',
    );
    expect(screen.getByRole('link', { name: /Alle Bewertungsrunden/ }).getAttribute('href')).toBe(
      '/portfolio/runden',
    );
    expect(screen.queryByText(/Kommt (mit|nach) Release/)).toBeNull();
  });

  it('verteilt 50 Punkte einer Zelle ohne Überlappung innerhalb der Zelle', () => {
    const items = Array.from({ length: 50 }, () => levels(2, 2));
    const positions = spread(items, (item) => item);
    const keys = new Set(positions.map((p) => `${p.x.toFixed(4)}:${p.y.toFixed(4)}`));
    expect(keys.size).toBe(50);
    for (const p of positions) {
      expect(p.x).toBeGreaterThan(1);
      expect(p.x).toBeLessThan(2);
      expect(p.y).toBeGreaterThan(1);
      expect(p.y).toBeLessThan(2);
    }
  });

  it('die Matrix nennt jeden Lieferanten als Link zur Segmentierung und trägt Filter in der Adresse', async () => {
    renderAt(`/portfolio/matrix?bu=${id(900)}`);
    const link = await screen.findByRole('link', { name: 'Lieferant 7' });
    expect(link.getAttribute('href')).toBe(`/lieferanten/${id(7)}/strategie/segmentierung`);
    await waitFor(() =>
      expect(matrixUrls[0]).toBe(`/api/portfolio/matrix?businessUnitId=${id(900)}`),
    );
  });

  it('eine leere Matrix zeigt den leeren Zustand', async () => {
    matrix = { ...matrix, points: [] };
    renderAt('/portfolio/matrix');
    expect(await screen.findByText('Noch keine Lieferanten in der Matrix')).toBeTruthy();
  });

  it('offene Entscheidungen stehen in drei Gruppen beim richtigen Lieferanten', async () => {
    renderAt('/portfolio/offen');
    expect(await screen.findByText('Alpha GmbH')).toBeTruthy();
    expect(screen.getByText('1 von 3 Bewertungen')).toBeTruthy();
    expect(screen.getByText('Beta AG')).toBeTruthy();
    expect(screen.getByText('Abweichung 42 Punkte')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Gamma KG' }).getAttribute('href')).toBe(
      `/lieferanten/${id(3)}/strategie/segmentierung`,
    );
  });

  it('ohne offene Einträge steht „Nichts offen“', async () => {
    open = {
      deviationThreshold: 30,
      groups: { ratings_open: [], not_consolidated: [], deviation: [] },
    };
    renderAt('/portfolio/offen');
    expect(await screen.findByText('Nichts offen')).toBeTruthy();
  });

  it('bei einem Fehler erscheint der Fehlerzustand', async () => {
    api.handle = () => Response.json({ code: 'fehler' }, { status: 403 });
    renderAt('/portfolio/offen');
    expect(
      await screen.findByText('Die offenen Entscheidungen konnten nicht geladen werden.'),
    ).toBeTruthy();
  });
});
