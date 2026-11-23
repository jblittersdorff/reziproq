import {
  cleanup,
  fireEvent,
  render as renderDom,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './app';
import { de } from './content/de';
import { en } from './content/en';
import { render, routes } from './entry-server';
import { internalTarget, Site } from './navigation';
import { mailtoHref } from './pages/contact';
import {
  formatEuro,
  formatEuroShort,
  formatPercent,
  priceYear,
  successShareCents,
} from './pricing';
import { contactEmail, type Locale, locales, match, type PageKey, pageKeys, pathOf } from './site';

// Tests zu docs/specs/WEB-01.md

afterEach(cleanup);

// Die Checkbox aus radix-ui misst ihre Größe; jsdom kennt ResizeObserver nicht.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

/** Alle Schlüsselpfade eines Inhaltsobjekts, ohne die Werte */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value))
    return value.flatMap((item, index) => keyPaths(item, `${prefix}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, inner]) => keyPaths(inner, `${prefix}.${key}`));
  }
  return [prefix];
}

describe('Seiten und Pfade', () => {
  it('hat elf Seiten in zwei Sprachen, jede mit eigenem Pfad', () => {
    expect(pageKeys).toHaveLength(11);
    expect(routes).toHaveLength(22);
    expect(new Set(routes.map((route) => route.path)).size).toBe(22);
  });

  it('findet zu jedem Pfad Seite und Sprache, auch mit Schrägstrich am Ende', () => {
    for (const route of routes) {
      expect(match(route.path)).toEqual({ page: route.page, locale: route.locale });
      expect(match(`${route.path.replace(/\/$/, '')}/`)).toEqual({
        page: route.page,
        locale: route.locale,
      });
    }
    expect(match('/gibt-es-nicht')).toBeNull();
  });

  it('Deutsch und Englisch haben dieselben Texte (gleiche Schlüssel, gleiche Listenlängen)', () => {
    expect(keyPaths(de)).toEqual(keyPaths(en));
  });
});

describe.each(locales)('vorgerenderte Seiten auf %s', (locale) => {
  it.each(pageKeys)('%s hat genau eine Überschrift h1, Titel und keinen Platzhalter', (page) => {
    const result = render(page, locale);
    expect(result.lang).toBe(locale);
    expect(result.title).toContain('Reziproq');
    expect(result.html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(result.html).toContain('id="inhalt"');
    expect(result.alternates.map((alt) => alt.path)).toEqual([
      pathOf(page, 'en'),
      pathOf(page, 'de'),
    ]);
    // Platzhalter in eckigen Klammern nur auf „Rechtliches“ (bis zur Prüfung durch Juristen)
    const visible = result.html.replace(/<[^>]+>/g, ' ');
    if (page === 'legal') expect(visible).toMatch(/\[[^\]]+\]/);
    else expect(visible).not.toMatch(/\[[^\]]+\]/);
  });
});

describe('Kopf und Sprachwahl', () => {
  it('markiert die aktuelle Seite und verlinkt dieselbe Seite in der anderen Sprache', () => {
    renderDom(<App page="pricing" locale="de" />);
    const main = screen.getByRole('navigation', { name: de.nav.main });
    expect(
      within(main).getByRole('link', { name: de.nav.pricing }).getAttribute('aria-current'),
    ).toBe('page');
    const language = screen.getByRole('navigation', { name: de.nav.language });
    expect(within(language).getByRole('link', { name: 'EN' }).getAttribute('href')).toBe(
      '/pricing',
    );
    expect(within(language).getByRole('link', { name: 'DE' }).getAttribute('aria-current')).toBe(
      'true',
    );
  });

  it('Anmelden führt zur App, die Website meldet nicht selbst an', () => {
    renderDom(<App page="login" locale="en" />);
    const link = screen.getByRole('link', { name: en.login.signIn });
    expect(link.getAttribute('href')).toMatch(/^https?:\/\//);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('Unternehmen zeigt kein Team, solange es nur Platzhalter gibt', () => {
    const { html } = render('company', 'en');
    expect(html).not.toContain('Co-founder');
    expect(html).not.toContain('[Full name]');
  });
});

describe('Preisrechner (Beträge in Cent)', () => {
  it('staffelt den Erfolgsanteil 10 %, 5 %, 2 %', () => {
    expect(successShareCents(0)).toBe(0);
    expect(successShareCents(1_000_000_00)).toBe(100_000_00);
    expect(successShareCents(5_000_000_00)).toBe(300_000_00);
    expect(successShareCents(10_000_000_00)).toBe(400_000_00);
    expect(successShareCents(100_000_000_00)).toBe(2_200_000_00);
  });

  it('rechnet die drei Beispiele der Seite nach', () => {
    const cases = [
      { relationships: 20, ebit: 2_000_000, capital: 5_000_000, pay: 217_760, keep: 2_182_240 },
      { relationships: 50, ebit: 10_000_000, capital: 20_000_000, pay: 551_400, keep: 11_048_600 },
      {
        relationships: 150,
        ebit: 50_000_000,
        capital: 100_000_000,
        pay: 1_718_200,
        keep: 56_281_800,
      },
    ];
    for (const c of cases) {
      const result = priceYear({
        relationships: c.relationships,
        ebitCents: c.ebit * 100,
        capitalCents: c.capital * 100,
      });
      expect(result.payCents).toBe(c.pay * 100);
      expect(result.keepCents).toBe(c.keep * 100);
      expect(Number.isInteger(result.payCents)).toBe(true);
    }
  });

  it('zählt Kapital nur mit 8 % und ohne Wert keinen Anteil', () => {
    const result = priceYear({ relationships: 10, ebitCents: 0, capitalCents: 10_000_000_00 });
    expect(result.valueCents).toBe(800_000_00);
    const empty = priceYear({ relationships: 10, ebitCents: 0, capitalCents: 0 });
    expect(empty.shareCents).toBe(0);
    expect(empty.payPercent).toBeNull();
    expect(empty.feesCents).toBe(10 * 199_00 * 12);
  });

  it('schreibt Beträge je Sprache', () => {
    expect(formatEuro(551_400_00, 'en')).toBe('€551,400');
    // Deutsch trennt Zahl und € mit geschütztem Leerzeichen
    expect(formatEuro(551_400_00, 'de').replace(/\s/g, ' ')).toBe('551.400 €');
    expect(formatEuroShort(10_000_000_00, 'en')).toBe('€10M');
    expect(formatPercent(4.81, 'en')).toBe('4.8%');
    expect(formatPercent(4.81, 'de')).toBe('4,8 %');
  });

  it('rechnet neu, wenn ein Regler bewegt wird', () => {
    renderDom(<App page="pricing" locale="en" />);
    expect(screen.getByText('€551,400')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(en.pricing.calculator.relationships), {
      target: { value: '20' },
    });
    // 20 × 199 € × 12 = 47.760 €, Anteil bleibt 432.000 €
    expect(screen.getByText('€47,760')).toBeTruthy();
    expect(screen.getByText('€479,760')).toBeTruthy();
  });
});

describe('Kontakt ohne Maildienst', () => {
  it('baut eine mailto-Adresse mit Betreff und allen Angaben', () => {
    const href = mailtoHref(
      {
        firstName: 'Erika',
        lastName: 'Muster',
        email: 'erika@example.com',
        company: 'Beispiel AG',
        role: 'Einkauf',
        interest: 'Eine Demo',
        message: 'Zehn Lieferanten & mehr',
      },
      de.contact.form,
    );
    expect(href.startsWith(`mailto:${contactEmail}?subject=`)).toBe(true);
    const body = decodeURIComponent(href.split('&body=')[1] ?? '');
    expect(body).toContain('Unternehmen: Beispiel AG');
    expect(body).toContain('Zehn Lieferanten & mehr');
    expect(decodeURIComponent(href)).toContain('Anfrage über reziproq.de · Eine Demo');
  });

  it('das Formular hat Pflichtfelder und eine Einwilligung', () => {
    renderDom(<App page="contact" locale="de" />);
    expect(screen.getByLabelText(de.contact.form.email).hasAttribute('required')).toBe(true);
    expect(screen.getByRole('checkbox').getAttribute('aria-required')).toBe('true');
    expect(screen.getByRole('button', { name: de.contact.form.send })).toBeTruthy();
  });
});

describe('Navigation ohne Neuladen', () => {
  const start = (page: PageKey, locale: Locale) => {
    window.history.replaceState(null, '', pathOf(page, locale));
    return renderDom(<Site initial={{ page, locale }} />);
  };
  const heading = () => screen.getByRole('heading', { level: 1 }).textContent;

  it('ein Klick im Menü wechselt Inhalt, Adresse, Titel und Sprache, ohne die Seite zu laden', async () => {
    start('home', 'de');
    const before = heading();
    const nav = screen.getByRole('navigation', { name: de.nav.main });
    const link = within(nav).getByRole('link', { name: de.nav.pricing });
    // fireEvent.click gibt false zurück, wenn die Website den Klick übernommen hat
    expect(fireEvent.click(link)).toBe(false);
    expect(window.location.pathname).toBe(pathOf('pricing', 'de'));
    expect(heading()).not.toBe(before);
    expect(document.title).toBe(de.meta.titles.pricing);
    // Sprachwahl wechselt ebenfalls ohne Neuladen
    const language = screen.getByRole('navigation', { name: de.nav.language });
    expect(fireEvent.click(within(language).getAllByRole('link')[0] as HTMLElement)).toBe(false);
    expect(window.location.pathname).toBe(pathOf('pricing', 'en'));
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe(en.meta.titles.pricing);
  });

  it('Zurück im Browser zeigt die vorige Seite', async () => {
    start('home', 'de');
    const home = heading();
    fireEvent.click(
      within(screen.getByRole('navigation', { name: de.nav.main })).getByRole('link', {
        name: de.nav.security,
      }),
    );
    expect(heading()).not.toBe(home);
    window.history.back();
    await waitFor(() => expect(window.location.pathname).toBe(pathOf('home', 'de')));
    await waitFor(() => expect(heading()).toBe(home));
  });

  it('Strg-Klick, Anmelden in der App und fremde Adressen lädt der Browser wie gewohnt', () => {
    start('home', 'de');
    const nav = screen.getByRole('navigation', { name: de.nav.main });
    const link = within(nav).getByRole('link', { name: de.nav.pricing });
    const origin = window.location.origin;
    expect(internalTarget(new MouseEvent('click', { ctrlKey: true }), origin)).toBeNull();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', { value: link });
    expect(internalTarget(event, origin)?.pathname).toBe(pathOf('pricing', 'de'));
    const external = document.createElement('a');
    external.href = 'https://example.com/preise';
    const outside = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(outside, 'target', { value: external });
    expect(internalTarget(outside, origin)).toBeNull();
  });
});
