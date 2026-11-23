import type { MeetingDetail, MeetingSide } from '@reziproq/shared';
import { escapeHtml, printDocument } from '../print/print-document.js';

// QBR-06: Pre-Read eines Termins als Druckseite. Inhalt kommt aus MeetingDetail, so wie die
// erzeugende Seite ihn über RLS sieht: interne Inhalte der anderen Seite fehlen damit schon dort.
// Bei abgeschlossenen Terminen sind die Abschnitte der eingefrorene Stand (Protokoll).

export type PrintLocale = 'de' | 'en';

const copy = {
  de: {
    preRead: 'Pre-Read',
    summary: 'Zusammenfassung',
    protocol: 'Protokoll',
    participants: 'Teilnehmende',
    agenda: 'Agenda',
    decisions: 'Beschlüsse',
    protocolText: 'Protokoll',
    note: 'Interne Notiz',
    internal: 'Intern',
    none: 'Keine Einträge.',
    noParticipants: 'Noch niemand eingetragen.',
    frozen: (date: string) => `Eingefrorener Stand vom ${date}`,
    current: (date: string) => `Stand vom ${date}`,
    due: (date: string) => `fällig ${date}`,
    sides: { buyer: 'Käufer', supplier: 'Lieferant' } as Record<MeetingSide, string>,
    sections: {
      scorecard: 'Scorecard mit Ist-Werten',
      initiatives: 'Initiativen',
      commitments: 'Offene Zusagen',
      actions: 'Offene Maßnahmen',
    } as Record<string, string>,
    types: {
      quarterly_review: 'Quartalsreview',
      strategy_dialogue: 'Strategiedialog',
      jbp: 'Joint Business Planning',
      negotiation: 'Verhandlung',
      site_visit: 'Werksbesuch oder Audit',
      escalation: 'Eskalation',
      format: 'Format aus den Spielregeln',
      other: 'Anderer Termin',
    } as Record<string, string>,
    statuses: {
      actions: {
        open: 'Offen',
        in_progress: 'In Arbeit',
        done: 'Erledigt',
        cancelled: 'Abgebrochen',
      },
      commitments: {
        open: 'Offen',
        kept: 'Gehalten',
        missed: 'Nicht gehalten',
        overdue: 'Überfällig',
      },
      initiatives: { planned: 'Geplant', running: 'Läuft', done: 'Erledigt', stopped: 'Gestoppt' },
      scorecard: {
        on_track: 'Auf Kurs',
        close: 'Knapp',
        off: 'Nicht auf Kurs',
        none: 'Noch kein Wert',
      },
    } as Record<string, Record<string, string>>,
    footer: (date: string) =>
      `Erzeugt mit Reziproq am ${date}. Enthält nur, was die eigene Seite sehen darf.`,
  },
  en: {
    preRead: 'Pre-read',
    summary: 'Summary',
    protocol: 'Minutes',
    participants: 'Participants',
    agenda: 'Agenda',
    decisions: 'Decisions',
    protocolText: 'Minutes',
    note: 'Internal note',
    internal: 'Internal',
    none: 'No entries.',
    noParticipants: 'Nobody added yet.',
    frozen: (date: string) => `Frozen state of ${date}`,
    current: (date: string) => `As of ${date}`,
    due: (date: string) => `due ${date}`,
    sides: { buyer: 'Buyer', supplier: 'Supplier' } as Record<MeetingSide, string>,
    sections: {
      scorecard: 'Scorecard with actuals',
      initiatives: 'Initiatives',
      commitments: 'Open commitments',
      actions: 'Open actions',
    } as Record<string, string>,
    types: {
      quarterly_review: 'Quarterly review',
      strategy_dialogue: 'Strategy dialogue',
      jbp: 'Joint Business Planning',
      negotiation: 'Negotiation',
      site_visit: 'Site visit or audit',
      escalation: 'Escalation',
      format: 'Format from the rules of engagement',
      other: 'Other meeting',
    } as Record<string, string>,
    statuses: {
      actions: { open: 'Open', in_progress: 'In progress', done: 'Done', cancelled: 'Cancelled' },
      commitments: { open: 'Open', kept: 'Kept', missed: 'Missed', overdue: 'Overdue' },
      initiatives: { planned: 'Planned', running: 'Running', done: 'Done', stopped: 'Stopped' },
      scorecard: { on_track: 'On track', close: 'Close', off: 'Off track', none: 'No value yet' },
    } as Record<string, Record<string, string>>,
    footer: (date: string) =>
      `Created with Reziproq on ${date}. Contains only what your side may see.`,
  },
};

/** Reihenfolge der Abschnitte im Pre-Read */
const sectionOrder = ['scorecard', 'initiatives', 'commitments', 'actions'];

export function preReadFileName(detail: MeetingDetail, locale: PrintLocale): string {
  const kind = detail.meeting.status === 'closed' ? copy[locale].protocol : copy[locale].preRead;
  const day = detail.meeting.startsAt.slice(0, 10);
  return `${kind} ${detail.meeting.title} ${day}.pdf`.replace(/[\\/:*?"<>|]/g, '-');
}

export function preReadHtml(
  detail: MeetingDetail,
  locale: PrintLocale,
  now = new Date(),
  /** QBR-07: übernommene Zusammenfassung der eigenen Seite */
  summary: string | null = null,
): string {
  const t = copy[locale];
  const tag = locale === 'de' ? 'de-DE' : 'en-GB';
  const dateTime = (iso: string) =>
    new Intl.DateTimeFormat(tag, {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Europe/Berlin',
    }).format(new Date(iso));
  const date = (iso: string) =>
    new Intl.DateTimeFormat(tag, { dateStyle: 'medium', timeZone: 'UTC' }).format(
      new Date(`${iso.slice(0, 10)}T00:00:00Z`),
    );
  const closed = detail.meeting.status === 'closed';
  const { meeting } = detail;
  const kind = closed ? t.protocol : t.preRead;
  const h = escapeHtml;

  const participants =
    detail.participants.length === 0
      ? `<p class="empty">${h(t.noParticipants)}</p>`
      : `<ul class="rows">${detail.participants
          .map(
            (person) =>
              `<li><span>${h(person.name)}</span><span class="meta">${h(t.sides[person.side])}</span></li>`,
          )
          .join('')}</ul>`;
  const agenda =
    detail.agenda.length === 0
      ? `<p class="empty">${h(t.none)}</p>`
      : `<ol class="agenda">${[...detail.agenda]
          .sort((a, b) => a.position - b.position)
          .map((item) => `<li>${h(item.title)}</li>`)
          .join('')}</ol>`;

  const sections = [...detail.live.sections]
    .sort((a, b) => sectionOrder.indexOf(a.key) - sectionOrder.indexOf(b.key))
    .map((section) => {
      const statuses = t.statuses[section.key] ?? {};
      const rows =
        section.items.length === 0
          ? `<p class="empty">${h(t.none)}</p>`
          : `<ul class="rows">${section.items
              .map((item) => {
                const meta = [
                  item.status ? (statuses[item.status] ?? item.status) : null,
                  item.detail ?? null,
                  item.dueDate ? t.due(date(item.dueDate)) : null,
                ]
                  .filter(Boolean)
                  .map((part) => h(String(part)))
                  .join(' · ');
                return `<li><span>${h(item.title)}</span><span class="meta">${meta}</span></li>`;
              })
              .join('')}</ul>`;
      return `<section data-section="${h(section.key)}"><h2>${h(t.sections[section.key] ?? section.key)}</h2>${rows}</section>`;
    })
    .join('');

  const decisions =
    closed && detail.decisions.length > 0
      ? `<section><h2>${h(t.decisions)}</h2><ol class="agenda">${[...detail.decisions]
          .sort((a, b) => a.position - b.position)
          .map((item) => `<li>${h(item.text)}</li>`)
          .join('')}</ol></section>`
      : '';
  const protocol =
    closed && detail.meeting.protocol
      ? `<section><h2>${h(t.protocolText)}</h2><p class="protocol">${h(detail.meeting.protocol)}</p></section>`
      : '';
  // Interne Notiz: nur die eigene Organisation bekommt sie aus der API, und sie ist markiert.
  const note = detail.note
    ? `<section class="private" data-section="note"><h2>${h(t.note)}<span class="chip">${h(t.internal)}</span></h2><p class="protocol">${h(detail.note)}</p></section>`
    : '';

  const stand =
    closed && detail.live.frozenAt
      ? t.frozen(dateTime(detail.live.frozenAt))
      : t.current(dateTime(now.toISOString()));

  const body = `
<header class="cover">
  <p class="eyebrow">${h(kind)} · ${h(t.types[meeting.type] ?? meeting.type)}</p>
  <h1>${h(meeting.title)}</h1>
  <p class="facts"><span>${h(dateTime(meeting.startsAt))}</span>${meeting.location ? `<span>${h(meeting.location)}</span>` : ''}<span>${h(stand)}</span></p>
</header>
${summary ? `<section data-section="summary"><h2>${h(t.summary)}</h2><p class="protocol">${h(summary)}</p></section>` : ''}
<section><h2>${h(t.participants)}</h2>${participants}</section>
<section><h2>${h(t.agenda)}</h2>${agenda}</section>
${sections}
${decisions}
${protocol}
${note}
<footer>${h(t.footer(dateTime(now.toISOString())))}</footer>`;

  return printDocument({ lang: locale, title: `${kind}: ${meeting.title}`, body });
}
