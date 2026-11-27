// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AkteCounterpartSample,
  akteCounterpartRelationship,
  akteCounterpartSample,
} from '@/testing/akte-counterpart-sample';
import {
  anna,
  api,
  browserLanguages,
  renderAt,
  setUpApp,
  signedIn,
  tearDownApp,
} from '@/testing/app-harness';

// AK-01 (K2-c.4): Sicht Von <Gegenüber> nach der Vorlage K2-Akte-Geteilt. Was Rheintal aktiv geteilt
// hat (E-K0-31), was Rheintal von euch sieht und nie sieht, Pflichten, Rheintal in Reziproq.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

let sample: AkteCounterpartSample;
beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  sample = akteCounterpartSample();
  api.akteCounterpart = sample;
});
afterEach(tearDownApp);

const id = akteCounterpartRelationship;
const geteilt = `/beziehungen/${id}?sicht=geteilt`;
const region = (name: string | RegExp) => screen.findByRole('region', { name });

describe('AK-01 Von Rheintal: Das Wichtigste und das Geteilte', () => {
  it('Das Wichtigste nennt, was sich zählen lässt, und zeigt, was auf euch wartet', async () => {
    renderAt(geteilt);
    const summary = await region('Das Wichtigste');
    expect(summary.textContent).toContain(
      'Rheintal Elektronik hat 2 Kennzahlwerte, 2 Themen fürs JBP, 1 Kommentar, 1 Unterschrift und 1 Lagebericht mit euch geteilt, zuletzt am 20.11. 2 davon warten auf euch. Aus den Spielregeln „Strategisch“ hat Rheintal Elektronik 3 Pflichten.',
    );
    expect(summary.textContent).toContain('OffenThema fürs JBP „Kapazität 2028“ ist noch offen');
    expect(summary.textContent).toContain(
      'WartetLiefertreue Oktober: 94 % · eure Bestätigung fehlt',
    );
  });

  it('Von Rheintal geteilt: weiß mit Petrol-Kante, neueste zuerst, mit Person, Datum, Auszug und Stand', async () => {
    renderAt(geteilt);
    const shared = await region(/Von Rheintal Elektronik geteilt · 7/);
    expect(shared.querySelector('[data-tone="counterpart"]')).toBeTruthy();
    const titles = [...shared.querySelectorAll('b')].map((title) => title.textContent);
    expect(titles).toEqual([
      'Thema fürs JBP: Kapazität 2028',
      'Kommentar zu „JBP Rheintal 2027“',
      'Lage fürs JBP 2027',
      'Thema fürs JBP: Prognosen früher teilen',
      'Liefertreue Oktober: 94 %',
      'Reklamationen je Mio. Teile Oktober: 28 ppm',
      'Scorecard 2026 unterschrieben',
    ]);
    const row = (name: RegExp) => within(shared).getByRole('link', { name });
    expect(row(/Kommentar zu/).textContent).toContain(
      'Nils Ott · 18.11. · „@Jan-Luka Können wir die Kapazitätsplanung 2028 im JBP vorziehen? Der 8D-Bericht zur …“',
    );
    expect(row(/Kommentar zu/).getAttribute('href')).toBe(
      `/lieferanten/${id}/umsetzung/termine/00000000-0000-7000-8000-000000000501`,
    );
    expect(row(/Kapazität 2028/).textContent).toContain('vorgeschlagen');
    expect(row(/Prognosen früher teilen/).textContent).toContain('im JBP');
    expect(row(/Liefertreue Oktober/).textContent).toContain('Tom Weber · 05.11.Bestätigung fehlt');
    expect(row(/Liefertreue Oktober/).getAttribute('href')).toBe(
      `/lieferanten/${id}/plan/scorecard/00000000-0000-7000-8000-000000001703`,
    );
    expect(row(/Lage fürs JBP/).textContent).toContain('15.11. · SMT-Linie 2 ab Februar');
    expect(
      screen.getByText(
        'Hier steht nur, was Rheintal Elektronik aktiv mit euch geteilt hat. Die eigene Seite von Rheintal Elektronik bleibt bei Rheintal Elektronik.',
      ),
    ).toBeTruthy();
  });

  it('ohne Geteiltes und ohne Spielregeln eigene Zeilen; ein Fehler bleibt in seinem Abschnitt', async () => {
    sample.view.items = [];
    sample.view.obligations = null;
    sample.status.team = 500;
    renderAt(geteilt);
    expect((await region('Das Wichtigste')).textContent).toContain(
      'Rheintal Elektronik hat noch nichts mit euch geteilt.',
    );
    expect(
      within(await region(/Von Rheintal Elektronik geteilt · 0/)).getByText('Noch nichts geteilt'),
    ).toBeTruthy();
    expect(
      within(await region('Pflichten von Rheintal Elektronik'))
        .getByRole('link', { name: /Noch keine geteilten Spielregeln/ })
        .getAttribute('href'),
    ).toBe(`/lieferanten/${id}/beziehung/spielregeln`);
    expect(
      await within(await region('Rheintal Elektronik in Reziproq')).findByText(
        'Konnte nicht geladen werden.',
        {},
        { timeout: 8000 },
      ),
    ).toBeTruthy();
  });
});

describe('AK-01 Von Rheintal: rechte Spalte', () => {
  it('was Rheintal von euch sieht führt zu Gemeinsam; was Rheintal nie sieht, privat gekennzeichnet', async () => {
    renderAt(geteilt);
    const sees = await region('Was Rheintal Elektronik von euch sieht');
    expect(sees.querySelector('[data-tone="shared"]')).toBeTruthy();
    expect(
      within(sees)
        .getByRole('link', { name: /Alles unter Gemeinsam/ })
        .getAttribute('href'),
    ).toBe(`/beziehungen/${id}`);
    const never = await region('Was Rheintal Elektronik nie sieht');
    expect(never.getAttribute('data-slot')).toBe('private-note');
    expect(
      within(never)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Beziehungsnetz',
      'Bewertung und Segment',
      'Wertpotenziale und Rechenwege',
      'Lieferantenplan',
      'eure Notizen, Mails und Transkripte',
    ]);
    expect(never.textContent).toContain('nie');
  });

  it('Pflichten der geteilten Spielregeln mit Takt und Version', async () => {
    renderAt(geteilt);
    const duties = await region('Pflichten von Rheintal Elektronik');
    await within(duties).findByText('Kapazität jedes Quartal melden');
    expect(duties.textContent).toContain('Kapazität jedes Quartal meldenquartalsweise');
    expect(duties.textContent).toContain('Liefertreue monatlich meldenmonatlich');
    expect(duties.textContent).toContain('Änderungen am Prozess vorher ankündigenlaufend');
    const rules = within(duties).getByRole('link', { name: /Spielregeln „Strategisch“/ });
    expect(rules.textContent).toContain('Version 2, geteilt am 15.10.2026');
  });

  it('Rheintal in Reziproq: Mitglieder aktiv, Einladungen mit Ablauf, Ansprechpartner ohne Einladung', async () => {
    renderAt(geteilt);
    const people = await region('Rheintal Elektronik in Reziproq');
    await within(people).findByText('Kim Kaiser');
    expect(people.textContent).toContain('Kim KaiserSponsoraktiv');
    expect(
      within(people).getByRole('link', { name: /lea-brandt@rheintal.example/ }).textContent,
    ).toContain('Einladung läuft am 24.11.2026 abeingeladen');
    expect(
      within(people).getByRole('link', { name: /mia-kuhn@rheintal.example/ }).textContent,
    ).toContain('Einladung am 03.11.2026 abgelaufenabgelaufen');
    // Angenommene Einladungen stehen als Mitglied da, nicht noch einmal
    expect(within(people).queryByText('kim-kaiser@rheintal.example')).toBeNull();
    const missing = within(people).getByRole('link', { name: /Nils Ott, Tom Weber/ });
    expect(missing.textContent).toContain('noch nicht eingeladen · im Team einladen');
    expect(missing.getAttribute('href')).toBe(`/lieferanten/${id}/beziehung/team`);
  });
});

describe('AK-01 Von Rheintal auf Englisch', () => {
  it('alle Texte der Sicht kommen aus dem englischen Katalog', async () => {
    browserLanguages(['en-GB', 'en']);
    api.me = { ...anna, locale: 'en' };
    renderAt(geteilt);
    const summary = await screen.findByRole('region', { name: 'Key points' });
    await waitFor(() =>
      expect(summary.textContent).toContain(
        'Rheintal Elektronik shared 2 KPI values, 2 topics for the JBP, 1 comment, 1 signature and 1 business update with you, most recently on 20/11.',
      ),
    );
    expect(await region(/Shared by Rheintal Elektronik · 7/)).toBeTruthy();
    expect(await region('What Rheintal Elektronik never sees')).toBeTruthy();
    expect(await region('Rheintal Elektronik in Reziproq')).toBeTruthy();
  });
});
