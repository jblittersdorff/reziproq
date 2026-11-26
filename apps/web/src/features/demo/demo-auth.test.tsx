// @vitest-environment jsdom
import type { DemoSession } from '@reziproq/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
});
