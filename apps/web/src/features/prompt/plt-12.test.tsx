// @vitest-environment jsdom

import { promptLimits, promptRequestSchema } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  renderAt,
  sampleSuppliers,
  setUpApp,
  signedIn,
  tearDownApp,
} from '@/testing/app-harness';

// Oberflächentests zu docs/specs/PLT-12.md. Seit PLT-11 eine eigene Seite /fragen statt Fenster.

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

const pages = ['/start', '/lieferanten', '/portfolio', '/wirkung', '/profil', '/gibt-es-nicht'];

const questionsPage = () => screen.findByRole('heading', { level: 1, name: 'Frag Reziproq' });
const field = () => screen.getByRole('textbox', { name: 'Deine Frage an Reziproq' });

async function openWithShortcut(path = '/start') {
  const router = renderAt(path);
  await screen.findByRole('heading', { level: 1 });
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  await questionsPage();
  return router;
}

async function askQuestion(question: string) {
  fireEvent.change(field(), { target: { value: question } });
  fireEvent.click(screen.getByRole('button', { name: 'Fragen' }));
}

describe('Öffnen', () => {
  it.each(pages)('Ctrl+K öffnet /fragen von %s, der Fokus liegt im Feld', async (path) => {
    const router = await openWithShortcut(path);
    expect(router.state.location.pathname).toBe('/fragen');
    expect(document.activeElement).toBe(field());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Cmd+K öffnet die Seite ebenso', async () => {
    renderAt('/lieferanten');
    await screen.findByRole('heading', { level: 1 });
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(await questionsPage()).toBeDefined();
  });

  it('fragt mit dem Feld auf Start und übergibt die Frage über die URL', async () => {
    api.prompt.events = [{ type: 'text', delta: 'Antwort auf Start.' }, { type: 'done' }];
    const router = renderAt('/start');
    fireEvent.change(await screen.findByRole('textbox', { name: 'Deine Frage an Reziproq' }), {
      target: { value: 'Wie geht es meinen Lieferanten?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Fragen' }));
    await questionsPage();
    await screen.findByText('Antwort auf Start.');
    expect(router.state.location.search).toEqual({ q: 'Wie geht es meinen Lieferanten?' });
    expect(api.promptRequests[0]).toEqual({
      messages: [{ role: 'user', content: 'Wie geht es meinen Lieferanten?' }],
    });
  });
});

describe('Leere Seite', () => {
  it('zeigt die drei Vorschläge und den Hinweis zu den Daten', async () => {
    await openWithShortcut();
    const suggestions = within(screen.getByRole('region', { name: 'Vorschläge' })).getAllByRole(
      'button',
    );
    expect(suggestions.map((button) => button.textContent)).toEqual([
      'Zeig mir die Lieferanten mit dem höchsten Spend',
      'Welche Lieferanten haben wir in der Warengruppe Elektronik?',
      'Öffne den Spend von Beispiel AG (Demo)',
    ]);
    expect(
      screen.getByText('Antworten beruhen nur auf Daten, die du sehen darfst. Bitte prüfen.'),
    ).toBeDefined();
  });

  it('ein Klick auf einen Vorschlag übernimmt den Text, ohne schon zu fragen', async () => {
    await openWithShortcut();
    fireEvent.click(screen.getByRole('button', { name: 'Öffne den Spend von Beispiel AG (Demo)' }));
    expect(field()).toHaveProperty('value', 'Öffne den Spend von Beispiel AG (Demo)');
    expect(document.activeElement).toBe(field());
    expect(api.promptRequests).toEqual([]);
  });
});

describe('Antworten', () => {
  it('zeigt für das Portfolio einen Link, den der Nutzer bewusst öffnet', async () => {
    api.prompt.events = [
      { type: 'text', delta: 'Hier ist der Link zu Portfolio.' },
      { type: 'navigate', destination: { type: 'area', path: '/portfolio' } },
      { type: 'done' },
    ];
    const router = await openWithShortcut();
    await askQuestion('Öffne das Portfolio');
    const open = await screen.findByRole('link', { name: 'Bereich öffnen' });
    expect(router.state.location.pathname).toBe('/fragen');
    fireEvent.click(open);
    await waitFor(() => expect(router.state.location.pathname).toBe('/portfolio'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Matrix' })).toBeDefined();
  });

  it('verlinkt zum Spend der exakt gefundenen Lieferantenbeziehung', async () => {
    const relationshipId = '00000000-0000-4000-8000-000000000001';
    api.prompt.events = [
      {
        type: 'navigate',
        destination: { type: 'supplierSpend', relationshipId },
      },
      { type: 'done' },
    ];
    await openWithShortcut();
    await askQuestion('Öffne den Spend von Pearl River Components');
    const open = await screen.findByRole('link', { name: 'Spend öffnen' });
    expect(open.getAttribute('href')).toMatch(
      new RegExp(`/lieferanten/${relationshipId}/strategie/spend/?$`),
    );
  });

  it('zeigt die Antwort Stück für Stück und die Treffer als Karten', async () => {
    api.prompt.events = [
      { type: 'text', delta: 'Ich habe 3 Lieferanten ' },
      { type: 'text', delta: 'gefunden.' },
      { type: 'suppliers', suppliers: sampleSuppliers.suppliers },
      { type: 'done' },
    ];
    await openWithShortcut();
    await askQuestion('Zeig mir die Lieferanten mit dem höchsten Spend');
    expect(await screen.findByText('Ich habe 3 Lieferanten gefunden.')).toBeDefined();
    const hits = screen.getByRole('list', { name: 'Treffer' });
    expect(
      within(hits)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(sampleSuppliers.suppliers.map((supplier) => supplier.name));
  });

  it('zeigt „Keine Treffer“, wenn die Suche nichts findet', async () => {
    api.prompt.events = [
      { type: 'suppliers', suppliers: [] },
      { type: 'text', delta: 'Keine Treffer.' },
      { type: 'done' },
    ];
    await openWithShortcut();
    await askQuestion('Welche Lieferanten haben wir in Island?');
    expect(await screen.findByText('Keine Treffer')).toBeDefined();
    expect(screen.queryByRole('list', { name: 'Treffer' })).toBeNull();
  });

  it('zeigt einen ruhigen Ladezustand, solange die Antwort aussteht', async () => {
    api.prompt.hold = true;
    await openWithShortcut();
    await askQuestion('Zeig mir die Lieferanten mit dem höchsten Spend');
    expect((await screen.findByRole('status')).textContent).toBe('Reziproq antwortet …');
    expect(screen.getByRole('button', { name: 'Fragen' })).toHaveProperty('disabled', true);
  });

  it('zeigt den Fehlerzustand, wenn keine Antwort möglich ist', async () => {
    api.prompt.events = [{ type: 'error', message: 'x' }];
    await openWithShortcut();
    await askQuestion('Hallo');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Gerade keine Antwort möglich. Versuch es gleich noch einmal.',
    );
  });

  it('meldet freundlich, wenn zu viele Fragen gestellt wurden', async () => {
    api.prompt.status = 429;
    await openWithShortcut();
    await askQuestion('Hallo');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Du hast gerade sehr viele Fragen gestellt. Warte eine Minute.',
    );
  });
});

describe('Verlauf', () => {
  it('schickt bei weiteren Fragen den bisherigen Verlauf mit', async () => {
    api.prompt.events = [{ type: 'text', delta: 'Erste Antwort.' }, { type: 'done' }];
    await openWithShortcut();
    await askQuestion('Erste Frage');
    await screen.findByText('Erste Antwort.');
    await askQuestion('Zweite Frage');
    await waitFor(() => expect(api.promptRequests).toHaveLength(2));
    expect(api.promptRequests[1]).toEqual({
      messages: [
        { role: 'user', content: 'Erste Frage' },
        { role: 'assistant', content: 'Erste Antwort.' },
        { role: 'user', content: 'Zweite Frage' },
      ],
    });
  });

  it('schickt auch nach vielen Fragen nie mehr Nachrichten, als die API annimmt', async () => {
    api.prompt.events = [{ type: 'text', delta: 'Antwort.' }, { type: 'done' }];
    await openWithShortcut();
    for (let question = 1; question <= 12; question++) {
      await askQuestion(`Frage ${question}`);
      await waitFor(() => expect(api.promptRequests).toHaveLength(question));
      // Erst wenn die Antwort fertig ist, zählt sie zum Verlauf.
      await waitFor(() => expect(screen.getAllByText('Antwort.')).toHaveLength(question));
    }
    const last = promptRequestSchema.parse(api.promptRequests.at(-1));
    // Ohne Begrenzung wären es 23 Nachrichten (11 Paare und die neue Frage).
    expect(last.messages).toHaveLength(promptLimits.messages - 1);
    expect(last.messages.at(-1)).toEqual({ role: 'user', content: 'Frage 12' });
    expect(last.messages[0]?.role).toBe('user');
  });

  it('„Neu beginnen“ leert den Verlauf', async () => {
    api.prompt.events = [{ type: 'text', delta: 'Erste Antwort.' }, { type: 'done' }];
    await openWithShortcut();
    await askQuestion('Erste Frage');
    await screen.findByText('Erste Antwort.');
    fireEvent.click(screen.getByRole('button', { name: 'Neu beginnen' }));
    expect(screen.queryByText('Erste Antwort.')).toBeNull();
    expect(screen.getByRole('region', { name: 'Vorschläge' })).toBeDefined();
  });

  it('beginnt nach dem Verlassen der Seite wieder leer', async () => {
    api.prompt.events = [{ type: 'text', delta: 'Erste Antwort.' }, { type: 'done' }];
    const router = await openWithShortcut();
    await askQuestion('Erste Frage');
    await screen.findByText('Erste Antwort.');
    await router.navigate({ to: '/start' });
    await screen.findByRole('heading', { level: 1, name: /Guten/ });
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    await questionsPage();
    expect(screen.queryByText('Erste Antwort.')).toBeNull();
  });
});
