// @vitest-environment jsdom
import type { MyAgent, MyAgentTask } from '@reziproq/shared';
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

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

// MA-01 Mein Agent (K1-f.3, Vorlage Mein-Agent): je Aufgabe die Stufe mit Schalter; nicht wählbare
// Stufen sind gesperrt (T1-MA3), eine ausgeschaltete Aufgabe hat keinen Schalter, Leser ändern
// nichts. Die Zahlen der Woche und die Quote kommen aus der API (G-6).

const task = (key: string, extra: Partial<MyAgentTask> = {}): MyAgentTask => ({
  key,
  allowedLevels: ['suggest', 'prepare', 'do'],
  selectable: ['suggest', 'prepare', 'do'],
  defaultLevel: 'prepare',
  chosen: null,
  level: 'prepare',
  enabled: true,
  cap: null,
  adoption: null,
  ...extra,
});

const agent = (): MyAgent => ({
  week: { since: '2026-11-23T00:00:00.000+01:00', done: 61, prepared: 23 },
  adoption: { unchanged: 87, decided: 100 },
  tasks: [
    task('inbox', { defaultLevel: 'do', level: 'do', adoption: { unchanged: 50, decided: 52 } }),
    task('meeting_brief', {
      allowedLevels: ['suggest', 'prepare'],
      selectable: ['prepare'],
      adoption: { unchanged: 6, decided: 7 },
    }),
    // Wie in der Registry: Beim Import wirkt heute nur Vorbereiten
    task('import_assign', { selectable: ['prepare'] }),
    task('market_signals', {
      allowedLevels: ['suggest'],
      selectable: ['suggest'],
      defaultLevel: 'suggest',
      level: null,
      enabled: false,
    }),
  ],
  canEdit: true,
  canManage: false,
});

let current: MyAgent;
let sent: { url: string; body: unknown }[];
let failSave: boolean;

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = actionsFor.member;
  current = agent();
  sent = [];
  failSave = false;
  api.handle = (request) => {
    if (request.url === '/api/mein-agent' && request.method === 'GET') {
      return Response.json(current);
    }
    if (request.method === 'PUT' && request.url.startsWith('/api/mein-agent/')) {
      sent.push({ url: request.url, body: request.body });
      if (failSave) return Response.json({ statusCode: 500 }, { status: 500 });
      const key = request.url.split('/').at(-1) ?? '';
      const level = (request.body as { level: MyAgentTask['level'] }).level;
      const updated = current.tasks.find((entry) => entry.key === key);
      return Response.json({ ...updated, chosen: level, level });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

const switchOf = (name: string) =>
  screen.getByRole('group', { name: `Wie viel Reziproq bei „${name}“ selbst tut` });

describe('MA-01 Mein Agent', () => {
  it('Das Wichtigste nennt die Zahlen der Woche und die Quote der letzten acht Wochen', async () => {
    renderAt('/mein-agent');
    expect(await screen.findByRole('heading', { level: 1, name: 'Mein Agent' })).toBeTruthy();
    const summary = await screen.findByRole('region', { name: 'Zusammengefasst von Reziproq' });
    expect(
      within(summary).getByText(
        'Diese Woche hat Reziproq 61 Vorgänge erledigt und 23 Entwürfe vorbereitet. In den letzten acht Wochen hast du 87 % unverändert übernommen.',
      ),
    ).toBeTruthy();
  });

  it('jede Aufgabe mit was sie tut, Quote und ihrer Stufe; gesperrt ist, was nicht wählbar ist (T1-MA3)', async () => {
    renderAt('/mein-agent');
    const inbox = await screen.findByRole('group', {
      name: 'Wie viel Reziproq bei „Postfach“ selbst tut',
    });
    expect(
      screen.getByText('Termine und Mails den Beziehungen zuordnen · 50 von 52 unverändert'),
    ).toBeTruthy();
    expect(
      (within(inbox).getByRole('radio', { name: 'Erledigen' }) as HTMLInputElement).checked,
    ).toBe(true);
    // Termin-Briefing: Erledigen ist nicht erlaubt, Vorschlagen wirkt noch nicht
    const brief = switchOf('Termin-Briefing');
    expect(
      (within(brief).getByRole('radio', { name: 'Erledigen' }) as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      (within(brief).getByRole('radio', { name: 'Vorschlagen' }) as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      screen.getByText(
        'vor wichtigen Terminen, Vorlauf je Termintyp · 6 von 7 unverändert · Vorschlagen folgt',
      ),
    ).toBeTruthy();
    // Import: Vorschlagen und Erledigen sind erlaubt, wirken aber noch nicht
    const imports = switchOf('Import');
    for (const level of ['Vorschlagen', 'Erledigen']) {
      expect(
        (within(imports).getByRole('radio', { name: level }) as HTMLInputElement).disabled,
        level,
      ).toBe(true);
    }
    expect(
      screen.getByText('Spend und Lieferanten zuordnen · Vorschlagen und Erledigen folgen'),
    ).toBeTruthy();
    // Ausgeschaltet: der Schalter ist ganz gesperrt
    expect((switchOf('Marktsignale') as HTMLFieldSetElement).disabled).toBe(true);
    expect(
      screen.getByText(
        'Signale aus öffentlichen Quellen auf Beziehungen abbilden · in den KI-Einstellungen aus',
      ),
    ).toBeTruthy();
  });

  it('T1-MA3: die Obergrenze der Organisation sperrt höhere Stufen und sagt warum', async () => {
    const capped = agent();
    capped.tasks[0] = {
      ...(capped.tasks[0] as MyAgentTask),
      cap: 'prepare',
      level: 'prepare',
      chosen: 'do',
      selectable: ['suggest', 'prepare'],
    };
    current = capped;
    renderAt('/mein-agent');
    const inbox = await screen.findByRole('group', {
      name: 'Wie viel Reziproq bei „Postfach“ selbst tut',
    });
    expect(
      (within(inbox).getByRole('radio', { name: 'Erledigen' }) as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      (within(inbox).getByRole('radio', { name: 'Vorbereiten' }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      screen.getByText(
        'Termine und Mails den Beziehungen zuordnen · 50 von 52 unverändert · höchstens Vorbereiten, festgelegt von Admins',
      ),
    ).toBeTruthy();
  });

  it('eine andere Stufe wählen speichert sie für die Person', async () => {
    renderAt('/mein-agent');
    const inbox = await screen.findByRole('group', {
      name: 'Wie viel Reziproq bei „Postfach“ selbst tut',
    });
    fireEvent.click(within(inbox).getByRole('radio', { name: 'Vorbereiten' }));
    await waitFor(() =>
      expect(sent).toEqual([{ url: '/api/mein-agent/inbox', body: { level: 'prepare' } }]),
    );
    await waitFor(() =>
      expect(
        (
          within(switchOf('Postfach')).getByRole('radio', {
            name: 'Vorbereiten',
          }) as HTMLInputElement
        ).checked,
      ).toBe(true),
    );
  });

  it('scheitert das Speichern, sagt die Zeile es', async () => {
    failSave = true;
    renderAt('/mein-agent');
    const inbox = await screen.findByRole('group', {
      name: 'Wie viel Reziproq bei „Postfach“ selbst tut',
    });
    fireEvent.click(within(inbox).getByRole('radio', { name: 'Vorschlagen' }));
    expect(
      await screen.findByText(
        'Die Stufe konnte nicht gespeichert werden. Bitte noch einmal versuchen.',
      ),
    ).toBeTruthy();
  });

  it('rechts: nie automatisch und wer was festlegt; die KI-Einstellungen nur für Admins als Link', async () => {
    renderAt('/mein-agent');
    expect(await screen.findByText('Nie automatisch, auf keiner Stufe')).toBeTruthy();
    for (const item of ['Zusagen im Namen deiner Seite', 'Freigaben', 'Bestätigung von Wert']) {
      expect(screen.getByText(item)).toBeTruthy();
    }
    const who = screen.getByRole('region', { name: 'Wer sieht was' });
    expect(
      within(who)
        .getByRole('link', { name: /Protokoll/ })
        .getAttribute('href'),
    ).toBe('/erledigt');
    expect(within(who).queryByRole('link', { name: /Budget, EU-Verarbeitung/ })).toBeNull();
  });

  it('Admins kommen von dort in die KI-Einstellungen', async () => {
    current = { ...agent(), canManage: true };
    renderAt('/mein-agent');
    const who = await screen.findByRole('region', { name: 'Wer sieht was' });
    expect(
      within(who)
        .getByRole('link', { name: /Budget, EU-Verarbeitung/ })
        .getAttribute('href'),
    ).toBe('/einstellungen/ki');
  });

  it('Leser sehen die Stufen, ändern sie aber nicht', async () => {
    current = { ...agent(), canEdit: false };
    renderAt('/mein-agent');
    const inbox = await screen.findByRole('group', {
      name: 'Wie viel Reziproq bei „Postfach“ selbst tut',
    });
    expect((inbox as HTMLFieldSetElement).disabled).toBe(true);
    expect(
      screen.getByText('Als Leser siehst du die Stufen, änderst sie aber nicht.'),
    ).toBeTruthy();
  });
});
