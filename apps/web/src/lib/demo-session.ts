import { type DemoSession, demoSessionSchema } from '@reziproq/shared';
import { resetBusinessTime } from './clock';

// DM-01, E-K0-05 (K1-b.2): Demo-Sitzung je Person im Demo-Mandanten, ohne Zitadel. Gespeichert je
// Tab (sessionStorage): Zwei Fenster können zwei Rollen spielen, etwa Käufer und Lieferant
// (Demo-Regie, K1-g). Nach Ablauf oder Abmelden ist die Sitzung weg.

const storageKey = 'reziproq.demo-sitzung';

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
  resetBusinessTime();
}

/** Beim Start der App gelesen: läuft in diesem Tab eine Demo-Sitzung? */
export const startupDemoSession = typeof window === 'undefined' ? null : readDemoSession();
