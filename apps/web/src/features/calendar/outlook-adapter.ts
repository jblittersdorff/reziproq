import { appNow } from '@/lib/clock';

/**
 * IN-03: Zugriff des Add-ins auf den Termin in Bearbeitung (Office.js). Außerhalb von Outlook
 * (Vorschau, Tests) gilt ein Beispieltermin; geschrieben wird dann nichts.
 * IN-04: In einer gelesenen Mail liefert read() die Mail (Absender, Empfänger, ID für Graph).
 */
export interface OutlookItem {
  mode?: 'appointment';
  organizerEmail: string;
  subject: string;
  startAt: string;
  attendees: string[];
}

export interface OutlookMessage {
  mode: 'message';
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  /** ID der Nachricht für Microsoft Graph (REST v2.0) */
  itemId: string;
}

export interface OutlookAdapter {
  preview: boolean;
  read(): Promise<OutlookItem | OutlookMessage | null>;
  /** Eingangsadresse als Teilnehmer setzen und den Termin speichern; gibt die ID des Termins */
  addAttendeeAndSave(email: string): Promise<string | null>;
  /** Hinweis zum Transkript an den Anfang der Einladung */
  prependBody(text: string): Promise<void>;
}

const officeScript = 'https://appsforoffice.microsoft.com/lib/1/hosted/office.js';

type AsyncResult<T> = { status: string; value: T };
type OfficeItem = {
  subject: { getAsync(callback: (result: AsyncResult<string>) => void): void };
  start: { getAsync(callback: (result: AsyncResult<Date>) => void): void };
  organizer?: { getAsync(callback: (result: AsyncResult<{ emailAddress: string }>) => void): void };
  requiredAttendees: {
    getAsync(callback: (result: AsyncResult<{ emailAddress: string }[]>) => void): void;
    addAsync(recipients: string[], callback: (result: AsyncResult<unknown>) => void): void;
  };
  optionalAttendees?: {
    getAsync(callback: (result: AsyncResult<{ emailAddress: string }[]>) => void): void;
  };
  body: {
    prependAsync(
      text: string,
      options: { coercionType: string },
      callback: (result: AsyncResult<unknown>) => void,
    ): void;
  };
  saveAsync(callback: (result: AsyncResult<string>) => void): void;
};
/** Gelesene Mail: Felder sind Werte, keine asynchronen Aufrufe (Office.js, Lesemodus) */
type OfficeMessage = {
  itemType: string;
  itemId: string;
  subject: string;
  from?: { emailAddress: string };
  to?: { emailAddress: string }[];
  cc?: { emailAddress: string }[];
};
type OfficeGlobal = {
  onReady(): Promise<unknown>;
  context?: {
    mailbox?: {
      item?: OfficeItem | OfficeMessage;
      userProfile?: { emailAddress: string };
      convertToRestId?(itemId: string, version: string): string;
    };
  };
};

const call = <T>(work: (callback: (result: AsyncResult<T>) => void) => void) =>
  new Promise<T>((resolve, reject) =>
    work((result) => (result.status === 'succeeded' ? resolve(result.value) : reject(result))),
  );

async function loadOffice(): Promise<OfficeGlobal | null> {
  const existing = (window as unknown as { Office?: OfficeGlobal }).Office;
  if (existing) return existing;
  // Nur im Aufgabenbereich von Outlook (in einem Frame); sonst nie ein fremdes Skript laden
  if (window.parent === window) return null;
  await new Promise<void>((resolve) => {
    const script = document.createElement('script');
    script.src = officeScript;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.append(script);
  });
  return (window as unknown as { Office?: OfficeGlobal }).Office ?? null;
}

function previewAdapter(): OutlookAdapter {
  const start = new Date(appNow().getTime() + 2 * 86_400_000);
  start.setHours(10, 0, 0, 0);
  return {
    preview: true,
    read: async () => ({
      organizerEmail: '',
      subject: 'QBR Q4',
      startAt: start.toISOString(),
      attendees: [],
    }),
    addAttendeeAndSave: async () => null,
    prependBody: async () => undefined,
  };
}

export async function outlookAdapter(): Promise<OutlookAdapter> {
  const office = await loadOffice();
  if (!office) return previewAdapter();
  await office.onReady();
  const mailbox = office.context?.mailbox;
  const current = mailbox?.item;
  if (!current) return previewAdapter();
  if ('itemType' in current && current.itemType === 'message') {
    const message = current;
    return {
      preview: false,
      read: async () => ({
        mode: 'message',
        subject: message.subject ?? '',
        from: message.from?.emailAddress ?? '',
        to: (message.to ?? []).map((entry) => entry.emailAddress),
        cc: (message.cc ?? []).map((entry) => entry.emailAddress),
        itemId: mailbox?.convertToRestId
          ? mailbox.convertToRestId(message.itemId, 'v2.0')
          : message.itemId,
      }),
      addAttendeeAndSave: async () => null,
      prependBody: async () => undefined,
    };
  }
  const item = current as OfficeItem;
  const me = mailbox?.userProfile?.emailAddress ?? '';
  return {
    preview: false,
    async read() {
      const [subject, start, required, optional, organizer] = await Promise.all([
        call<string>((done) => item.subject.getAsync(done)),
        call<Date>((done) => item.start.getAsync(done)),
        call<{ emailAddress: string }[]>((done) => item.requiredAttendees.getAsync(done)),
        item.optionalAttendees
          ? call<{ emailAddress: string }[]>((done) => item.optionalAttendees?.getAsync(done))
          : Promise.resolve([]),
        item.organizer
          ? call<{ emailAddress: string }>((done) => item.organizer?.getAsync(done)).catch(
              () => null,
            )
          : Promise.resolve(null),
      ]);
      return {
        organizerEmail: organizer?.emailAddress ?? me,
        subject,
        startAt: new Date(start).toISOString(),
        attendees: [...required, ...optional].map((entry) => entry.emailAddress),
      };
    },
    async addAttendeeAndSave(email) {
      await call((done) => item.requiredAttendees.addAsync([email], done));
      return call<string>((done) => item.saveAsync(done)).catch(() => null);
    },
    async prependBody(text) {
      await call((done) => item.body.prependAsync(`${text}\n\n`, { coercionType: 'text' }, done));
    },
  };
}
