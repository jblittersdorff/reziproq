// @vitest-environment jsdom
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

// Tests zu docs/specs/PLT-11.md: globale Leiste, Routen, Profil, Pfad und Seitenmuster. Was nur
// ein echter Browser zeigt (390 px, Tastatur, Zurück-Knopf), prüft e2e/plt-11.spec.ts.

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

const admin = { ...anna, orgRole: 'admin' as const };

/** NAV-10 1.1: Ziele der Seitenleiste: Suchen oder fragen, vier Hauptpunkte, Einstellungen, Person. */
const barTargets = [
  { label: 'Suchen oder fragen', path: '/fragen' },
  { label: 'Übersicht', path: '/uebersicht' },
  { label: 'Mein Tag', path: '/mein-tag' },
  { label: 'Lieferanten', path: '/lieferanten' },
  { label: 'Warengruppen', path: '/warengruppen' },
  { label: 'Einstellungen', path: '/einstellungen' },
  { label: 'Profil', path: '/profil' },
];

/** Alle Routen dieser Spec mit ihrem Titel (h1). Start begrüßt statt eines Titels. */
const routes = [
  { path: '/start', title: 'Mein Tag' },
  { path: '/lieferanten', title: 'Lieferanten' },
  { path: '/portfolio', title: 'Matrix' },
  { path: '/wirkung', title: 'Übersicht' },
  { path: '/fragen', title: 'Frag Reziproq' },
  { path: '/profil', title: 'Profil' },
  { path: '/einstellungen', title: 'Einstellungen' },
  { path: '/einstellungen/organisation', title: 'Organisation' },
  { path: '/menu', title: 'Menü' },
];

const bar = () => screen.getByRole('navigation', { name: 'Hauptnavigation' });

describe('Nach dem Login landet der Nutzer auf /start', () => {
  it('leitet / und die frühere Übersicht auf /start um', async () => {
    for (const path of ['/', '/start']) {
      const router = renderAt(path);
      await screen.findByRole('heading', { level: 1, name: 'Mein Tag' });
      expect(router.state.location.pathname).toBe('/mein-tag');
      tearDownApp();
      setUpApp();
    }
  });

  it.each([
    [true, null, '/uebersicht'],
    [true, 'my_day', '/mein-tag'],
    [false, 'overview', '/uebersicht'],
  ] as const)(
    'beachtet Rollenstandard %s und Auswahl %s',
    async (defaultOverview, startPage, destination) => {
      api.me = { ...anna, defaultOverview, startPage };
      const router = renderAt('/');
      await waitFor(() => expect(router.state.location.pathname).toBe(destination));
    },
  );

  it.each([
    [8, 'Guten Morgen, Anna.'],
    [14, 'Guten Tag, Anna.'],
    [20, 'Guten Abend, Anna.'],
  ])('begrüßt um %i Uhr mit „%s“', async (hour, greeting) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 29, hour, 0));
    renderAt('/start');
    // NAV-10 1.1: Titel „Mein Tag“, darunter Wochentag und Datum mit Begrüßung
    await screen.findByRole('heading', { level: 1, name: 'Mein Tag' });
    expect(await screen.findByText(`Donnerstag, 29. Oktober · ${greeting}`)).toBeDefined();
  });

  it('auf Mein Tag führt „Suchen oder fragen“ zu /fragen (kein eigenes Fragefeld mehr)', async () => {
    const router = renderAt('/start');
    await screen.findByRole('heading', { level: 1, name: 'Mein Tag' });
    expect(screen.queryByRole('textbox', { name: 'Deine Frage an Reziproq' })).toBeNull();
    fireEvent.click(within(bar()).getByRole('link', { name: 'Suchen oder fragen' }));
    await screen.findByRole('heading', { level: 1, name: 'Frag Reziproq' });
    expect(router.state.location.pathname).toBe('/fragen');
  });
});

describe('Jedes Ziel der globalen Leiste ist mit einem Klick erreichbar, die aktive Seite ist markiert', () => {
  it.each(routes)('auf $path zeigt die Leiste alle Ziele', async (route) => {
    renderAt(route.path);
    await screen.findByRole('heading', { level: 1 });
    // Einstellungen und Person erscheinen, sobald /me geladen ist
    await waitFor(() => {
      const links = within(bar()).getAllByRole('link');
      const named = links.map((link) => link.getAttribute('aria-label') ?? link.textContent);
      for (const target of barTargets) expect(named).toContain(target.label);
    });
  });

  it.each(barTargets)('ein Klick auf $label öffnet $path und markiert es', async (target) => {
    const router = renderAt('/start');
    await screen.findByRole('heading', { level: 1 });
    const link = within(bar())
      .getAllByRole('link')
      .find(
        (candidate) =>
          (candidate.getAttribute('aria-label') ?? candidate.textContent) === target.label,
      );
    if (!link) throw new Error(`${target.label} fehlt`);
    fireEvent.click(link);
    await waitFor(() => expect(router.state.location.pathname).toBe(target.path));
    const active = within(bar())
      .getAllByRole('link')
      .filter((candidate) => candidate.getAttribute('aria-current') === 'page');
    expect(active.map((candidate) => candidate.getAttribute('href'))).toEqual([target.path]);
  });

  it('markiert auf Unterseiten der Einstellungen die Einstellungen (NAV-10 1.1)', async () => {
    renderAt('/einstellungen/organisation');
    await screen.findByRole('heading', { level: 1, name: 'Organisation' });
    await waitFor(() => {
      const active = within(bar())
        .getAllByRole('link')
        .filter((candidate) => candidate.getAttribute('aria-current') === 'page');
      expect(active.map((candidate) => candidate.getAttribute('href'))).toEqual(['/einstellungen']);
    });
  });

  it('zeigt auch auf der Menüseite dieselben Ziele', async () => {
    renderAt('/menu');
    await screen.findByRole('heading', { level: 1, name: 'Menü' });
    const menu = screen.getByRole('navigation', { name: 'Menü' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/uebersicht', '/mein-tag', '/lieferanten', '/warengruppen', '/fragen', '/profil']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('zeigt Organisationen ohne Käuferfunktionen nur das Profil', async () => {
    api.me = { ...anna, permissions: { ...anna.permissions, viewBuyerAreas: false } };
    renderAt('/profil');
    await screen.findByRole('heading', { level: 1, name: 'Profil' });
    await waitFor(() => {
      const links = within(bar()).getAllByRole('link');
      expect(links.map((link) => link.getAttribute('href'))).toEqual([
        '/',
        '/einstellungen',
        '/profil',
      ]);
    });
  });

  it('bietet als erstes Tab-Ziel den Sprung zum Inhalt', async () => {
    renderAt('/start');
    const skip = await screen.findByRole('link', { name: 'Zum Inhalt springen' });
    expect(skip.getAttribute('href')).toBe('#inhalt');
    expect(document.querySelectorAll('a[href], button')[0]).toBe(skip);
    expect(document.getElementById('inhalt')?.tagName).toBe('MAIN');
  });
});

describe('Jede Route lässt sich über ihre Adresse direkt öffnen und zeigt Titel und leeren Zustand', () => {
  it.each(routes)('$path zeigt den Titel', async (route) => {
    api.me = admin;
    api.permissions = actionsFor.admin;
    renderAt(route.path);
    expect(
      await screen.findByRole('heading', { level: 1, name: new RegExp(`^${route.title}`) }),
    ).toBeDefined();
  });

  it.each([['/uebersicht/ergebnisse', 'Ergebnisse', 'Noch keine Ergebnisse']])(
    '%s zeigt den leeren Zustand und setzt den Tab-Titel',
    async (path, title, empty) => {
      renderAt(path);
      await screen.findByRole('heading', { level: 1, name: title });
      expect(screen.getByText(empty)).toBeDefined();
      expect(document.title).toBe(`${title} – Reziproq`);
    },
  );
});

it('/portfolio setzt den Tab-Titel', async () => {
  renderAt('/portfolio');
  await screen.findByRole('heading', { level: 1, name: 'Matrix' });
  expect(document.title).toBe('Matrix – Reziproq');
});

describe('Der Weg zu allen Einstellungen ist nur für Admins sichtbar, jedes Mitglied sieht Organisation', () => {
  it('ein Mitglied ohne Admin sieht nur den Weg zu Einstellungen › Organisation', async () => {
    renderAt('/profil');
    await within(await screen.findByRole('main')).findByText('Anna Schmidt');
    expect(screen.getByRole('link', { name: /Organisation/ }).getAttribute('href')).toBe(
      '/einstellungen/organisation',
    );
    expect(screen.queryByRole('link', { name: 'Alle Einstellungen' })).toBeNull();
  });

  it('ein Admin sieht zusätzlich den Weg zu allen Einstellungen', async () => {
    api.me = admin;
    api.permissions = actionsFor.admin;
    renderAt('/profil');
    await within(await screen.findByRole('main')).findByText('Anna Schmidt');
    // Die Rechte kommen aus /me/permissions, kurz nach /me.
    expect(
      (await screen.findByRole('link', { name: 'Alle Einstellungen' })).getAttribute('href'),
    ).toBe('/einstellungen');
    expect(screen.getByRole('link', { name: /Organisation/ })).toBeDefined();
  });

  it('ohne Organisation erscheint kein Weg zu den Einstellungen', async () => {
    api.me = {
      ...anna,
      organization: null,
      permissions: { ...anna.permissions, viewOrganizationSettings: false },
    };
    renderAt('/profil');
    await screen.findByText('Keiner Organisation zugeordnet');
    expect(screen.queryByRole('link', { name: /Organisation/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Alle Einstellungen' })).toBeNull();
  });

  it('wer /einstellungen ohne Admin direkt öffnet, sieht den Hinweis und nur die Organisation', async () => {
    renderAt('/einstellungen');
    expect(await screen.findByText(/kann nur ein Admin ändern/)).toBeDefined();
    expect(screen.getByRole('link', { name: /Organisation/ })).toBeDefined();
  });

  it('Einstellungen › Organisation zeigt jedem Mitglied Name, Land und Mitglieder', async () => {
    renderAt('/einstellungen/organisation');
    expect(await screen.findByText('Beispiel-OEM (Demo)')).toBeDefined();
    expect(screen.getByText('Deutschland')).toBeDefined();
    const rows = within(screen.getByRole('table', { name: 'Mitglieder' })).getAllByRole('row');
    // Seit PLT-05 mit Rolle und Controlling.
    expect(rows.map((row) => row.textContent)).toEqual([
      'NameE-MailRolleControlling',
      'Anna Schmidtanna@example.comNutzer–',
      'Ben Weberben@example.comAdminControlling',
    ]);
  });
});

describe('Pfad mit Zurück-Pfeil', () => {
  it.each([
    ['/profil/sprache', anna, ['Profil'], 'Zurück zu Profil', '/profil'],
    ['/einstellungen/organisation', anna, ['Profil'], 'Zurück zu Profil', '/profil'],
    [
      '/einstellungen/organisation',
      admin,
      ['Profil', 'Einstellungen'],
      'Zurück zu Einstellungen',
      '/einstellungen',
    ],
  ])('%s zeigt den Pfad', async (path, me, trail, back, backHref) => {
    api.me = me;
    api.permissions = me.orgRole === 'admin' ? actionsFor.admin : actionsFor.member;
    renderAt(path);
    const nav = await screen.findByRole('navigation', { name: 'Pfad' });
    await waitFor(() =>
      expect(within(nav).getByRole('link', { name: back }).getAttribute('href')).toBe(backHref),
    );
    const steps = within(nav)
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(steps.slice(0, -1)).toEqual(trail);
  });

  it('zeigt auf der Hauptebene keinen Pfad', async () => {
    renderAt('/portfolio');
    await screen.findByRole('heading', { level: 1, name: 'Matrix' });
    expect(screen.queryByRole('navigation', { name: 'Pfad' })).toBeNull();
  });
});

describe('Unbekannte Adressen zeigen die Nicht-gefunden-Seite', () => {
  it.each(['/gibt-es-nicht', '/beziehungen', '/puls', '/jbp', '/qbr', '/pnl'])(
    '%s',
    async (path) => {
      renderAt(path);
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Diese Seite gibt es nicht' }),
      ).toBeDefined();
      expect(screen.getByRole('link', { name: 'Zu Start' }).getAttribute('href')).toBe('/start');
    },
  );
});

describe('Ohne Login', () => {
  // Seit PLT-01: geschützte Seiten leiten direkt zu Zitadel weiter und merken sich die Seite.
  it.each([...routes.map((route) => route.path), '/gibt-es-nicht'])(
    '%s leitet zur Anmeldung weiter und zeigt bis dahin keine Inhalte',
    async (path) => {
      const signinRedirect = vi.fn();
      auth.state = { ...signedIn, user: null, signinRedirect };
      renderAt(path);
      expect((await screen.findByRole('status')).textContent).toBe('Anmeldung wird geprüft …');
      await waitFor(() =>
        expect(signinRedirect).toHaveBeenCalledWith({ state: { returnTo: path } }),
      );
      expect(screen.queryByRole('navigation')).toBeNull();
      expect(document.getElementById('inhalt')).toBeNull();
      expect(fetch).not.toHaveBeenCalledWith('/api/me', expect.anything());
    },
  );
});
