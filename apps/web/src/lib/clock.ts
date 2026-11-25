import { businessTimeHeader } from '@reziproq/shared';

// DM-01 (K1-b.4): Fachzeit der Oberfläche. Im Demo-Mandanten nennt die API ihre Demo-Uhr in jeder
// Antwort (Kopf x-reziproq-jetzt); die Oberfläche rechnet „heute“ und „jetzt“ mit dem Versatz zur
// Uhr des Browsers. Ohne Kopf gilt die Uhr des Browsers. Technik (Ablauf von Tokens, Entwürfe beim
// Neuanmelden) bleibt bei der Echtzeit; clock.node.test.ts hält die Ausnahmen fest.

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
  if (Number.isFinite(at)) offsetMs = at - Date.now();
}

/** Nur für Tests: zurück zur Uhr des Browsers */
export function resetBusinessTime() {
  offsetMs = 0;
}
