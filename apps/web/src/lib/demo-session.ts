import { type DemoSession, demoSessionSchema } from '@reziproq/shared';
import { resetBusinessTime } from './clock';

// DM-01, E-K0-05 (K1-b.2): Demo-Sitzung je Person im Demo-Mandanten, ohne Zitadel. Gespeichert je
// Tab (sessionStorage): Zwei Fenster können zwei Rollen spielen, etwa Käufer und Lieferant
// (Demo-Regie, K1-g). Nach Ablauf oder Abmelden ist die Sitzung weg.
//
// Neustart (27.11.2026, Wunsch des Gründers): Läuft die Sitzung ab oder öffnet die Person einen
// neuen Tab, startet die Demo als dieselbe Person neu, statt zur Anmeldung zu führen: die Person
// des Tabs, sonst die zuletzt im Browser genutzte (localStorage, nur ihre ID, kein Token). Abmelden
// und ein gescheiterter Start vergessen sie. Im Betrieb gibt es keine Demo-Sitzungen (die API
// antwortet 404), also auch keinen Neustart.

const storageKey = 'reziproq.demo-sitzung';
const personKey = 'reziproq.demo-person';
/** So lange vor dem Ablauf startet die Sitzung neu, damit keine Anfrage am alten Token scheitert */
const renewBeforeMs = 5 * 60_000;

export function readDemoSession(now = new Date()): DemoSession | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = demoSessionSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || new Date(parsed.data.expiresAt) <= now) {
      window.sessionStorage.removeItem(storageKey);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function saveDemoSession(session: DemoSession) {
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(session));
    window.localStorage.setItem(personKey, session.person.id);
  } catch {
    // Ohne Speicher im Tab gibt es keine Demo-Sitzung; die Seite sagt es.
  }
}

/** Beendet die Demo-Sitzung im Tab und mit ihr die Fachzeit der Demo-Uhr (K1-b.5) */
export function clearDemoSession() {
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // nichts zu tun
  }
  forgetDemoPerson();
  resetBusinessTime();
}

/** Vergisst die zuletzt genutzte Person: nach dem Abmelden und wenn der Start scheitert */
export function forgetDemoPerson() {
  try {
    window.localStorage.removeItem(personKey);
  } catch {
    // nichts zu tun
  }
}

/** Person der Sitzung dieses Tabs, auch abgelaufen; sonst die zuletzt im Browser genutzte */
export function demoPersonToRestart(): string | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    const parsed = raw ? demoSessionSchema.safeParse(JSON.parse(raw)) : null;
    if (parsed?.success) return parsed.data.person.id;
    return window.localStorage.getItem(personKey);
  } catch {
    return null;
  }
}

/** Endet die Sitzung in den nächsten fünf Minuten? Echtzeit, wie das Token selbst */
export function demoSessionEnding(session: DemoSession, now = new Date()): boolean {
  return new Date(session.expiresAt).getTime() - now.getTime() <= renewBeforeMs;
}

/** Lädt die App unter einer neuen Adresse (in Tests ersetzbar) */
export const leaveTo = (href: string) => window.location.replace(href);

/** /demo/als/<Person> mit Rückweg auf die Seite, auf der die Person gerade war */
export function demoRestartHref(
  person: string,
  here: { pathname: string; search: string; hash: string },
): string {
  const back = `${here.pathname}${here.search}${here.hash}`;
  const keep =
    back !== '/' && !here.pathname.startsWith('/demo/als/') && !here.pathname.startsWith('/auth/');
  return `/demo/als/${encodeURIComponent(person)}${keep ? `?zurueck=${encodeURIComponent(back)}` : ''}`;
}

// Erst die Person merken, dann die Sitzung lesen: readDemoSession entfernt eine abgelaufene.
const restartCandidate = typeof window === 'undefined' ? null : demoPersonToRestart();

/** Beim Start der App gelesen: läuft in diesem Tab eine Demo-Sitzung? */
export const startupDemoSession = typeof window === 'undefined' ? null : readDemoSession();

/** Ohne gültige Sitzung im Tab: als wer die Demo neu startet; null, wenn der Browser keine kennt */
export const startupDemoRestart = startupDemoSession ? null : restartCandidate;
