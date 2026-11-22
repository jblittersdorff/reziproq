// @vitest-environment jsdom
import { type AiSettingsResponse, type AiUsage, defaultAiSettings } from '@reziproq/shared';
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

// Tests zu docs/specs/KI-01.md in der Oberfläche: Einstellungen KI mit EU immer an, Beträge in
// Euro, Verbrauch je Funktion für Admins, nur das Kontingent für andere Käufer.

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

let settings: AiSettingsResponse;
let usage: AiUsage;
let sent: unknown[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  sent = [];
  api.me = { ...anna, orgRole: 'admin' };
  api.permissions = actionsFor.admin;
  settings = { settings: defaultAiSettings, euOnly: true, canEdit: true };
  usage = {
    month: '2026-11',
    budgetMonthCents: 15_000,
    usedCents: 4_099,
    calls: 38,
    byFeature: [
      { feature: 'prompt', calls: 15, costCents: 1_607 },
      { feature: 'market_analysis', calls: 3, costCents: 362 },
    ],
  };
  api.handle = (request) => {
    if (request.url === '/api/einstellungen/ki' && request.method === 'GET') {
      return Response.json(settings);
    }
    if (request.url === '/api/einstellungen/ki' && request.method === 'PUT') {
      sent.push(request.body);
      return Response.json({ ...settings, settings: request.body });
    }
    if (request.url === '/api/ki/kontingent') return Response.json(usage);
    return undefined;
  };
});

afterEach(tearDownApp);

describe('KI-01 Einstellungen KI', () => {
  it('EU ist immer an; Beträge werden in Euro gepflegt und in Cent gespeichert', async () => {
    renderAt('/einstellungen/ki');
    const eu = await screen.findByRole('switch', { name: 'Verarbeitung nur in der EU' });
    expect(eu.getAttribute('aria-checked')).toBe('true');
    expect((eu as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('immer an')).toBeTruthy();
    const month = screen.getByRole('textbox', { name: 'Budget je Monat in Euro' });
    expect((month as HTMLInputElement).value).toBe('150');
    expect(
      (screen.getByRole('textbox', { name: 'Höchstens je Lauf in Euro' }) as HTMLInputElement)
        .value,
    ).toBe('2,00');
    fireEvent.change(month, { target: { value: '200' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Öffentliche Recherche' }));
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen speichern' }));
    await waitFor(() =>
      expect(sent[0]).toEqual({
        ...defaultAiSettings,
        budgetMonthCents: 20_000,
        publicResearch: true,
      }),
    );
    expect(await screen.findByText('Gespeichert.')).toBeTruthy();
  });

  it('ein ungültiger Betrag wird nicht gesendet', async () => {
    renderAt('/einstellungen/ki');
    const month = await screen.findByRole('textbox', { name: 'Budget je Monat in Euro' });
    fireEvent.change(month, { target: { value: 'viel' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen speichern' }));
    expect(await screen.findByText('Speichern hat nicht geklappt. Prüf die Beträge.')).toBeTruthy();
    expect(sent).toHaveLength(0);
  });

  it('Admins sehen den Verbrauch je Funktion mit Summe', async () => {
    renderAt('/einstellungen/ki');
    const card = await screen.findByRole('region', { name: 'Verbrauch im November' });
    expect(within(card).getByText(/^40,99\s€ von 150,00\s€$/)).toBeTruthy();
    const rows = within(card).getAllByRole('row');
    expect(rows.map((row) => row.textContent)).toEqual([
      'FunktionAufrufeKosten',
      expect.stringMatching(/^Fragen1516,07\s€$/),
      expect.stringMatching(/^Marktanalyse33,62\s€$/),
      expect.stringMatching(/^Gesamt3840,99\s€$/),
    ]);
  });

  it('ohne Adminrechte nur das Kontingent, keine Einstellungen und keine Aufteilung', async () => {
    api.me = { ...anna, orgRole: 'member' };
    api.permissions = actionsFor.member;
    usage = { ...usage, byFeature: null };
    renderAt('/einstellungen/ki');
    const card = await screen.findByRole('region', { name: 'Verbrauch im November' });
    expect(within(card).getByText(/^40,99\s€ von 150,00\s€$/)).toBeTruthy();
    expect(within(card).queryByRole('table')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Einstellungen speichern' })).toBeNull();
  });
});
