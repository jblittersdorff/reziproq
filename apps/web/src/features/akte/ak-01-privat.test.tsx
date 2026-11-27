// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AktePrivateSample,
  aktePrivateRelationship,
  aktePrivateSample,
} from '@/testing/akte-private-sample';
import {
  anna,
  api,
  browserLanguages,
  renderAt,
  setUpApp,
  signedIn,
  tearDownApp,
} from '@/testing/app-harness';

// AK-01 (K2-c.3): Sicht Nur für dich nach der Vorlage K2-Akte-Privat. Die Sicht liest die
// bestehenden Endpunkte (Segmentierung, Lieferantenplan, Warengruppen, Wert, Kontaktpunkte, Verlauf,
// Aufgaben); jeder Abschnitt hat eigene Lade- und Fehlerzustände.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

let sample: AktePrivateSample;
beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  sample = aktePrivateSample();
  api.aktePrivate = sample;
});
afterEach(tearDownApp);

const id = aktePrivateRelationship;
const privat = `/beziehungen/${id}?sicht=privat`;
/** Text ohne geschützte Leerzeichen, die Intl zwischen Betrag und Währung setzt */
const plain = (value: string | null | undefined) => (value ?? '').replace(/[  ]/g, ' ');
const region = (name: string | RegExp) => screen.findByRole('region', { name });

describe('AK-01 Nur für dich: Das Wichtigste und Aufgaben', () => {
  it('Das Wichtigste ist privat gekennzeichnet: Segment knapp über der Grenze, Kontakte ohne Gesprächspaar', async () => {
    renderAt(privat);
    const note = await region('Das Wichtigste');
    expect(note.getAttribute('data-slot')).toBe('private-note');
    expect(note.textContent).toContain('Nur für dich und euer Teamprivat');
    await waitFor(() =>
      expect(note.textContent).toContain(
        'Rheintal Elektronik steht im Segment „Strategisch“, aber knapp: 4 Punkte über der Grenze. Mit Kim Kaiser und Nils Ott spricht bei euch noch niemand direkt.',
      ),
    );
  });

  it('Lücken der Spielregeln wiegen schwerer; ohne Gesprächspaare sagt der Satz das', async () => {
    sample.touchpoints.gaps = [{ title: { de: 'QBR', en: 'QBR' }, level: null }];
    renderAt(privat);
    await waitFor(async () =>
      expect((await region('Das Wichtigste')).textContent).toContain(
        'Zu einem vereinbarten Format fehlt noch ein Gesprächspaar.',
      ),
    );
    tearDownApp();
    setUpApp();
    sample = aktePrivateSample();
    sample.touchpoints.touchpoints = [];
    api.aktePrivate = sample;
    renderAt(privat);
    await waitFor(async () =>
      expect((await region('Das Wichtigste')).textContent).toContain(
        'Wer bei euch mit wem bei Rheintal Elektronik spricht, ist noch nicht eingetragen.',
      ),
    );
  });

  it('T2-I22: Aufgaben: nur offene interne, nach Frist, überfällige mit Chip; ohne offene keine Gruppe', async () => {
    renderAt(privat);
    const tasks = await region('Aufgaben · nur euer Team');
    const rows = within(tasks).getAllByRole('link');
    expect(rows.map((row) => row.querySelector('b')?.textContent)).toEqual([
      'Kupferklausel prüfen',
      'Angebot Zweitquelle anfragen',
    ]);
    expect(rows[0]?.textContent).toContain('Sara Ost · bis 10.11.2026überfällig');
    expect(rows[1]?.textContent).toContain('offen');
    expect(rows[0]?.getAttribute('href')).toBe(
      `/lieferanten/${id}/umsetzung/massnahmen/${sample.actions.actions[2]?.id}`,
    );
    tearDownApp();
    setUpApp();
    sample = aktePrivateSample();
    sample.actions.actions = sample.actions.actions.filter((action) => action.kind !== 'task');
    api.aktePrivate = sample;
    renderAt(privat);
    await region('Verlauf · nur euer Team');
    expect(screen.queryByRole('region', { name: 'Aufgaben · nur euer Team' })).toBeNull();
  });
});

describe('AK-01 Nur für dich: Verlauf (T2-I19)', () => {
  it('Angeheftetes oben, dann die jüngsten; eigene private Notiz mit „nur du“; Termine öffnen ihr Objekt', async () => {
    renderAt(privat);
    const history = await region('Verlauf · nur euer Team');
    await within(history).findByText('Angeheftet · Jonas Feld');
    const titles = [...history.querySelectorAll('b')].map((title) => title.textContent);
    expect(titles.slice(0, 5)).toEqual([
      'Angeheftet · Jonas Feld',
      'Mail von Tom Weber',
      'Deine Notiz',
      'Zusage des Lieferanten überfällig',
      'Reklamation Charge 4711',
    ]);
    const own = within(history).getByRole('button', { name: /Deine Notiz/ });
    expect(own.textContent).toContain(
      '19.11. · nur du · Gespräch mit Tom Weber, zwei Themen fürs JBP',
    );
    expect(own.getAttribute('aria-expanded')).toBe('false');
    expect(
      within(history).getByRole('button', { name: /Mail von Tom Weber/ }).textContent,
    ).toContain('20.11. · Liefertreue Oktober 94 % · abgelegt von Anna Schmidt');
  });

  it('„Alles anzeigen“ klappt den Rest nach Monaten auf; der Termin führt zu seiner Seite', async () => {
    renderAt(privat);
    const history = await region('Verlauf · nur euer Team');
    const all = await within(history).findByRole('button', { name: /Alles anzeigen/ });
    expect(all.textContent).toContain(
      '7 Einträge seit 24.09.2026 · Mails, Termine, Notizen und was Reziproq getan hat',
    );
    fireEvent.click(all);
    expect(all.getAttribute('aria-expanded')).toBe('true');
    const october = await screen.findByRole('region', { name: 'Oktober 2026' });
    expect(within(october).getByRole('heading', { level: 3 })).toBeTruthy();
    expect(october.textContent).toContain('Ziele fürs Briefing');
    const september = screen.getByRole('region', { name: 'September 2026' });
    expect(
      within(september)
        .getByRole('link', { name: /QBR Q3 mit Rheintal/ })
        .getAttribute('href'),
    ).toBe(`/lieferanten/${id}/umsetzung/termine/${sample.activities.items[4]?.id.slice(8)}`);
    fireEvent.click(within(history).getByRole('button', { name: /Weniger anzeigen/ }));
    expect(screen.queryByRole('region', { name: 'Oktober 2026' })).toBeNull();
  });

  it('Filter „Mails“ fragt die API mit filter=mails; die eigene Mail trägt ihren Betreff', async () => {
    renderAt(privat);
    const history = await region('Verlauf · nur euer Team');
    fireEvent.click(await within(history).findByRole('button', { name: 'Mails' }));
    await waitFor(() =>
      expect(
        api.requests.some((request) => request.url.endsWith('/aktivitaeten?filter=mails')),
      ).toBe(true),
    );
    await waitFor(() => expect(within(history).queryByText('Angeheftet · Jonas Feld')).toBeNull());
    expect(within(history).getByRole('button', { name: /Mail von Tom Weber/ })).toBeTruthy();
    expect(within(history).getByRole('button', { name: /Reklamation Charge 4711/ })).toBeTruthy();
    expect(
      within(history).getByRole('button', { name: 'Mails' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('T2-I19: Neue Notiz „Nur ich“: gespeichert steht sie im Verlauf mit „nur du“', async () => {
    renderAt(privat);
    const history = await region('Verlauf · nur euer Team');
    fireEvent.click(await within(history).findByRole('button', { name: 'Neue Notiz' }));
    const form = within(history).getByRole('form', { name: 'Neue Notiz' });
    fireEvent.change(within(form).getByRole('textbox', { name: 'Notiz' }), {
      target: { value: 'Kim Kaiser vor dem JBP anrufen' },
    });
    fireEvent.click(within(form).getByRole('radio', { name: 'Nur ich' }));
    fireEvent.click(within(form).getByRole('button', { name: 'Notiz speichern' }));
    expect(await within(history).findByText('Gespeichert.')).toBeTruthy();
    const added = await within(history).findByRole('button', {
      name: /Kim Kaiser vor dem JBP anrufen/,
    });
    expect(added.textContent).toContain('Deine Notiz');
    expect(added.textContent).toContain('nur du · Kim Kaiser vor dem JBP anrufen');
    expect(within(history).queryByRole('form', { name: 'Neue Notiz' })).toBeNull();
  });

  it('eigene Notiz aufklappen: ganzer Text, Anheften stellt sie nach oben, Löschen fragt nach', async () => {
    renderAt(privat);
    const history = await region('Verlauf · nur euer Team');
    const own = await within(history).findByRole('button', { name: /Deine Notiz/ });
    fireEvent.click(own);
    expect(own.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(within(history).getByRole('button', { name: 'Anheften' }));
    expect(await within(history).findByText('Angeheftet · Anna Schmidt')).toBeTruthy();
    // Jonas' Notiz ist nicht die eigene: aufgeklappt ohne Anheften und Löschen
    const jonas = within(history).getByRole('button', { name: /Angeheftet · Jonas Feld/ });
    fireEvent.click(jonas);
    const panel = jonas.closest('[data-slot="disclosure-row"]') as HTMLElement;
    expect(
      within(panel).getByText(
        'Linie Kupfer: Basis 10/2026, Anpassung ab 5 % Indexänderung, beide Richtungen',
        { selector: 'p' },
      ),
    ).toBeTruthy();
    expect(within(panel).queryByRole('button', { name: /Anheften|Lösen|Löschen/ })).toBeNull();
    // Die eigene löschen: erst die Rückfrage, dann ist sie fort
    const mine = within(history)
      .getByRole('button', { name: /Angeheftet · Anna Schmidt/ })
      .closest('[data-slot="disclosure-row"]') as HTMLElement;
    fireEvent.click(within(mine).getByRole('button', { name: 'Löschen' }));
    const question = within(mine).getByRole('group', { name: 'Diese Notiz löschen?' });
    fireEvent.click(within(question).getByRole('button', { name: 'Löschen' }));
    await waitFor(() =>
      expect(within(history).queryByText('Angeheftet · Anna Schmidt')).toBeNull(),
    );
    expect(sample.activities.items.some((item) => item.title.startsWith('Gespräch mit Tom'))).toBe(
      false,
    );
  });

  it('Frag-Zeile öffnet Frag Reziproq mit der Beziehung als Kontext', async () => {
    renderAt(privat);
    const history = await region('Verlauf · nur euer Team');
    fireEvent.click(
      within(history).getByRole('button', {
        name: 'Frag Reziproq zu Rheintal Elektronik, zum Beispiel: „Was hat Rheintal Elektronik zuletzt zugesagt?“',
      }),
    );
    const overlay = await screen.findByRole('dialog', { name: 'Frag Reziproq' });
    fireEvent.change(
      await within(overlay).findByRole('textbox', { name: 'Deine Frage an Reziproq' }),
      { target: { value: 'Was ist offen?' } },
    );
    fireEvent.click(within(overlay).getByRole('button', { name: 'Fragen' }));
    await waitFor(() =>
      expect(api.promptRequests.at(-1)).toMatchObject({ context: { relationshipId: id } }),
    );
  });
});

describe('AK-01 Nur für dich: Beziehungsnetz und rechte Spalte', () => {
  it('T2-I26: Beziehungsnetz: Gesprächspaare mit Takt und Notiz, geteilte mit Chip, Fußnote', async () => {
    renderAt(privat);
    const network = await region('Beziehungsnetz');
    const prices = await within(network).findByRole('link', { name: /Preise und Verträge/ });
    expect(prices.textContent).toContain(
      'Sara Ost ↔ Tom Weber · quartalsweise · Entscheidet: Kim Kaiser',
    );
    expect(prices.getAttribute('href')).toBe(
      `/lieferanten/${id}/beziehung/kontaktpunkte/${sample.touchpoints.touchpoints[0]?.id}`,
    );
    expect(within(network).getByRole('link', { name: /Technik/ }).textContent).toContain('geteilt');
    expect(within(network).getByRole('link', { name: /Rohstoffe/ }).textContent).not.toContain(
      'geteilt',
    );
    expect(
      screen.getByText(
        'Gesprächspaare pflegt ihr unter Kontaktpunkte. Als geteilt markierte sieht Rheintal Elektronik auch, die übrigen nur ihr.',
      ),
    ).toBeTruthy();
  });

  it('Beziehungsnetz leer: Zeile zum Eintragen; Lücken der Spielregeln mit Chip „fehlt“', async () => {
    sample.touchpoints.touchpoints = [];
    renderAt(privat);
    const empty = await within(await region('Beziehungsnetz')).findByRole('link', {
      name: /Noch keine Gesprächspaare/,
    });
    expect(empty.getAttribute('href')).toBe(`/lieferanten/${id}/beziehung/kontaktpunkte/neu`);
    tearDownApp();
    setUpApp();
    sample = aktePrivateSample();
    sample.touchpoints.gaps = [
      { title: { de: 'Jour fixe Qualität', en: 'Quality jour fixe' }, level: null },
    ];
    api.aktePrivate = sample;
    renderAt(privat);
    const gap = await within(await region('Beziehungsnetz')).findByRole('link', {
      name: /Jour fixe Qualität/,
    });
    expect(gap.textContent).toContain('in den Spielregeln vereinbart, noch ohne Gesprächspaar');
    expect(gap.textContent).toContain('fehlt');
  });

  it('T2-I13: Segment und Bewertung: Abstand, Runde, Festlegung, Kriterien mit der größten Spanne', async () => {
    renderAt(privat);
    const segment = await region('Segment und Bewertung');
    const head = await within(segment).findByRole('link', {
      name: /Strategisch · 4 Punkte über der Grenze/,
    });
    expect(head.getAttribute('href')).toBe(`/lieferanten/${id}/strategie/segmentierung`);
    expect(head.textContent).toContain(
      'Bewertungsrunde 2027, 4 Bewertungen · festgelegt 12.09.2026',
    );
    expect(head.textContent).toContain('knapp');
    expect(segment.textContent).toContain('Wertbeitrag 82 · Qualität 62 · Innovation 76');
    expect(segment.textContent).toContain('Versorgungsrisiko 72 · Spanne 26 bei Qualität');
  });

  it('T2-I23: Lieferantenplan: Version und Freigabe, Themen fürs JBP nach Rang, Ziele, die intern bleiben', async () => {
    renderAt(privat);
    const plan = await region('Lieferantenplan');
    const head = await within(plan).findByRole('link', { name: /Version 2 · freigegeben/ });
    expect(head.textContent).toContain('Sara Ost, 03.10.2026 · 4 von 4 Beiträgen');
    expect(head.textContent).toContain('gilt');
    expect(plan.textContent).toContain(
      '3 Themen gehen ins JBPKapazität 2028 sichern · Stückpreis −3 % · Reklamationen halbieren',
    );
    expect(plan.textContent).toContain('1 Ziel bleibt internZweitquelle prüfen');
  });

  it('ohne Lieferantenplan eine Zeile dazu; ein Fehler bleibt in seinem Abschnitt', async () => {
    sample.plan.plan = null;
    sample.status.categories = 500;
    renderAt(privat);
    expect(
      await within(await region('Lieferantenplan')).findByRole('link', {
        name: /Noch kein Lieferantenplan/,
      }),
    ).toBeTruthy();
    expect(
      await within(await region('Warengruppen')).findByText(
        'Konnte nicht geladen werden.',
        {},
        {
          timeout: 8000,
        },
      ),
    ).toBeTruthy();
    expect(await region('Segment und Bewertung')).toBeTruthy();
  });

  it('T2-I12: Warengruppen: Spend, Lead, Stärke, Absicht, Strategie; ein offener Widerspruch als Chip', async () => {
    renderAt(privat);
    const groups = await region('Warengruppen');
    const row = (name: RegExp) => within(groups).getByRole('link', { name });
    await within(groups).findByRole('link', { name: /Leiterplatten/ });
    expect(plain(row(/Leiterplatten/).textContent)).toContain(
      'Leiterplatten · 3,1 Mio. €Lead Sara Ost · schwach · will stärken',
    );
    expect(row(/Bestückte Baugruppen/).textContent).toContain(
      'Lead Ida Roth · stark · Strategie freigegeben',
    );
    expect(row(/Kabelsätze/).textContent).toContain('ohne Lead · schwach · beendet die Beziehung');
    expect(row(/Kabelsätze/).textContent).toContain('widerspricht');
    expect(row(/Leiterplatten/).textContent).not.toContain('widerspricht');
  });

  it('T2-I06: Wert: gesichert gegen Ziel und Potenzial nur als EBIT; ohne Recht kein Abschnitt', async () => {
    renderAt(privat);
    const value = await region('Wert');
    const results = await within(value).findByRole('link', { name: /Ergebnisse 2026/ });
    expect(plain(results.textContent)).toMatch(/74.*von 100.*gesichert · 140.*bis 200.*Potenzial/);
    expect(plain(results.textContent)).not.toContain('Mio.');
    expect(within(value).getByRole('link', { name: /Wertpotenziale/ }).textContent).toContain(
      '2 neu, 1 übernommen',
    );
    tearDownApp();
    setUpApp();
    sample = aktePrivateSample();
    sample.status.secured = 403;
    api.aktePrivate = sample;
    renderAt(privat);
    await region('Segment und Bewertung');
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Wert' })).toBeNull());
  });
});

describe('AK-01 Nur für dich: Ziel bis K4-c auf dem bisherigen Überblick (K2-c.7)', () => {
  it('ein vorgeschlagenes Ziel führt zur Freigabe; ohne Ziel zum Vorschlagen', async () => {
    sample.secured = {
      ...sample.secured,
      target: { ebitTargetCents: 10_000_000, approved: false },
    };
    renderAt(privat);
    const value = await region('Wert');
    const target = await within(value).findByRole('link', { name: /Ziel 2026/ });
    expect(plain(target.textContent)).toContain('100.000 € vorgeschlagen, Freigabe offen');
    expect(target.getAttribute('href')).toBe(`/lieferanten/${id}`);
    tearDownApp();
    setUpApp();
    sample = aktePrivateSample();
    sample.secured = { ...sample.secured, target: null };
    api.aktePrivate = sample;
    renderAt(privat);
    const none = await within(await region('Wert')).findByRole('link', { name: /Ziel 2026/ });
    expect(none.textContent).toContain('noch kein Ziel');
  });

  it('ein freigegebenes Ziel steht nur in den Ergebnissen', async () => {
    renderAt(privat);
    const value = await region('Wert');
    await within(value).findByRole('link', { name: /Ergebnisse 2026/ });
    expect(within(value).queryByRole('link', { name: /Ziel 2026/ })).toBeNull();
  });
});

describe('AK-01 Nur für dich auf Englisch', () => {
  it('alle Texte der Sicht kommen aus dem englischen Katalog', async () => {
    browserLanguages(['en-GB', 'en']);
    api.me = { ...anna, locale: 'en' };
    renderAt(privat);
    const note = await screen.findByRole('region', { name: 'Key points' });
    expect(note.textContent).toContain('Only for you and your teamprivate');
    await waitFor(() =>
      expect(note.textContent).toContain(
        'Rheintal Elektronik is in the segment “Strategisch”, but only just: 4 points above the boundary.',
      ),
    );
    expect(await screen.findByRole('region', { name: 'History · your team only' })).toBeTruthy();
    expect(await screen.findByRole('region', { name: 'Relationship network' })).toBeTruthy();
    expect(await screen.findByRole('region', { name: 'Segment and rating' })).toBeTruthy();
  });
});

// K2-c.7 (E-K2-12): Die bisherige Seite Aktivitäten leitet in den Verlauf; was sie konnte, steht
// hier (vorher NAV-10, IN-03 und TN-08 auf der alten Seite)
describe('AK-01 Nur für dich: Verlauf statt der Seite Aktivitäten (K2-c.7)', () => {
  const item = {
    occurredAt: '2026-11-20T13:00:00Z',
    visibility: 'team' as const,
    pinned: false,
    mine: false,
  };

  it('T2-I07: die bisherige Adresse Aktivitäten führt in den Verlauf der Akte', async () => {
    const router = renderAt(`/lieferanten/${id}/aktivitaeten`);
    expect(await region('Verlauf · nur euer Team')).toBeTruthy();
    expect(router.state.location.pathname).toBe(`/beziehungen/${id}`);
    expect(router.state.location.search).toMatchObject({ sicht: 'privat' });
    expect(router.state.location.hash).toBe('verlauf');
  });

  it('IN-03: ein Termin aus Outlook steht im Verlauf mit „aus Outlook“', async () => {
    sample.activities = {
      ...sample.activities,
      items: [
        {
          ...item,
          id: 'meeting:3',
          kind: 'meeting',
          actor: { type: 'person', name: 'Ida Roth' },
          title: 'Abstimmung Musterteile',
          code: 'outlook_addin',
          meta: 'Teams',
          href: `/lieferanten/${id}/umsetzung/termine/m3`,
        },
      ],
    };
    renderAt(privat);
    const history = await region('Verlauf · nur euer Team');
    const meeting = await within(history).findByRole('link', { name: /Abstimmung Musterteile/ });
    expect(meeting.textContent).toContain('aus Outlook · Teams');
  });

  it('ein Eintrag von Reziproq führt zu seinem Objekt', async () => {
    sample.activities = {
      ...sample.activities,
      items: [
        {
          ...item,
          id: 'agent:2',
          kind: 'agent',
          actor: { type: 'reziproq' },
          title: '',
          code: 'pre_read',
          meta: 'draft',
          href: `/lieferanten/${id}/umsetzung/termine/abc`,
        },
      ],
    };
    renderAt(privat);
    const history = await region('Verlauf · nur euer Team');
    const entry = await within(history).findByRole('link', { name: /Pre-Read/ });
    expect(entry.getAttribute('href')).toBe(`/lieferanten/${id}/umsetzung/termine/abc`);
  });

  it('eine Telefonnotiz für das Team', async () => {
    const posted: unknown[] = [];
    api.handle = (request) => {
      if (request.method === 'POST' && request.url.endsWith('/notizen')) posted.push(request.body);
      return undefined;
    };
    renderAt(privat);
    const history = await region('Verlauf · nur euer Team');
    fireEvent.click(await within(history).findByRole('button', { name: 'Neue Notiz' }));
    const form = within(history).getByRole('form', { name: 'Neue Notiz' });
    fireEvent.change(within(form).getByRole('textbox', { name: 'Notiz' }), {
      target: { value: 'Vor dem Angebot mit Tom sprechen.' },
    });
    fireEvent.click(within(form).getByLabelText('Telefonnotiz'));
    fireEvent.click(within(form).getByRole('button', { name: 'Notiz speichern' }));
    await waitFor(() =>
      expect(posted).toEqual([
        { text: 'Vor dem Angebot mit Tom sprechen.', visibility: 'team', kind: 'call' },
      ]),
    );
  });

  it('TN-08: ⌘K in der Akte öffnet Frag Reziproq mit der Beziehung als Kontext', async () => {
    renderAt(privat);
    await region('Verlauf · nur euer Team');
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const overlay = await screen.findByRole('dialog', { name: 'Frag Reziproq' });
    fireEvent.change(
      await within(overlay).findByRole('textbox', { name: 'Deine Frage an Reziproq' }),
      { target: { value: 'Was ist offen?' } },
    );
    fireEvent.click(within(overlay).getByRole('button', { name: 'Fragen' }));
    await waitFor(() =>
      expect(api.promptRequests.at(-1)).toMatchObject({ context: { relationshipId: id } }),
    );
  });
});
