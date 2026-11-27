// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { akteCounterpartSample } from '@/testing/akte-counterpart-sample';
import { aktePrivateSample } from '@/testing/akte-private-sample';
import {
  api,
  renderAt,
  sampleAkteHead,
  sampleAkteShared,
  setUpApp,
  signedIn,
  tearDownApp,
} from '@/testing/app-harness';

// AK-01 (K2-c.2): Akte, Kopf und Sicht Gemeinsam nach der Vorlage L-Ueberblick. T2-04: ohne Parameter
// Gemeinsam, ?sicht=privat und ?sicht=geteilt die anderen Sichten; der Umschalter setzt die Adresse.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
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
  api.aktePrivate = aktePrivateSample();
  api.akteCounterpart = akteCounterpartSample();
});
afterEach(tearDownApp);

const id = sampleAkteHead.relationshipId;
const akte = `/beziehungen/${id}`;
/** Text ohne geschützte Leerzeichen, die Intl zwischen Betrag und Währung setzt */
const plain = (value: string | null | undefined) => (value ?? '').replace(/[  ]/g, ' ');
const group = (name: RegExp) => screen.getByRole('region', { name }) as HTMLElement;

describe('AK-01 Akte, Kopf und Sichten', () => {
  it('Kopf: Name, graue Zeile, Aktionen von Reziproq und „···“ für Profil', async () => {
    renderAt(akte);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Rheintal Elektronik' }),
    ).toBeTruthy();
    const head = document.querySelector('[data-slot="akte-head"]') as HTMLElement;
    expect(plain(head.textContent)).toContain(
      'Strategisch · Leiterplatten, Baugruppen, Kabelsätze · 4,2 Mio. € Spend 2026 · Lead Sara Ost',
    );
    const actions = within(head).getByRole('navigation', { name: 'Aktionen von Reziproq' });
    expect(within(actions).getByRole('link', { name: 'Wert finden' }).getAttribute('href')).toBe(
      `/lieferanten/${id}/wirkung/wertpotenziale`,
    );
    expect(within(actions).getByRole('link', { name: 'Briefing JBP' }).getAttribute('href')).toBe(
      `/lieferanten/${id}/umsetzung/termine/00000000-0000-7000-8000-000000000501`,
    );
    expect(
      within(actions).getByRole('link', { name: 'Profil, Team und Mandat' }).getAttribute('href'),
    ).toBe(`/lieferanten/${id}/strategie/profil`);
    expect(document.title).toBe('Rheintal Elektronik – Reziproq');
  });

  it('T2-04: ohne Parameter Gemeinsam; der Umschalter setzt die Adresse für die anderen Sichten', async () => {
    const router = renderAt(akte);
    const views = await screen.findByRole('navigation', { name: 'Sicht auf die Beziehung' });
    const link = (name: RegExp) => within(views).getByRole('link', { name });
    expect(link(/Gemeinsam/).getAttribute('aria-current')).toBe('page');
    expect(link(/Nur für dich/).getAttribute('href')).toBe(`${akte}?sicht=privat`);
    expect(link(/Von Rheintal Elektronik/).getAttribute('href')).toBe(`${akte}?sicht=geteilt`);
    fireEvent.click(link(/Nur für dich/));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ sicht: 'privat' }));
    expect(link(/Nur für dich/).getAttribute('aria-current')).toBe('page');
    // K2-c.3: Nur für dich mit Verlauf, Beziehungsnetz und rechter Spalte (ak-01-privat.test.tsx)
    expect(await screen.findByRole('region', { name: 'Verlauf · nur euer Team' })).toBeTruthy();
    const note = await screen.findByRole('region', { name: 'Das Wichtigste' });
    expect(note.getAttribute('data-slot')).toBe('private-note');
    expect(note.textContent).toContain('Nur für dich und euer Teamprivat');
    fireEvent.click(link(/Von Rheintal Elektronik/));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ sicht: 'geteilt' }));
    // K2-c.4: Von <Gegenüber> mit dem Geteilten des Gegenübers (ak-01-geteilt.test.tsx)
    const shared = await screen.findByRole('region', { name: /Von Rheintal Elektronik geteilt/ });
    expect(shared.querySelector('[data-tone="counterpart"]')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Verlauf · nur euer Team' })).toBeNull();
    fireEvent.click(link(/Gemeinsam/));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(await screen.findByRole('region', { name: 'Das Wichtigste' })).toBeTruthy();
  });

  it('eine unbekannte Beziehung, ohne Recht und bei Fehler eigene Zustände', {
    timeout: 20_000,
  }, async () => {
    api.akte = { ...api.akte, status: 404, head: { statusCode: 404, code: 'nicht_gefunden' } };
    renderAt(akte);
    expect(await screen.findByText('Diese Beziehung gibt es hier nicht')).toBeTruthy();
    const empty = document.querySelector('[data-slot="empty-state"]') as HTMLElement;
    expect(within(empty).getByRole('link', { name: 'Lieferanten' }).getAttribute('href')).toBe(
      '/beziehungen',
    );
    tearDownApp();
    setUpApp();
    api.akte = { ...api.akte, status: 403, head: { statusCode: 403, code: 'keine_berechtigung' } };
    renderAt(akte);
    expect(await screen.findByText('Dir fehlt eine Rolle')).toBeTruthy();
    tearDownApp();
    setUpApp();
    api.akte = { ...api.akte, status: 500, head: { statusCode: 500 } };
    renderAt(akte);
    expect(
      await screen.findByText('Die Akte konnte nicht geladen werden.', {}, { timeout: 8000 }),
    ).toBeTruthy();
  });
});

describe('AK-01 Sicht Gemeinsam (Vorlage L-Ueberblick)', () => {
  it('Das Wichtigste: Satz aus belegten Zahlen und Spiegel 90 zu 78 %, den beide sehen', async () => {
    renderAt(akte);
    const summary = await screen.findByRole('region', { name: 'Das Wichtigste' });
    expect(summary.textContent).toContain(
      'Ihr haltet mehr Zusagen als Rheintal Elektronik. Überfällig ist „8D-Bericht Charge 4711“.',
    );
    expect(
      within(summary).getByRole('img', {
        name: 'Gehaltene Zusagen 2026: ihr 90 %, Rheintal Elektronik 78 %',
      }),
    ).toBeTruthy();
    expect(summary.textContent).toContain(
      'Gehaltene Zusagen 2026. Rheintal Elektronik sieht dieselben Zahlen.',
    );
  });

  it('Zusagen beider Seiten in der geteilten Gruppe, mit Seite, Person, Frist, Herkunft und Stand', async () => {
    renderAt(akte);
    const commitments = await screen.findByRole('region', { name: /Zusagen · 5 offen/ });
    expect(commitments.querySelector('[data-tone="shared"]')).toBeTruthy();
    const row = (title: string) =>
      within(commitments).getByRole('link', { name: new RegExp(title) });
    expect(plain(row('8D-Bericht').textContent)).toContain(
      'Rheintal Elektronik · Nils Ott · war bis 05.11.',
    );
    expect(row('8D-Bericht').textContent).toContain('überfällig');
    expect(row('8D-Bericht').getAttribute('href')).toBe(
      `/lieferanten/${id}/umsetzung/massnahmen/${sampleAkteShared.commitments[0]?.id}`,
    );
    expect(row('Prognose monatlich').textContent).toContain(
      'eure Seite · Ida Roth · monatlich ab 15.12. · aus der Feedback-Lücke',
    );
    expect(row('Musterteile').textContent).toMatch(
      /Rheintal Elektronik · Kim Kaiser · bis (\w+ )?15\.12\. · von euch eingetragen/,
    );
    expect(row('Musterteile').textContent).toContain('Rheintal Elektronik bestätigt noch');
    expect(row('Abnahmeplan').textContent).toContain('aus dem JBP 2026');
    expect(commitments.textContent).toContain(
      '16 gehaltene Zusagen 2026zuletzt: Abrufmengen 6 Monate im Voraus, eure Seite',
    );
  });

  it('Scorecard mit Stand je Kennzahl als Text und der fehlenden eigenen Unterschrift', async () => {
    renderAt(akte);
    const card = await screen.findByRole('region', { name: /Scorecard 2026 · Kennzahlen Oktober/ });
    const row = (name: string) => within(card).getByRole('link', { name: new RegExp(name) });
    expect(plain(row('Liefertreue').textContent)).toContain(
      'Rheintal Elektronik · 94 %, Ziel 97 %knapp',
    );
    expect(plain(row('Prognosetreue').textContent)).toContain(
      'eure Seite · 72 %, Ziel 85 %hinter Plan',
    );
    expect(plain(row('Durchlaufzeit').textContent)).toContain(
      'Rheintal Elektronik · Ziel 14 Tagenoch kein Wert',
    );
    expect(card.textContent).toContain('Rheintal Elektronik hat unterschrieben, eure fehlt');
    expect(within(card).getByRole('link', { name: 'Unterschreiben' }).getAttribute('href')).toBe(
      `/lieferanten/${id}/plan/scorecard/unterschreiben`,
    );
  });

  it('rechts: Nächste Wochen, Plan und Spielregeln, Feedback, Team beider Seiten und die Fußnote', async () => {
    renderAt(akte);
    const weeks = await screen.findByRole('region', { name: 'Nächste Wochen' });
    expect(
      within(weeks)
        .getByRole('link', { name: /JBP Rheintal 2027/ })
        .getAttribute('href'),
    ).toBe(`/lieferanten/${id}/umsetzung/termine/00000000-0000-7000-8000-000000000501`);
    expect(weeks.textContent).toContain('Zusage Rheintal Elektronik · offen');
    const plan = group(/Plan und Spielregeln/);
    expect(plan.textContent).toContain('Gemeinsamer Plan 2026');
    expect(plan.textContent).toContain('freigegeben');
    expect(plan.textContent).toContain('Spielregeln „Strategisch“');
    expect(plan.textContent).toContain('Änderungen noch nicht geteilt');
    const feedback = group(/^Feedback$/);
    expect(feedback.textContent).toContain('ihr 4 von 5, Rheintal Elektronik 1 von 5');
    const team = group(/Team beider Seiten/);
    expect(team.textContent).toContain('2 bei euch, 1 bei Rheintal Elektronik');
    expect(team.textContent).toContain('Jan-Luka, Ida Roth · Kim Kaiser');
    expect(
      screen.getByText(
        'Was hier steht, sieht Rheintal Elektronik genauso. Die eigenen Notizen von Rheintal Elektronik siehst du nie, und Rheintal Elektronik deine nicht.',
      ),
    ).toBeTruthy();
  });
});
