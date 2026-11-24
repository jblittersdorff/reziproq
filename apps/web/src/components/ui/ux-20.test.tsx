// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';
import { Collapsible } from './collapsible';
import { DateList } from './date-list';
import { SupplierHeader } from './entity-header';
import { FormPage } from './form-page';
import { NextCard } from './next-card';
import { ProcessChain } from './process-chain';
import { Row, RowGroup } from './row-group';
import { SoWhat } from './so-what';
import { StatusDot } from './status-dot';
import { TimelineRail } from './timeline-rail';

// UX-20 Phase 1: Bausteine einmal gebaut, Kriterien aus UX-20 und NAV-10 je Baustein.
afterEach(cleanup);

describe('NextCard', () => {
  it('hat genau einen Knopf mit Ziel', () => {
    render(
      <NextCard
        kicker="Als Nächstes · überfällig seit 2 Tagen"
        title="Liefertreue Oktober für Rheintal erfassen"
        action={{ label: 'Wert erfassen', href: '/lieferanten/1/plan/scorecard' }}
      />,
    );
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe('/lieferanten/1/plan/scorecard');
  });

  it('ohne Ziel wirft die Karte einen Fehler, auch bei leerem Ziel oder „#“', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const href of ['', ' ', '#']) {
      expect(() =>
        render(<NextCard kicker="k" title="t" action={{ label: 'Los', href }} />),
      ).toThrow(/braucht ein Ziel/);
    }
  });
});

describe('RowGroup', () => {
  it('eine Zeile mit Ziel ist ein Link mit Pfeil, eine ohne Ziel hat keinen Pfeil und ist nicht klickbar', () => {
    const { container } = render(
      <RowGroup label="Heute">
        <Row href="/mein-tag" title="Briefing prüfen" detail="Agenda bis Fr" />
        <Row title="Scorecard unterschreiben" value="Di 24.11." />
      </RowGroup>,
    );
    const link = screen.getByRole('link', { name: /Briefing prüfen/ });
    expect(link.querySelector('[data-slot="row-arrow"]')).not.toBeNull();
    const plain = container.querySelector('[data-slot="row"]') as HTMLElement;
    expect(plain.textContent).toContain('Scorecard unterschreiben');
    expect(plain.closest('a')).toBeNull();
    expect(plain.querySelector('[data-slot="row-arrow"]')).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});

describe('ProcessChain', () => {
  it('markiert den aktuellen Schritt, frühere als erledigt; ohne Recht grau und ohne Link', () => {
    render(
      <ProcessChain
        label="Ablauf Segmentierung"
        stateLabels={{ done: 'erledigt', current: 'jetzt', open: 'offen' }}
        steps={[
          { key: 'a', label: 'Runde starten', href: '/a', state: 'done' },
          { key: 'b', label: 'Bewerten', href: '/b', state: 'done' },
          { key: 'c', label: 'Konsolidieren', href: '/c', state: 'current' },
          { key: 'd', label: 'Portfolio', href: '/d', state: 'open', allowed: false },
        ]}
      />,
    );
    const chain = screen.getByRole('navigation', { name: 'Ablauf Segmentierung' });
    const items = within(chain).getAllByRole('listitem');
    expect(items.map((item) => item.getAttribute('data-state'))).toEqual([
      'done',
      'done',
      'current',
      'open',
    ]);
    expect(items[2]?.getAttribute('aria-current')).toBe('step');
    expect(within(chain).getAllByRole('link')).toHaveLength(3);
    expect(within(items[3] as HTMLElement).queryByRole('link')).toBeNull();
  });
});

describe('Collapsible', () => {
  // Öffnen mit Klick und Tastatur prüft e2e/ux-20-phase-1.spec.ts im echten Browser.
  it('ist beim Laden eingeklappt', () => {
    const { container } = render(
      <Collapsible title="Leitfragen">
        <p>Was will Rheintal erreichen?</p>
      </Collapsible>,
    );
    const details = container.querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')?.textContent).toContain('Leitfragen');
  });
});

describe('FormPage', () => {
  it('hat genau einen Hauptknopf; der Zweitknopf ist kein Absenden', () => {
    const submit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <FormPage
        label="Person hinzufügen"
        primary="Einladung senden"
        secondary={{ label: 'Abbrechen', onClick: () => {} }}
        onSubmit={submit}
      >
        <input aria-label="Name" />
      </FormPage>,
    );
    const form = screen.getByRole('form', { name: 'Person hinzufügen' });
    expect(form.querySelectorAll('button[type="submit"]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Einladung senden' }));
    expect(submit).toHaveBeenCalledTimes(1);
  });
});

describe('SoWhat', () => {
  it('zeigt höchstens drei Punkte; ein Punkt mit Ziel ist ein Link', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const point = (key: string, href?: string) => ({
      key,
      status: 'Offen',
      tone: 'warning' as const,
      text: key,
      ...(href ? { href } : {}),
    });
    render(
      <SoWhat
        heading="Das Wichtigste"
        statement="Ihr haltet eure Zusagen."
        points={[point('a', '/x'), point('b')]}
      />,
    );
    expect(screen.getAllByRole('link')).toHaveLength(1);
    cleanup();
    expect(() =>
      render(
        <SoWhat
          heading="Das Wichtigste"
          statement="s"
          points={[point('a'), point('b'), point('c'), point('d')]}
        />,
      ),
    ).toThrow(/höchstens drei/);
  });
});

describe('AppShell und Köpfe', () => {
  it('Seitenleiste mit vier Hauptpunkten und Einstellungen, Tab-Leiste mit fünf Zielen', () => {
    const icon = <svg aria-hidden />;
    const items = ['Übersicht', 'Mein Tag', 'Lieferanten', 'Warengruppen'].map((label) => ({
      key: label,
      label,
      href: `/${label}`,
      icon,
    }));
    render(
      <AppShell
        label="Hauptbereiche"
        brand="Reziproq"
        brandHref="/"
        items={items}
        settings={{ key: 'settings', label: 'Einstellungen', href: '/einstellungen', icon }}
        tabs={[...items, { key: 'ask', label: 'Frag', href: '/fragen', icon }]}
        activeKey="Mein Tag"
      >
        <p>Inhalt</p>
      </AppShell>,
    );
    const [sidebar, tabs] = screen.getAllByRole('navigation', { name: 'Hauptbereiche' });
    expect(
      within(sidebar as HTMLElement)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'Reziproq',
      'Übersicht',
      'Mein Tag',
      'Lieferanten',
      'Warengruppen',
      'Einstellungen',
    ]);
    expect(within(tabs as HTMLElement).getAllByRole('link')).toHaveLength(5);
    expect(
      within(sidebar as HTMLElement)
        .getByRole('link', { name: 'Mein Tag' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('der Lieferantenkopf hat Zurück-Link, vier Bereiche und den Knopf „···“', () => {
    render(
      <SupplierHeader
        back={{ label: 'Lieferanten', href: '/lieferanten' }}
        name="Rheintal Elektronik"
        meta="Hoher Impact · ausbaufähig"
        areasLabel="Bereiche des Lieferanten"
        areas={['Überblick', 'Aktivitäten', 'Plan', 'Ergebnisse'].map((label) => ({
          key: label,
          label,
          href: '/x',
        }))}
        activeArea="Plan"
        profile={{ label: 'Profil, Segmentierung und Team', href: '/p', active: false }}
      />,
    );
    expect(screen.getByRole('link', { name: 'Lieferanten' }).getAttribute('href')).toBe(
      '/lieferanten',
    );
    expect(
      within(screen.getByRole('navigation', { name: 'Bereiche des Lieferanten' })).getAllByRole(
        'link',
      ),
    ).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'Profil, Segmentierung und Team' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Rheintal Elektronik' })).toBeTruthy();
  });
});

describe('TimelineRail und DateList (Phase 2)', () => {
  it('die Schiene beginnt mit Heute in Tinte; jeder Eintrag mit Ziel öffnet sein Objekt', () => {
    render(
      <TimelineRail
        label="Die nächsten vier Wochen"
        locale="de"
        today={{
          key: 'today',
          date: '2026-11-23',
          kind: 'Heute',
          title: '3 Dinge',
          href: '/mein-tag',
        }}
        items={[
          {
            key: 'a',
            date: '2026-12-04',
            kind: 'Termin',
            tone: 'meeting',
            title: 'JBP',
            href: '/a',
          },
          { key: 'b', date: '2026-12-09', kind: 'Freigabe', tone: 'approval', title: 'Strategie' },
        ]}
      />,
    );
    const rail = screen.getByRole('list', { name: 'Die nächsten vier Wochen' });
    const items = within(rail).getAllByRole('listitem');
    expect(items[0]?.getAttribute('data-now')).toBe('true');
    expect(items[0]?.querySelector('[data-next]')).not.toBeNull();
    expect(
      within(rail)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/mein-tag', '/a']);
    // Art als Text, nicht nur als Farbe
    expect(within(items[2] as HTMLElement).getByText('Freigabe')).toBeTruthy();
  });

  it('DateList: Zeile mit Ziel ist ein Link, ohne Ziel nicht; Status als Text im Chip', () => {
    render(
      <DateList
        locale="de"
        label="Termine"
        items={[
          {
            key: 'a',
            date: '2026-12-04',
            title: 'JBP',
            chip: { label: 'Briefing', tone: 'shared' },
            href: '/a',
          },
          { key: 'b', title: '8D-Bericht', chip: { label: 'überfällig', tone: 'danger' } },
        ]}
      />,
    );
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByText('überfällig')).toBeTruthy();
    expect(
      screen.getAllByRole('listitem')[1]?.querySelector('[data-slot="date-circle"]'),
    ).toBeNull();
  });
});

describe('Phase 3: Ampelpunkt, benannte Zeilengruppe, Name auf Unterseiten', () => {
  it('StatusDot zeigt den Status immer als Text, der Punkt ist Schmuck', () => {
    render(<StatusDot tone="danger" label="Zusage überfällig" />);
    const dot = document.querySelector('[data-slot="status-dot"]') as HTMLElement;
    expect(dot.textContent).toBe('Zusage überfällig');
    expect(dot.dataset.tone).toBe('danger');
    expect(dot.querySelector('[aria-hidden]')).not.toBeNull();
  });

  it('RowGroup mit Label ist ein benannter Bereich, ohne Label nicht', () => {
    render(
      <>
        <RowGroup label="Stand der Beziehung">
          <Row title="Ergebnisse" href="/x" />
        </RowGroup>
        <RowGroup>
          <Row title="Ohne Label" />
        </RowGroup>
      </>,
    );
    expect(screen.getByRole('region', { name: 'Stand der Beziehung' })).toBeTruthy();
    expect(screen.getAllByRole('region')).toHaveLength(1);
  });

  it('auf Unterseiten ist der Name im Kopf keine Überschrift; die Seite trägt den Titel', () => {
    render(
      <SupplierHeader
        back={{ label: 'Lieferanten', href: '/lieferanten' }}
        name="Rheintal Elektronik"
        nameAs="p"
        meta="Elektronik"
        areasLabel="Bereiche des Lieferanten"
        areas={[{ key: 'plan', label: 'Plan', href: '/plan' }]}
        activeArea="plan"
        pagesLabel="Seiten im Bereich"
        pages={[
          { key: 'themen', label: 'Themen', href: '/themen' },
          { key: 'zusagen', label: 'Zusagen', href: '/zusagen' },
        ]}
        activePage="themen"
        profile={{ label: 'Profil, Segmentierung und Team', href: '/p', active: false }}
      />,
    );
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.getByText('Rheintal Elektronik').tagName).toBe('P');
    const pages = screen.getByRole('navigation', { name: 'Seiten im Bereich' });
    expect(within(pages).getByRole('link', { current: 'page' }).textContent).toBe('Themen');
  });
});
