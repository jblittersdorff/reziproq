import { type EmailContent, emailContentSchema } from './email.schema.js';

const copy = {
  de: {
    invitation: {
      subject: 'Einladung',
      body: 'Du wurdest eingeladen, Reziproq zu verwenden.',
      deadline: 'Frist',
      link: 'Einladung öffnen',
    },
    reminder: {
      subject: 'Erinnerung',
      body: 'Bitte denke an die folgende Aufgabe in Reziproq.',
      deadline: 'Frist',
      link: 'Aufgabe öffnen',
    },
    approval: {
      subject: 'Freigabe erforderlich',
      body: 'Für den folgenden Vorgang wird deine Freigabe benötigt.',
      deadline: 'Frist',
      link: 'Freigabe öffnen',
    },
    supplier_invitation: {
      subject: 'Einladung zur Zusammenarbeit',
      body: 'In Reziproq arbeitet ihr gemeinsam an eurer Beziehung. Du brauchst nur deinen Namen und einen Passkey, kein Passwort.',
      deadline: 'Der Link gilt bis',
      link: 'Einladung annehmen',
    },
    survey: {
      subject: 'Deine Einschätzung zur Zusammenarbeit',
      body: 'Wie läuft die Zusammenarbeit, und wie sollte sie sein? Die Fragen dauern nur wenige Minuten. Deine Antworten bleiben anonym: Niemand sieht, wer was geantwortet hat. Du brauchst kein Konto.',
      deadline: 'Bitte antworten bis',
      link: 'Fragen beantworten',
    },
    mention: {
      subject: 'Du wurdest erwähnt',
      body: 'Jemand hat dich in einem Kommentar erwähnt. Den Kommentar siehst du in Reziproq.',
      deadline: 'Frist',
      link: 'Kommentar öffnen',
    },
    export_ready: {
      subject: 'Dein Gesamtexport ist fertig',
      body: 'Der Gesamtexport deiner Organisation liegt bereit. Du kannst ihn 24 Stunden lang in Reziproq herunterladen.',
      deadline: 'Abrufbar bis',
      link: 'Export öffnen',
    },
    escalation: {
      subject: 'Eskalation',
      body: 'Der folgende Vorgang benötigt deine Aufmerksamkeit.',
      deadline: 'Frist',
      link: 'Vorgang öffnen',
    },
    // IN-06: nur Titel und Link, nie private Inhalte
    notification: {
      subject: 'Reziproq',
      body: 'In Reziproq wartet etwas auf dich.',
      deadline: 'Frist',
      link: 'In Reziproq öffnen',
    },
    digest: {
      subject: 'Dein Tag in Reziproq',
      body: 'Das Wichtigste für heute, kurz zusammengefasst.',
      deadline: 'Stand',
      link: 'Mein Tag öffnen',
    },
    // ZQ-01 Regel 5 (K2-b.6, E-K1-5): Die Mail sagt, dass Reziproq sie im Auftrag des Kunden schickt
    commitment_followup: {
      subject: 'Erinnerung von Reziproq',
      body: 'Bitte denkt an die folgende Zusage. Ist sie schon erfüllt, tragt es mit Beleg in Reziproq ein.',
      deadline: 'Frist',
      link: 'Zusage öffnen',
    },
  },
  en: {
    invitation: {
      subject: 'Invitation',
      body: 'You have been invited to use Reziproq.',
      deadline: 'Due date',
      link: 'Open invitation',
    },
    reminder: {
      subject: 'Reminder',
      body: 'Please remember the following task in Reziproq.',
      deadline: 'Due date',
      link: 'Open task',
    },
    approval: {
      subject: 'Approval required',
      body: 'Your approval is needed for the following item.',
      deadline: 'Due date',
      link: 'Open approval',
    },
    supplier_invitation: {
      subject: 'Invitation to collaborate',
      body: 'In Reziproq you work together on your relationship. All you need is your name and a passkey, no password.',
      deadline: 'The link is valid until',
      link: 'Accept invitation',
    },
    survey: {
      subject: 'Your view on our collaboration',
      body: 'How is the collaboration going, and how should it be? The questions take only a few minutes. Your answers stay anonymous: nobody sees who answered what. You do not need an account.',
      deadline: 'Please answer by',
      link: 'Answer the questions',
    },
    mention: {
      subject: 'You were mentioned',
      body: 'Someone mentioned you in a comment. You can read the comment in Reziproq.',
      deadline: 'Due date',
      link: 'Open comment',
    },
    export_ready: {
      subject: 'Your full export is ready',
      body: 'The full export of your organisation is ready. You can download it in Reziproq for 24 hours.',
      deadline: 'Available until',
      link: 'Open export',
    },
    escalation: {
      subject: 'Escalation',
      body: 'The following item needs your attention.',
      deadline: 'Due date',
      link: 'Open item',
    },
    notification: {
      subject: 'Reziproq',
      body: 'Something is waiting for you in Reziproq.',
      deadline: 'Due date',
      link: 'Open in Reziproq',
    },
    digest: {
      subject: 'Your day in Reziproq',
      body: 'The most important things for today, in brief.',
      deadline: 'As of',
      link: 'Open My day',
    },
    commitment_followup: {
      subject: 'Reminder from Reziproq',
      body: 'Please remember the following commitment. If it is already fulfilled, record it with evidence in Reziproq.',
      deadline: 'Due date',
      link: 'Open commitment',
    },
  },
} as const;

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export function buildEmailLink(webAppUrl: string, path: string): string {
  const safePath = emailContentSchema.shape.link.parse(path);
  const base = new URL(webAppUrl);
  if (base.protocol !== 'https:' && base.protocol !== 'http:') {
    throw new Error('WEB_APP_URL muss HTTP oder HTTPS verwenden.');
  }
  const url = new URL(safePath, base);
  if (url.origin !== base.origin) throw new Error('E-Mail-Link verweist nicht auf Reziproq.');
  return url.toString();
}

export function renderEmail(content: EmailContent, webAppUrl: string) {
  const safe = emailContentSchema.parse(content);
  const language = copy[safe.locale][safe.template];
  const url = buildEmailLink(webAppUrl, safe.link);
  const greeting = safe.firstName
    ? safe.locale === 'de'
      ? `Hallo ${safe.firstName},`
      : `Hello ${safe.firstName},`
    : safe.locale === 'de'
      ? 'Hallo,'
      : 'Hello,';
  const deadlineText = safe.deadline ? `${language.deadline}: ${safe.deadline}` : '';
  // Einladung eines Lieferanten (LIF-01): Wer einlädt, steht vor dem Kunden im Titel. Erinnerung an
  // eine Zusage (K2-b.6): die Kennzeichnung als Nachricht von Reziproq im Auftrag des Kunden.
  const senderText = !safe.sender
    ? ''
    : safe.template === 'commitment_followup'
      ? safe.locale === 'de'
        ? `Nachricht von Reziproq im Auftrag von ${safe.sender}.`
        : `Message from Reziproq on behalf of ${safe.sender}.`
      : safe.locale === 'de'
        ? `${safe.sender} von ${safe.title} lädt dich ein.`
        : `${safe.sender} from ${safe.title} invites you.`;
  // Bei der Einladung steht der Kunde schon im Satz; sonst kommt der Titel als eigene Zeile
  const titleLine = senderText && safe.template !== 'commitment_followup' ? '' : safe.title;
  const text = [
    greeting,
    senderText,
    language.body,
    safe.message ?? '',
    titleLine,
    deadlineText,
    `${language.link}: ${url}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  const deadlineHtml = safe.deadline
    ? `<p>${escapeHtml(language.deadline)}: ${escapeHtml(safe.deadline)}</p>`
    : '';

  return {
    subject: `${language.subject}: ${safe.title}`,
    text,
    html: [
      `<html lang="${safe.locale}"><body>`,
      `<p>${escapeHtml(greeting)}</p>`,
      senderText ? `<p>${escapeHtml(senderText)}</p>` : '',
      `<p>${escapeHtml(language.body)}</p>`,
      `<h1>${escapeHtml(safe.title)}</h1>`,
      safe.message
        ? `<blockquote>${safe.message
            .split(/\r?\n/u)
            .map((line) => escapeHtml(line))
            .join('<br>')}</blockquote>`
        : '',
      deadlineHtml,
      `<p><a href="${escapeHtml(url)}">${escapeHtml(language.link)}</a></p>`,
      '</body></html>',
    ].join(''),
  };
}
