// @vitest-environment jsdom
import type { DemoSession } from '@reziproq/shared';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useAuth } from 'react-oidc-context';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { businessTimeKey } from '@/lib/clock';
import { readDemoSession, saveDemoSession } from '@/lib/demo-session';
import { DemoAuthProvider } from './demo-auth';

// DM-01, E-K0-05 (K1-b.2): Der Demo-Provider liefert denselben Kontext wie Zitadel. Jede Seite liest
// mit useAuth() das Token der Demo-Sitzung; Abmelden beendet sie in diesem Tab. Läuft isoliert
// (vitest.config.ts), weil andere Tests react-oidc-context ersetzen.

const session: DemoSession = {
  accessToken: 'demo-token',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  person: {
    id: 'sara-ost',
    name: 'Sara Ost',
    orgId: '550e8400-e29b-41d4-a716-446655440001',
    orgName: 'Hollmann Antriebe',
    orgRole: 'member',
    buyer: true,
  },
};

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <p>{`${auth.isAuthenticated} ${auth.isLoading} ${auth.user?.access_token}`}</p>
      <p>{`${auth.user?.profile.sub} ${auth.user?.profile.name} ${auth.user?.expired}`}</p>
      <button type="button" onClick={() => void auth.signoutRedirect()}>
        Abmelden
      </button>
    </div>
  );
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('DM-01 Demo-Provider', () => {
  it('liefert Token und Person der Demo-Sitzung über useAuth()', () => {
    render(
      <DemoAuthProvider session={session}>
        <Probe />
      </DemoAuthProvider>,
    );
    expect(screen.getByText('true false demo-token')).toBeTruthy();
    expect(screen.getByText('sara-ost Sara Ost false')).toBeTruthy();
  });

  it('Abmelden beendet die Sitzung in diesem Tab und mit ihr die Fachzeit der Demo-Uhr', () => {
    saveDemoSession(session);
    window.sessionStorage.setItem(businessTimeKey, String(-2 * 86_400_000));
    render(
      <DemoAuthProvider session={session}>
        <Probe />
      </DemoAuthProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }));
    expect(readDemoSession()).toBeNull();
    expect(window.sessionStorage.getItem(businessTimeKey)).toBeNull();
  });

  it('startet kurz vor dem Ablauf als dieselbe Person neu und kehrt auf die Seite zurück', () => {
    vi.useFakeTimers({
      now: new Date('2026-11-27T08:00:00.000Z'),
      toFake: ['Date', 'setInterval', 'clearInterval'],
    });
    window.history.replaceState(null, '', '/beziehungen?linse=segmente');
    const leave = vi.fn();
    render(
      <DemoAuthProvider
        session={{ ...session, expiresAt: '2026-11-27T08:06:30.000Z' }}
        leave={leave}
      >
        <Probe />
      </DemoAuthProvider>,
    );
    // Noch mehr als fünf Minuten: nichts
    act(() => vi.advanceTimersByTime(60_000));
    expect(leave).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(60_000));
    expect(leave).toHaveBeenCalledWith(
      '/demo/als/sara-ost?zurueck=%2Fbeziehungen%3Flinse%3Dsegmente',
    );
  });

  it('prüft auch, wenn der Tab wieder sichtbar wird (nach dem Ruhezustand)', () => {
    const leave = vi.fn();
    render(
      <DemoAuthProvider
        session={{ ...session, expiresAt: new Date(Date.now() - 1000).toISOString() }}
        leave={leave}
      >
        <Probe />
      </DemoAuthProvider>,
    );
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(leave).toHaveBeenCalledWith('/demo/als/sara-ost');
  });

  it('Abmelden vergisst die Person, damit kein Neustart folgt', () => {
    saveDemoSession(session);
    expect(window.localStorage.getItem('reziproq.demo-person')).toBe('sara-ost');
    render(
      <DemoAuthProvider session={session}>
        <Probe />
      </DemoAuthProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }));
    expect(window.localStorage.getItem('reziproq.demo-person')).toBeNull();
  });
});
