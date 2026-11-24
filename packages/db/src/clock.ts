import { AsyncLocalStorage } from 'node:async_hooks';

// DM-01: Uhr je Mandant. Alle Dienste lesen die Zeit über currentTime(); im Demo-Mandanten liefert
// sie organization.demo_now, sonst die Echtzeit. Gesetzt wird die Demo-Uhr für die Dauer einer
// Mandanten-Transaktion (withTenant) und einer Anfrage (ClockInterceptor der API). Die Datenbank
// liest dieselbe Uhr mit app_now() (Migration 0131).
//
// systemTime() ist die Echtzeit für Technik, die nie im Demo laufen darf: Ablauf von Tokens und
// Schlüsseln, Messung, Protokoll, Wiederholung von Zustellungen. Ein Test verbietet new Date() und
// Date.now() in der API außerhalb dieser Datei.

const demoClock = new AsyncLocalStorage<Date | null>();

/** Fachzeit: die Demo-Uhr der Organisation, sonst die Echtzeit */
export function currentTime(): Date {
  const demo = demoClock.getStore();
  return demo ? new Date(demo.getTime()) : new Date();
}

/** Echtzeit für Technik (Tokens, Messung, Protokoll), unabhängig von der Demo-Uhr */
export function systemTime(): Date {
  return new Date();
}

/** Führt work mit der Demo-Uhr aus; null heißt Echtzeit. */
export function withDemoClock<T>(demoNow: Date | null, work: () => T): T {
  return demoClock.run(demoNow, work);
}
