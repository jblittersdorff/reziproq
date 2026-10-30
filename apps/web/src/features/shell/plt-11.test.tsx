// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { anna, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/PLT-11.md: App-Rahmen und Startseite.

// Nachgebauter Login: react-oidc-context liefert den Zustand, den der Test vorgibt.
const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
});

afterEach(tearDownApp);

// Reihenfolge, Sätze, Routen und Releases aus der Tabelle in PLT-11.
const areas = [
  {
    title: 'Lieferanten',
    path: '/lieferanten',
    release: '0.1',
    sentence:
      'Welche Lieferanten wirklich zählen – nach Business Impact und Beziehungsqualität, nicht nur nach Spend.',
  },
  {
    title: 'Beziehungen',
    path: '/beziehungen',
    release: '0.2',
    sentence:
      'Rechte und Pflichten je Beziehungstyp, Rollen und Ansprechpartner auf beiden Seiten.',
  },
  {
    title: 'Beziehungspuls',
    path: '/puls',
    release: '0.2',
    sentence: 'Wie beide Seiten die Beziehung sehen – heute und gewünscht.',
  },
  {
    title: 'Joint Business Plans',
    path: '/jbp',
    release: '0.3',
    sentence: 'Gemeinsame Ziele, Initiativen und KPIs mit strategischen Lieferanten.',
  },
  {
    title: 'QBRs und Maßnahmen',
    path: '/qbr',
    release: '0.3',
    sentence: 'Fortschritt regelmäßig prüfen, Zusagen nachhalten, Maßnahmen steuern.',
  },
  {
    title: 'P&L-Impact',
    path: '/pnl',
    release: '1.0',
    sentence: 'Welcher Wert aus der Zusammenarbeit in der GuV ankommt – belegt und freigegeben.',
  },
];

const navEntries = [
  { label: 'Übersicht', path: '/uebersicht' },
  ...areas.map(({ title, path }) => ({ label: title, path })),
  { label: 'Einstellungen', path: '/einstellungen' },
];

describe('Startseite', () => {
  it('leitet / auf /uebersicht um', async () => {
    const router = renderAt('/');
    await screen.findByRole('heading', { level: 1 });
    expect(router.state.location.pathname).toBe('/uebersicht');
  });

  it.each([
    [8, 'Guten Morgen, Anna'],
    [14, 'Guten Tag, Anna'],
    [20, 'Guten Abend, Anna'],
  ])('begrüßt um %i Uhr mit „%s“', async (hour, greeting) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 29, hour, 0));
    renderAt('/uebersicht');
    expect(await screen.findByRole('heading', { level: 1, name: greeting })).toBeDefined();
  });

  it('zeigt genau sechs Kacheln in der Reihenfolge der Spec mit Satz und Release', async () => {
    renderAt('/uebersicht');
    const region = await screen.findByRole('region', { name: 'Bereiche' });
    // Die Kennzahl der Lieferanten-Kachel kommt erst mit der Antwort der API.
    await within(region).findByText(/^3 Lieferanten/);
    const tiles = within(region).getAllByRole('link');
    expect(tiles).toHaveLength(6);
    tiles.forEach((tile, index) => {
      const area = areas[index];
      expect(tile.getAttribute('href')).toBe(area?.path);
      expect(tile.textContent).toContain(area?.title);
      expect(tile.textContent).toContain(area?.sentence);
      // Seit PLT-02 zeigt die Lieferanten-Kachel Kennzahlen statt des Release-Hinweises.
      // Intl trennt Betrag und Währung mit einem geschützten Leerzeichen.
      expect(tile.textContent?.replaceAll('\u00a0', ' ')).toContain(
        area?.title === 'Lieferanten'
          ? '3 Lieferanten · 10.230.000 € Jahresspend 2025'
          : `Kommt mit Release ${area?.release}`,
      );
    });
  });

  it.each(areas)('öffnet mit einem Klick auf die Kachel $title die Route $path', async (area) => {
    const router = renderAt('/uebersicht');
    const region = await screen.findByRole('region', { name: 'Bereiche' });
    // Klick auf den Satz, nicht auf den Titel: die ganze Kachel ist anklickbar.
    fireEvent.click(within(region).getByText(area.sentence));
    expect(await screen.findByRole('heading', { level: 1, name: area.title })).toBeDefined();
    expect(router.state.location.pathname).toBe(area.path);
  });

  it('lässt den Platz für das Prompt-Fenster leer, ohne Eingabefeld', async () => {
    renderAt('/uebersicht');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

describe('Seitenleiste', () => {
  it.each(navEntries)('markiert $label als aktiv auf $path', async (entry) => {
    renderAt(entry.path);
    await screen.findByRole('heading', { level: 1 });

    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(navEntries.map((e) => e.label));
    const active = links.filter((link) => link.getAttribute('aria-current') === 'page');
    expect(active.map((link) => link.textContent)).toEqual([entry.label]);
  });

  it('zeigt Name und E-Mail aus /api/me im Nutzer-Menü', async () => {
    renderAt('/uebersicht');
    expect(await screen.findByText('Anna Schmidt')).toBeDefined();
    expect(screen.getByText('anna@example.com')).toBeDefined();
  });

  it('bietet als erstes Tab-Ziel den Sprung zum Inhalt', async () => {
    renderAt('/uebersicht');
    const skip = await screen.findByRole('link', { name: 'Zum Inhalt springen' });
    expect(skip.getAttribute('href')).toBe('#inhalt');
    const focusable = document.querySelectorAll('a[href], button');
    expect(focusable[0]).toBe(skip);
    expect(document.getElementById('inhalt')?.tagName).toBe('MAIN');
  });
});

describe('Bereichsseiten', () => {
  // Lieferanten ist seit PLT-02 eine echte Seite (siehe features/suppliers/plt-02.test.tsx).
  const comingSoon = areas.filter((area) => area.path !== '/lieferanten');

  it.each(comingSoon)('$path zeigt Titel, Satz und leeren Zustand mit Release', async (area) => {
    renderAt(area.path);
    expect(await screen.findByRole('heading', { level: 1, name: area.title })).toBeDefined();
    expect(screen.getByText(area.sentence)).toBeDefined();
    expect(screen.getByText(`Kommt mit Release ${area.release}`)).toBeDefined();
    expect(document.title).toBe(`${area.title} – Reziproq`);
  });
});

describe('Einstellungen', () => {
  it('zeigt das Erscheinungsbild mit „System“ als Standard', async () => {
    renderAt('/einstellungen');
    expect(await screen.findByRole('radio', { name: 'System' })).toHaveProperty('checked', true);
    expect(screen.getByRole('radio', { name: 'Hell' })).toBeDefined();
    expect(screen.getByRole('radio', { name: 'Dunkel' })).toBeDefined();
  });

  it('schaltet auf Dunkel um und merkt sich die Wahl im Browser', async () => {
    renderAt('/einstellungen');
    fireEvent.click(await screen.findByRole('radio', { name: 'Dunkel' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('reziproq-theme')).toBe('dark');
  });

  it('zeigt den Abschnitt Organisation nur, wenn die API ihn erlaubt', async () => {
    api.me = { ...anna, permissions: { ...anna.permissions, viewOrganizationSettings: true } };
    renderAt('/einstellungen');
    expect(await screen.findByRole('heading', { level: 2, name: 'Organisation' })).toBeDefined();
  });

  it('blendet den Abschnitt Organisation für Nicht-Admins aus', async () => {
    renderAt('/einstellungen');
    await screen.findByText('Anna Schmidt');
    expect(screen.queryByRole('heading', { name: 'Organisation' })).toBeNull();
  });
});

describe('Unbekannte Adresse', () => {
  it('zeigt die Nicht-gefunden-Seite mit dem Weg zur Übersicht', async () => {
    renderAt('/gibt-es-nicht');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Diese Seite gibt es nicht' }),
    ).toBeDefined();
    const back = screen.getByRole('link', { name: 'Zur Übersicht' });
    expect(back.getAttribute('href')).toBe('/uebersicht');
  });
});

describe('Ohne Login', () => {
  it.each([...navEntries.map((e) => e.path), '/gibt-es-nicht'])(
    '%s zeigt die Anmeldung statt der Seite',
    async (path) => {
      auth.state = { ...signedIn, user: null };
      renderAt(path);
      expect(await screen.findByRole('button', { name: 'Anmelden' })).toBeDefined();
      expect(screen.queryByRole('navigation')).toBeNull();
      expect(fetch).not.toHaveBeenCalledWith('/api/me', expect.anything());
    },
  );

  it('zeigt einen Ladezustand, solange die Sitzung geprüft wird', async () => {
    auth.state = { ...signedIn, user: null, isLoading: true };
    renderAt('/uebersicht');
    expect((await screen.findByRole('status')).textContent).toBe('Anmeldung wird geprüft …');
  });
});
