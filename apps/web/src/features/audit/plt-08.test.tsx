// @vitest-environment jsdom
import type { AuditResponse } from '@reziproq/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '@/lib/i18n';
import { AuditHistory } from './audit-history';

// Tests zu docs/specs/PLT-08.md für den Verlauf in der Oberfläche.

vi.mock('react-oidc-context', () => ({
  useAuth: () => ({ user: { access_token: 'token-1' } }),
}));

let reply: () => Response;
const requests: string[] = [];

beforeEach(() => {
  requests.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input));
      return reply();
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderHistory() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <LocaleProvider>
      <QueryClientProvider client={queryClient}>
        <AuditHistory objectType="relationship" objectId="rel-1" />
      </QueryClientProvider>
    </LocaleProvider>,
  );
}

const response: AuditResponse = {
  entries: [
    {
      id: 'e2',
      occurredAt: '2026-11-12T13:05:00Z',
      actorName: 'Lena Berger',
      organization: 'Test-OEM (Demo)',
      action: 'updated',
      changes: { status: { from: 'draft', to: 'active' } },
    },
    {
      id: 'e1',
      occurredAt: '2026-11-10T08:30:00Z',
      actorName: 'Lena Berger',
      organization: 'Test-OEM (Demo)',
      action: 'created',
      changes: {},
    },
  ],
};

describe('Verlauf eines Objekts', () => {
  it('fragt den Verlauf des Objekts an und zeigt Datum, Änderung, Person und Organisation', async () => {
    reply = () => Response.json(response);
    renderHistory();
    const items = within(await screen.findByRole('list')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      '12.11.2026, 14:05Status: Entwurf → aktivLena Berger · Test-OEM (Demo)',
      '10.11.2026, 09:30AngelegtLena Berger · Test-OEM (Demo)',
    ]);
    expect(requests).toEqual(['/api/audit?object_type=relationship&object_id=rel-1']);
  });

  it('zeigt den leeren Zustand', async () => {
    reply = () => Response.json({ entries: [] });
    renderHistory();
    expect(await screen.findByText('Noch keine Änderungen')).toBeDefined();
  });

  it('zeigt den Ladezustand, solange die Antwort aussteht', async () => {
    reply = () => new Promise<Response>(() => {}) as unknown as Response;
    renderHistory();
    expect((await screen.findByRole('status')).textContent).toContain('Verlauf wird geladen …');
  });

  // Die App versucht es zweimal erneut, dann erscheint der Fehler statt „lädt …“.
  it('zeigt den Fehlerzustand', async () => {
    reply = () => Response.json({ statusCode: 500 }, { status: 500 });
    renderHistory();
    expect(
      await screen.findByText('Der Verlauf konnte nicht geladen werden.', {}, { timeout: 6000 }),
    ).toBeDefined();
  }, 10_000);
});
