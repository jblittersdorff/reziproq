import { businessTimeHeader } from '@reziproq/shared';

// DM-01 (K1-b.4): Fachzeit der Oberfläche. Im Demo-Mandanten nennt die API ihre Demo-Uhr in jeder
// Antwort (Kopf x-reziproq-jetzt); die Oberfläche rechnet „heute“ und „jetzt“ mit dem Versatz zur
// Uhr des Browsers. Ohne Kopf gilt die Uhr des Browsers. Technik (Ablauf von Tokens, Entwürfe beim
// Neuanmelden) bleibt bei der Echtzeit; clock.node.test.ts hält die Ausnahmen fest.
// K1-b.5: Der Versatz gilt je Tab (sessionStorage) und überlebt das Neuladen nur in einer
// Demo-Sitzung. So zeigt schon das erste Bild nach dem Einstieg die Demo-Uhr, nicht kurz das echte
// Datum, und eine echte Anmeldung im selben Tab erbt nie ein Demo-Datum.

export const businessTimeKey = 'reziproq.fachzeit';

let offsetMs = 0;

/** Jetzt nach der Fachzeit des Mandanten */
export function appNow(): Date {
  return new Date(Date.now() + offsetMs);
}

/** Übernimmt die Fachzeit aus einer Antwort der API, wenn sie eine nennt. */
export function noteBusinessTime(headers: Headers) {
  const value = headers.get(businessTimeHeader);
  if (!value) return;
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return;
  offsetMs = at - Date.now();
  try {
    window.sessionStorage.setItem(businessTimeKey, String(offsetMs));
  } catch {
    // Ohne Speicher im Tab gilt der Versatz bis zum Neuladen
  }
}

/** Beim Start der App, vor dem ersten Bild: in einer Demo-Sitzung den Versatz des Tabs, sonst keinen */
export function startBusinessTime(inDemoSession: boolean) {
  if (!inDemoSession) {
    resetBusinessTime();
    return;
  }
  try {
    const stored = window.sessionStorage.getItem(businessTimeKey);
    const value = stored === null ? Number.NaN : Number(stored);
    offsetMs = Number.isFinite(value) ? value : 0;
  } catch {
    offsetMs = 0;
  }
}

/** Zurück zur Uhr des Browsers: ohne Demo-Sitzung, wenn sie endet, und in Tests */
export function resetBusinessTime() {
  offsetMs = 0;
  try {
    window.sessionStorage.removeItem(businessTimeKey);
  } catch {
    // nichts zu tun
  }
}
