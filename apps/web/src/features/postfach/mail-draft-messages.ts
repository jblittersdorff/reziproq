import { defineMessages } from '@/lib/i18n';

// PO-01 (K2-d.3b): Texte der Seite „Zusagen aus Mail“ (Vorlage K2-Mail-Zusage). Die Seite öffnet
// aus Heute (E-K0-27); Freigeben und senden kommt mit K2-d.4.

const countDe = (count: number) =>
  ['Keine', 'Eine', 'Zwei', 'Drei', 'Vier', 'Fünf'][count] ?? String(count);
const countEn = (count: number) =>
  ['No', 'One', 'Two', 'Three', 'Four', 'Five'][count] ?? String(count);

export const mailDraftMessages = defineMessages({
  de: {
    back: 'Heute',
    loading: 'Der Entwurf lädt',
    failed: 'Der Entwurf ließ sich nicht laden.',
    missing: 'Diesen Entwurf gibt es nicht oder nicht für dich.',
    retry: 'Erneut versuchen',
    title: (name: string) => `Zusagen aus der Mail von ${name} freigeben`,
    where: (counterpart: string, time: string) => `${counterpart} · Mail seit ${time}`,
    heading: (time: string) => `Entwurf von Reziproq · ${time}`,
    sources: 'Quellen',
    sourceMail: 'Mail',
    sourceCommitments: 'Zusagen',
    context: (counterpart: string, byReziproq: boolean) =>
      `${counterpart} · Postfach · ${byReziproq ? 'zugeordnet von Reziproq' : 'zugeordnet von Hand'}`,
    task: (count: number, name: string) =>
      `${countDe(count)} ${count === 1 ? 'Zusage' : 'Zusagen'} aus der Mail von ${name} eintragen und antworten`,
    mailTitle: (name: string, time: string) => `Mail von ${name}, ${time} · zusammengefasst`,
    mailOnly: 'nur für dich',
    noSummary: 'Ohne Zusammenfassung; der Text steht im Verlauf der Akte.',
    middle: 'Das kommt in die Mitte',
    commitmentTitle: (title: string, due: string | null) => (due ? `${title} bis ${due}` : title),
    ownSide: 'eure Seite',
    replaces: (date: string, overdue: boolean) =>
      overdue ? `ersetzt die überfällige Zusage vom ${date}` : `statt ${date}`,
    fresh: 'neue Zusage, gilt erst mit deiner Freigabe',
    reply: (organization: string) => `Antwort im Ton von ${organization}`,
    shorter: 'Kürzer',
    formal: 'Förmlicher',
    english: 'Auf Englisch',
    approve: 'Freigeben und senden',
    approveLater: 'Freigeben und senden kommt mit dem nächsten Schritt (K2-d.4).',
    adjust: 'Anpassen',
    discard: 'Verwerfen',
    save: 'Speichern',
    cancel: 'Abbrechen',
    owner: 'Person',
    due: 'Frist',
    replyLabel: 'Antwort',
    reason: 'Warum verwerfen?',
    discardYes: 'Ja, verwerfen',
    saved: 'Gespeichert.',
    discarded: (reason: string) => `Verworfen: ${reason}`,
    accepted: 'Freigegeben.',
    readOnly: 'Ansehen ja, anpassen nur mit dem Recht für Zusagen in dieser Beziehung.',
    next: 'So geht es weiter',
    stepAssigned: 'Mail zugeordnet',
    stepAssignedDetail: (time: string, counterpart: string) => `${time} · Postfach, ${counterpart}`,
    stepApprove: 'Du gibst frei',
    stepApproveDetail: (owner: string | null) =>
      owner ? `die Zusage von ${owner} braucht dich` : 'Antwort und Zusagen gehen erst danach raus',
    stepConfirm: (counterpart: string) => `${counterpart} bestätigt`,
    stepConfirmDetail: (names: string) =>
      `${names} ${names.includes(' und ') ? 'bekommen' : 'bekommt'} einen Link`,
    stepCount: 'Quote zählt',
    stepCountDetail: 'erst bestätigte Zusagen gehen in den Spiegel',
    today: 'Was sich in Heute ändert',
    todayOverdue: (title: string) => `„${title}“ hat wieder eine Frist.`,
    todayOverdueDetail: (due: string) =>
      `Bis ${due}; verstreicht sie, meldet Reziproq sich erneut.`,
    todayNone: 'Die Zusagen stehen nach der Bestätigung in der Akte und zählen in der Quote.',
    guardrail: 'Leitplanke',
    guardrailChip: 'immer',
    guardrailText: (owner: string | null) =>
      owner
        ? `Eine Zusage eurer Seite gibt nur ein Mensch. ${owner} bekommt sie nach der Freigabe als Aufgabe in Heute.`
        : 'Eine Zusage eurer Seite gibt nur ein Mensch; Reziproq sendet nichts ohne deine Freigabe.',
  },
  en: {
    back: 'Today',
    loading: 'Loading the draft',
    failed: 'The draft could not be loaded.',
    missing: 'This draft does not exist or is not yours to see.',
    retry: 'Try again',
    title: (name: string) => `Approve the commitments from ${name}'s mail`,
    where: (counterpart: string, time: string) => `${counterpart} · mail since ${time}`,
    heading: (time: string) => `Draft by Reziproq · ${time}`,
    sources: 'Sources',
    sourceMail: 'Mail',
    sourceCommitments: 'Commitments',
    context: (counterpart: string, byReziproq: boolean) =>
      `${counterpart} · Inbox · ${byReziproq ? 'assigned by Reziproq' : 'assigned by hand'}`,
    task: (count: number, name: string) =>
      `Record ${countEn(count).toLowerCase()} ${count === 1 ? 'commitment' : 'commitments'} from ${name}'s mail and reply`,
    mailTitle: (name: string, time: string) => `Mail from ${name}, ${time} · summarised`,
    mailOnly: 'only you',
    noSummary: 'No summary; the text is in the history of the file.',
    middle: 'What goes into the middle',
    commitmentTitle: (title: string, due: string | null) => (due ? `${title} by ${due}` : title),
    ownSide: 'your side',
    replaces: (date: string, overdue: boolean) =>
      overdue ? `replaces the overdue commitment of ${date}` : `instead of ${date}`,
    fresh: 'new commitment, only valid with your approval',
    reply: (organization: string) => `Reply in the tone of ${organization}`,
    shorter: 'Shorter',
    formal: 'More formal',
    english: 'In English',
    approve: 'Approve and send',
    approveLater: 'Approve and send comes with the next step (K2-d.4).',
    adjust: 'Adjust',
    discard: 'Discard',
    save: 'Save',
    cancel: 'Cancel',
    owner: 'Person',
    due: 'Due',
    replyLabel: 'Reply',
    reason: 'Why discard?',
    discardYes: 'Yes, discard',
    saved: 'Saved.',
    discarded: (reason: string) => `Discarded: ${reason}`,
    accepted: 'Approved.',
    readOnly: 'You can view this; adjusting needs the right for commitments in this relationship.',
    next: 'What happens next',
    stepAssigned: 'Mail assigned',
    stepAssignedDetail: (time: string, counterpart: string) => `${time} · inbox, ${counterpart}`,
    stepApprove: 'You approve',
    stepApproveDetail: (owner: string | null) =>
      owner ? `${owner}'s commitment needs you` : 'reply and commitments only go out afterwards',
    stepConfirm: (counterpart: string) => `${counterpart} confirms`,
    stepConfirmDetail: (names: string) =>
      `${names} ${names.includes(' and ') ? 'get' : 'gets'} a link`,
    stepCount: 'Quota counts',
    stepCountDetail: 'only confirmed commitments go into the mirror',
    today: 'What changes in Today',
    todayOverdue: (title: string) => `“${title}” has a due date again.`,
    todayOverdueDetail: (due: string) => `By ${due}; if it passes, Reziproq will remind you again.`,
    todayNone: 'After confirmation the commitments are in the file and count in the quota.',
    guardrail: 'Guardrail',
    guardrailChip: 'always',
    guardrailText: (owner: string | null) =>
      owner
        ? `Only a person gives a commitment for your side. ${owner} gets it as a task in Today after approval.`
        : 'Only a person gives a commitment for your side; Reziproq sends nothing without your approval.',
  },
});
