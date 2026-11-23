/**
 * IN-03: Liest den iCalendar-Teil (text/calendar) einer Einladung. Nur was Reziproq braucht:
 * METHOD, UID, SEQUENCE, Betreff, Beginn, Ende, Ort, Link zur Besprechung, Organisator, Teilnehmer.
 * Der übrige Mailtext wird nie gelesen oder gespeichert.
 */

export interface IcsPerson {
  email: string;
  name: string | null;
  response: string | null;
}

export interface IcsEvent {
  uid: string | null;
  sequence: number;
  summary: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  onlineMeetingUrl: string | null;
  organizer: IcsPerson | null;
  attendees: IcsPerson[];
}

export interface IcsCalendar {
  method: string;
  events: IcsEvent[];
}

interface Line {
  name: string;
  params: Record<string, string>;
  value: string;
}

function unfold(text: string): string[] {
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if ((raw.startsWith(' ') || raw.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += raw.slice(1);
    } else if (raw.length > 0) {
      lines.push(raw);
    }
  }
  return lines;
}

function parseLine(raw: string): Line | null {
  let quoted = false;
  let colon = -1;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === '"') quoted = !quoted;
    if (char === ':' && !quoted) {
      colon = index;
      break;
    }
  }
  if (colon < 0) return null;
  const [name = '', ...parts] = raw.slice(0, colon).split(';');
  const params: Record<string, string> = {};
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value: raw.slice(colon + 1) };
}

const unescapeText = (value: string) =>
  value.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();

/** Versatz einer Zeitzone in Millisekunden zu einem Zeitpunkt; unbekannte Zonen gelten als Berlin. */
function zoneOffset(zone: string, at: number): number {
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return zoneOffset('Europe/Berlin', at);
  }
  const parts = Object.fromEntries(format.formatToParts(at).map((part) => [part.type, part.value]));
  const local = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return local - at;
}

export function parseIcsDate(value: string, zone: string | undefined): Date | null {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!match) return null;
  const [, y, mo, d, h = '0', mi = '0', s = '0', utc] = match;
  const naive = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  if (utc || !match[4]) return new Date(naive);
  const offset = zoneOffset(zone ?? 'Europe/Berlin', naive);
  return new Date(naive - offset);
}

const person = (line: Line): IcsPerson | null => {
  const email = line.value.replace(/^mailto:/i, '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
  return { email, name: line.params.CN?.trim() || null, response: line.params.PARTSTAT ?? null };
};

export function parseIcs(text: string): IcsCalendar {
  const lines = unfold(text.slice(0, 500_000)).map(parseLine).filter((line) => line !== null);
  const calendar: IcsCalendar = { method: 'REQUEST', events: [] };
  let current: (Partial<IcsEvent> & { attendees: IcsPerson[] }) | null = null;
  for (const line of lines) {
    if (line.name === 'METHOD' && !current) calendar.method = line.value.trim().toUpperCase();
    else if (line.name === 'BEGIN' && line.value.toUpperCase() === 'VEVENT') current = { attendees: [] };
    else if (line.name === 'END' && line.value.toUpperCase() === 'VEVENT' && current) {
      if (current.startsAt) {
        calendar.events.push({
          uid: current.uid ?? null,
          sequence: current.sequence ?? 0,
          summary: current.summary ?? '',
          startsAt: current.startsAt,
          endsAt: current.endsAt ?? null,
          location: current.location ?? null,
          onlineMeetingUrl: current.onlineMeetingUrl ?? null,
          organizer: current.organizer ?? null,
          attendees: current.attendees,
        });
      }
      current = null;
    } else if (current) {
      switch (line.name) {
        case 'UID':
          current.uid = line.value.trim();
          break;
        case 'SEQUENCE':
          current.sequence = Number.parseInt(line.value, 10) || 0;
          break;
        case 'SUMMARY':
          current.summary = unescapeText(line.value);
          break;
        case 'DTSTART': {
          const start = parseIcsDate(line.value.trim(), line.params.TZID);
          if (start) current.startsAt = start;
          break;
        }
        case 'DTEND':
          current.endsAt = parseIcsDate(line.value.trim(), line.params.TZID);
          break;
        case 'LOCATION':
          current.location = unescapeText(line.value) || null;
          break;
        case 'URL':
        case 'X-MICROSOFT-SKYPETEAMSMEETINGURL':
        case 'X-GOOGLE-CONFERENCE':
          current.onlineMeetingUrl = line.value.trim() || null;
          break;
        case 'ORGANIZER':
          current.organizer = person(line);
          break;
        case 'ATTENDEE': {
          const attendee = person(line);
          if (attendee) current.attendees.push(attendee);
          break;
        }
      }
    }
  }
  return calendar;
}
