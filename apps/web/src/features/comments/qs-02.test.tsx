// @vitest-environment jsdom
import type { CommentList } from '@reziproq/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '@/lib/i18n';
import { api, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';
import { CommentsSection, mentionQuery } from './comments-section';

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));

// Tests zu docs/specs/QS-02.md für die Oberfläche: Abschnitt unter dem Objekt, Schalter Intern
// oder Geteilt, Erwähnungsliste fest im Seitenfluss mit nur erlaubten Personen, „Kommentar
// entfernt“.

const rel = '550e8400-e29b-41d4-a716-446655440001';
const actionId = '550e8400-e29b-41d4-a716-446655440002';
const url = `/api/suppliers/${rel}/kommentare/action/${actionId}`;

const list = (overrides: Partial<CommentList> = {}): CommentList => ({
  comments: [
    {
      id: '550e8400-e29b-41d4-a716-446655440010',
      side: 'buyer',
      visibility: 'internal',
      authorName: 'Sara Ost',
      own: true,
      body: 'Zweitquelle offen halten',
      mentions: [],
      createdAt: '2026-11-15T09:00:00Z',
      editedAt: null,
      deletedAt: null,
      canEdit: true,
      canDelete: true,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440011',
      side: 'supplier',
      visibility: 'shared',
      authorName: 'Kim Kaiser',
      own: false,
      body: null,
      mentions: [],
      createdAt: '2026-11-15T10:00:00Z',
      editedAt: null,
      deletedAt: '2026-11-15T11:00:00Z',
      canEdit: false,
      canDelete: false,
    },
  ],
  canComment: true,
  objectVisibility: 'shared',
  people: {
    internal: [{ userId: 'kai', name: 'Kai Kollege', side: 'buyer' }],
    shared: [
      { userId: 'kai', name: 'Kai Kollege', side: 'buyer' },
      { userId: 'kim', name: 'Kim Kaiser', side: 'supplier' },
    ],
  },
  ...overrides,
});

let posted: unknown[] = [];

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <LocaleProvider>
      <QueryClientProvider client={queryClient}>
        <CommentsSection
          place={{ side: 'buyer', relationshipId: rel }}
          objectType="action"
          objectId={actionId}
        />
      </QueryClientProvider>
    </LocaleProvider>,
  );
}

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  posted = [];
  api.handle = (request) => {
    if (request.url !== url) return undefined;
    if (request.method === 'POST') {
      posted.push(request.body);
      return Response.json(list(), { status: 201 });
    }
    return Response.json(list());
  };
});

afterEach(tearDownApp);

describe('QS-02 Kommentare', () => {
  it('zeigt Kommentare, neueste unten, mit Kennzeichen „Intern“ und „Kommentar entfernt“', async () => {
    renderSection();
    const items = within(await screen.findByRole('list', { name: 'Kommentare' })).getAllByRole(
      'listitem',
    );
    expect(items).toHaveLength(2);
    expect(within(items[0] as HTMLElement).getByText('Intern')).toBeTruthy();
    expect(within(items[0] as HTMLElement).getByText('Zweitquelle offen halten')).toBeTruthy();
    expect(within(items[1] as HTMLElement).getByText('Kommentar entfernt')).toBeTruthy();
    expect(within(items[1] as HTMLElement).queryByRole('button')).toBeNull();
    expect(
      within(items[0] as HTMLElement).getByRole('button', { name: 'Bearbeiten' }),
    ).toBeTruthy();
  });

  it('nach „@“ steht die Liste fest unter dem Feld; intern nur die eigene Seite', async () => {
    renderSection();
    const field = await screen.findByRole('textbox', { name: 'Kommentar' });
    // Standard ist Geteilt.
    expect((screen.getByRole('radio', { name: 'Geteilt' }) as HTMLInputElement).checked).toBe(true);
    fireEvent.change(field, { target: { value: 'Bitte @K' } });
    const mentions = screen.getByRole('region', { name: 'Erwähnen' });
    // Im Seitenfluss, kein Fenster: kein Dialog, keine feste Position.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mentions.className).not.toMatch(/\b(fixed|absolute)\b/);
    expect(
      within(mentions)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Kai Kollege · Käufer', 'Kim Kaiser · Lieferant']);

    fireEvent.click(screen.getByRole('radio', { name: 'Intern' }));
    expect(
      within(screen.getByRole('region', { name: 'Erwähnen' }))
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Kai Kollege · Käufer']);

    fireEvent.click(screen.getByRole('button', { name: /Kai Kollege/ }));
    expect((field as HTMLTextAreaElement).value).toBe('Bitte @Kai Kollege ');
    fireEvent.click(screen.getByRole('button', { name: 'Senden' }));
    await waitFor(() =>
      expect(posted).toEqual([
        { visibility: 'internal', body: 'Bitte @Kai Kollege', mentions: ['kai'] },
      ]),
    );
  });

  it('an internen Objekten gibt es keinen Schalter, Kommentare bleiben intern', async () => {
    api.handle = (request) =>
      request.url === url ? Response.json(list({ objectVisibility: 'internal' })) : undefined;
    renderSection();
    expect(
      await screen.findByText('Das Objekt ist intern, darum sind auch seine Kommentare intern.'),
    ).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Geteilt' })).toBeNull();
  });

  it('erkennt den Suchtext nach „@“', () => {
    expect(mentionQuery('Hallo @Ki')).toBe('Ki');
    expect(mentionQuery('@')).toBe('');
    expect(mentionQuery('Hallo @Kim Kaiser ')).toBeNull();
    expect(mentionQuery('mail@example')).toBeNull();
  });
});
