// HE-01: Die Triage läuft täglich um 06:00, „Später“ gilt bis 07:00 des nächsten Tages, beides in
// Berlin nach der Uhr je Mandant (DM-01). Hier nur Umrechnungen, die Zeit selbst kommt als Argument.

const zone = 'Europe/Berlin';
const dayFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: zone });
const partsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: zone,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** Datum in Berlin (JJJJ-MM-TT) */
export function berlinDate(at: Date): string {
  return dayFormat.format(at);
}

/** Ortszeit in Berlin als Zeitpunkt, als wäre sie UTC; Grundlage für den Versatz */
function wallClock(at: Date): number {
  const parts = Object.fromEntries(
    partsFormat.formatToParts(at).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  );
}

/** Stunde in Berlin (0 bis 23) */
export function berlinHour(at: Date): number {
  return new Date(wallClock(at)).getUTCHours();
}

/** Zeitpunkt für Datum und Uhrzeit in Berlin, Sommer- und Winterzeit eingerechnet */
export function berlinTime(date: string, hour: number, minute = 0): Date {
  const pad = (value: number) => String(value).padStart(2, '0');
  const guess = new Date(`${date}T${pad(hour)}:${pad(minute)}:00Z`);
  return new Date(guess.getTime() - (wallClock(guess) - guess.getTime()));
}

/** „Später“: der nächste Tag um 07:00 in Berlin */
export function nextMorning(at: Date): Date {
  const tomorrow = new Date(`${berlinDate(at)}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return berlinTime(tomorrow.toISOString().slice(0, 10), 7);
}
