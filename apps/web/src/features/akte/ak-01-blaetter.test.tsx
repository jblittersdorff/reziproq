// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { akteCounterpartSample } from '@/testing/akte-counterpart-sample';
import { aktePrivateSample } from '@/testing/akte-private-sample';
import {
  type AkteSheetsSample,
  akteSheetsKpi,
  akteSheetsRelationship,
  akteSheetsSample,
} from '@/testing/akte-sheets-sample';
import { api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// AK-01 (K2-c.5): Blätter über der Akte (E-K0-01: 620 px von rechts, Esc schließt, mobil volle
// Seite): Profil nach der Vorlage K2-Profil, Spielregeln und Kennzahl-Verlauf (E-K4-4) nach Regeln.
// Die Akte bleibt dahinter in derselben Sicht.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

let sheets: AkteSheetsSample;
beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  sheets = akteSheetsSample();
  api.akteSheets = sheets;
  api.aktePrivate = aktePrivateSample();
  const counterpart = akteCounterpartSample();
  counterpart.team.members = [
    { userId: 'jan', name: 'Jan-Luka', teamRole: 'sro', function: null, visibility: 'shared' },
    { userId: 'ida', name: 'Ida Roth', teamRole: 'member', function: null, visibility: 'internal' },
    {
      userId: 'max',
      name: 'Max Klein',
      teamRole: 'viewer',
      function: null,
      visibility: 'internal',
    },
  ];
  api.akteCounterpart = counterpart;
});
afterEach(tearDownApp);

const id = akteSheetsRelationship;
const akte = `/beziehungen/${id}`;
/** Text ohne geschützte Leerzeichen, die Intl zwischen Betrag und Währung setzt */
const plain = (value: string | null | undefined) => (value ?? '').replace(/[  ]/g, ' ');
const sheet = (name: string) => screen.findByRole('dialog', { name });

describe('AK-01 Blatt Profil (Vorlage K2-Profil)', () => {
  it('Das Wichtigste: Wachstum und Rang nach Spend, Spend zum Vorjahr und fehlender Draht', async () => {
    renderAt(`${akte}/profil`);
    const profile = await sheet('Profil');
    expect(
      await within(profile).findByText('Rheintal Elektronik GmbH · Stammdaten aus dem Import'),
    ).toBeTruthy();
    await waitFor(() =>
      expect(plain(profile.textContent)).toContain(
        'Rheintal Elektronik wächst seit 2022 jedes Jahr und ist mit 4,2 Mio. € euer größter Lieferant.',
      ),
    );
    expect(plain(profile.textContent)).toContain('GutSpend +8 % zum Vorjahr');
    await waitFor(() =>
      expect(profile.textContent).toContain(
        'LückeZu Kim Kaiser und Nils Ott fehlt der direkte Draht',
      ),
    );
    expect(
      within(profile)
        .getByRole('link', { name: /fehlt der direkte Draht/ })
        .getAttribute('href'),
    ).toBe(`${akte}?sicht=privat#netz`);
  });

  it('Stammdaten, Spend je Jahr, Kontakte, Team beider Seiten, Bearbeiten und Import', async () => {
    renderAt(`${akte}/profil`);
    const profile = await sheet('Profil');
    const master = await within(profile).findByRole('region', { name: 'Stammdaten' });
    expect(master.textContent).toContain(
      'Rheintal Elektronik GmbHDeutschland · USt-IdNr. DE123456789 · DUNS 31-456-7890',
    );
    await waitFor(() =>
      expect(master.textContent).toContain(
        'WarengruppenLeiterplatten (Haupt) · Bestückte Baugruppen',
      ),
    );
    expect(master.textContent).toContain('Business UnitsAntriebe · Sensorik');
    expect(master.textContent).toContain('Externe Nummer K-10442in Reziproq seit 01.10.2026');
    const spend = within(profile).getByRole('region', { name: 'Spend je Jahr' });
    await waitFor(() =>
      expect([...spend.querySelectorAll('b')].map((year) => year.textContent)).toEqual([
        '2023',
        '2024',
        '2025',
        '2026',
      ]),
    );
    expect(plain(spend.textContent)).toContain('20264,2 Mio. €');
    const contacts = await within(profile).findByRole('region', {
      name: 'Kontakte bei Rheintal Elektronik · 3',
    });
    expect(contacts.textContent).toContain(
      'Kim KaiserGeschäftsführerin · kim-kaiser@rheintal.example',
    );
    const team = within(profile).getByRole('region', { name: 'Team in Reziproq' });
    await waitFor(() =>
      expect(team.textContent).toContain(
        'Euer Team · 3Jan-Luka (SRO), Ida Roth, Max Klein (Leser) · Rollen sieht nur ihr',
      ),
    );
    expect(team.textContent).toContain('Kim KaiserSponsoraktiv');
    expect(team.textContent).toContain('Nils Ott, Tom Weber');
    expect(within(profile).getByRole('link', { name: 'Bearbeiten' }).getAttribute('href')).toBe(
      `/lieferanten/${id}/strategie/profil/bearbeiten`,
    );
    expect(within(profile).getByRole('link', { name: 'Import öffnen' }).getAttribute('href')).toBe(
      '/lieferanten/importieren',
    );
  });

  it('„···“ öffnet das Profil über derselben Sicht; Schließen und Esc führen in sie zurück', async () => {
    const router = renderAt(`${akte}?sicht=privat`);
    await screen.findByRole('heading', { level: 1, name: 'Rheintal Elektronik' });
    const more = screen.getByRole('link', { name: 'Profil, Team und Mandat' });
    expect(more.getAttribute('href')).toBe(`${akte}/profil?sicht=privat`);
    fireEvent.click(more);
    const profile = await sheet('Profil');
    expect(router.state.location.pathname).toBe(`${akte}/profil`);
    fireEvent.click(within(profile).getByRole('button', { name: 'Schließen' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(akte));
    expect(router.state.location.search).toMatchObject({ sicht: 'privat' });
    expect(screen.queryByRole('dialog', { name: 'Profil' })).toBeNull();
    // Esc löst am Dialog „cancel“ aus
    fireEvent.click(screen.getByRole('link', { name: 'Profil, Team und Mandat' }));
    fireEvent(await sheet('Profil'), new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(router.state.location.pathname).toBe(akte));
  });
});

describe('AK-01 Blatt Spielregeln', () => {
  it('Rechte und Pflichten von Rheintal mit Gruppe und Takt, Formate, geteilt am', async () => {
    renderAt(`${akte}/spielregeln`);
    const rules = await sheet('Spielregeln');
    expect(
      await within(rules).findByText('„Strategisch“ · Version 1 · geteilt am 15.10.2026'),
    ).toBeTruthy();
    expect(rules.textContent).toContain('Hohes Versorgungsrisiko und hoher Wertbeitrag');
    const rights = within(rules).getByRole('region', { name: 'Rechte von Rheintal Elektronik' });
    await waitFor(() => expect(rights.textContent).toContain('Prognosen 12 Monate im Voraus'));
    expect(rights.textContent).toContain('Zusammenarbeit');
    const duties = within(rules).getByRole('region', { name: 'Pflichten von Rheintal Elektronik' });
    expect(duties.textContent).toContain(
      'Kapazität jedes Quartal meldenquartalsweise · Beschreibung Kapazität jedes Quartal melden',
    );
    expect(duties.textContent).toContain('Kostenstruktur offenlegenlaufend');
    const formats = within(rules).getByRole('region', { name: 'Formate' });
    expect(formats.textContent).toContain('Qualitätquartalsweise · Fachebene');
    expect(within(rules).getByRole('link', { name: 'Bearbeiten' }).getAttribute('href')).toBe(
      `/lieferanten/${id}/beziehung/spielregeln/bearbeiten`,
    );
    expect(within(rules).queryByRole('link', { name: 'Änderungen teilen' })).toBeNull();
  });

  it('ungeteilte Änderungen führen zum Teilen; ohne Spielregeln zum Vorschlag', async () => {
    const current = sheets.rules.current;
    if (!current) throw new Error('Spielregeln fehlen im Beispiel');
    sheets.rules.current = { ...current, version: 2, status: 'approved', visibility: 'internal' };
    renderAt(`${akte}/spielregeln`);
    const rules = await sheet('Spielregeln');
    expect(
      await within(rules).findByText('„Strategisch“ · Version 2 · Änderungen noch nicht geteilt'),
    ).toBeTruthy();
    expect(
      within(rules).getByRole('link', { name: 'Änderungen teilen' }).getAttribute('href'),
    ).toBe(`/lieferanten/${id}/beziehung/spielregeln/teilen`);
    tearDownApp();
    setUpApp();
    sheets = akteSheetsSample();
    sheets.rules.current = null;
    sheets.rules.shared = null;
    api.akteSheets = sheets;
    renderAt(`${akte}/spielregeln`);
    const none = await within(await sheet('Spielregeln')).findByRole('link', {
      name: /Noch keine Spielregeln/,
    });
    expect(none.getAttribute('href')).toBe(`/lieferanten/${id}/beziehung/spielregeln/vorschlag`);
  });
});

describe('AK-01 Blatt Kennzahl-Verlauf (E-K4-4)', () => {
  it('aus der Scorecard-Zeile: Stand, Basis und Ziel, Werte mit Herkunft, wer erfasst', async () => {
    renderAt(`${akte}/kennzahlen/${akteSheetsKpi}`);
    const kpi = await sheet('Liefertreue');
    expect(
      await within(kpi).findByText('Rheintal Elektronik · Ziel 97 % bis 31.12.2027'),
    ).toBeTruthy();
    expect(kpi.textContent).toContain('knappBasis 92 %, Ziel 97 % · zuletzt 94 % im Oktober');
    const values = within(kpi).getByRole('region', { name: 'Werte' });
    expect([...values.querySelectorAll('b')].map((month) => month.textContent)).toEqual([
      'Oktober 2026',
      'September 2026',
      'August 2026',
    ]);
    expect(values.textContent).toContain('Tom Weber, 04.11.2026 · Import94 %');
    expect(kpi.textContent).toContain('Werte erfasst Rheintal Elektronik.');
  });

  it('die Kennzahl der eigenen Seite lässt sich erfassen', async () => {
    sheets.kpi.kpi = { ...sheets.kpi.kpi, ownerSide: 'buyer', own: true, canEnter: true };
    renderAt(`${akte}/kennzahlen/${akteSheetsKpi}`);
    const kpi = await sheet('Liefertreue');
    expect(
      (await within(kpi).findByRole('link', { name: 'Wert erfassen' })).getAttribute('href'),
    ).toBe(`/lieferanten/${id}/plan/scorecard/${akteSheetsKpi}/wert`);
  });
});
