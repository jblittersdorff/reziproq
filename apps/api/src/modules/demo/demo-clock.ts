import { type DemoRunKey, demoRunKeys } from '@reziproq/shared';
import { berlinDate, berlinTime } from '../today/berlin.js';

// DM-01 (K1-g.1): Zeitplan der Demo-Uhr. Die Zeiten folgen dem Betrieb, in Berlin: Wertfinder am 1.
// des Monats um 05:00, Triage um 06:00, Hinweise um 07:30. Briefing und Ergebnis-Aufgabe laufen im
// Betrieb alle 15 Minuten, hier an jedem Haltepunkt der Uhr. Andere Jobs (Erinnerungen,
// Benachrichtigungen, Warengruppen) kommen dazu, sobald ein Drehbuch sie braucht.

interface DailyRun {
  key: Exclude<DemoRunKey, 'briefing'>;
  hour: number;
  minute: number;
  /** nur am 1. des Monats */
  monthly?: boolean;
}

const dailyRuns: DailyRun[] = [
  { key: 'wertfinder', hour: 5, minute: 0, monthly: true },
  { key: 'triage', hour: 6, minute: 0 },
  { key: 'hinweise', hour: 7, minute: 30 },
];

function nextDay(date: string): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

/** Der nächste 06:00-Lauf in Berlin nach from („Neuer Tag“) */
export function nextMorningRun(from: Date): Date {
  const today = berlinTime(berlinDate(from), 6);
  return today > from ? today : berlinTime(nextDay(berlinDate(from)), 6);
}

/**
 * Die Läufe zwischen from (ausschließlich) und to (einschließlich) in zeitlicher Reihenfolge (T1-DM5).
 * Zur selben Zeit gilt die Reihenfolge von demoRunKeys: Das Briefing läuft vor der Triage, damit
 * sie es schon sieht. Am Ziel läuft das Briefing immer.
 */
export function dueRuns(from: Date, to: Date): { key: DemoRunKey; at: Date }[] {
  const runs: { key: DemoRunKey; at: Date }[] = [];
  for (let day = berlinDate(from); day <= berlinDate(to); day = nextDay(day)) {
    for (const run of dailyRuns) {
      if (run.monthly && !day.endsWith('-01')) continue;
      const at = berlinTime(day, run.hour, run.minute);
      if (at > from && at <= to) runs.push({ key: run.key, at });
    }
  }
  const stops = new Set([...runs.map((run) => run.at.getTime()), to.getTime()]);
  for (const stop of stops) runs.push({ key: 'briefing', at: new Date(stop) });
  const order = (key: DemoRunKey) => demoRunKeys.indexOf(key);
  return runs.sort((a, b) => a.at.getTime() - b.at.getTime() || order(a.key) - order(b.key));
}
