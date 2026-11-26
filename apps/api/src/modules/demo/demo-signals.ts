import { hollmannPeople, supplierPeople } from '@reziproq/db';
import type { DemoSignalKey } from '@reziproq/shared';
import type { ProviderItem } from '../integrations/fake-provider.js';

// DM-01 (K1-g.4): Signale der Regie. Jedes geht durch dieselben Dienste wie das echte Ereignis im
// Betrieb (T1-DM4). „Mail von Kim Kaiser“ ist eine Mail, die Jan-Luka an die Eingangsadresse
// weiterleitet; das Postfach ordnet sie nach seiner Stufe zu: auf Erledigen selbst (Erledigt), auf
// Vorbereiten als Entwurf in Kurz prüfen (Drehbuch K1, Schritt 8). Text wie in DM-01, Kapitel 2.

export interface ForwardSignal {
  kind: 'forwarded_mail';
  /** Person des Demo-Mandanten, die weiterleitet */
  forwardedBy: string;
  subject: string;
  from: { name: string; email: string };
  body: string;
}

export const demoSignals: Record<DemoSignalKey, ForwardSignal> = {
  mail_kim_kaiser: {
    kind: 'forwarded_mail',
    forwardedBy: hollmannPeople.janLuka.id,
    subject: 'Musterteile Starrflex und 8D 4711',
    from: { name: supplierPeople.kimKaiser.name, email: supplierPeople.kimKaiser.email },
    body: 'Hallo Herr von Blittersdorff, die Musterteile Starrflex können wir bis 11.12. liefern, wenn wir Ihre Zeichnung Rev. C bis 30.11. haben. Den 8D-Bericht zur Charge 4711 schickt Herr Ott bis Freitag. Viele Grüße Kim Kaiser',
  },
};

/** Die weitergeleitete Mail, wie sie an der Eingangsadresse ankommt (mit SPF und DKIM) */
export function forwardedItem(
  signal: ForwardSignal,
  forwarderEmail: string,
  externalId: string,
): ProviderItem {
  return {
    externalId,
    kind: signal.kind,
    relationshipId: null,
    text: signal.body,
    data: {
      from: forwarderEmail,
      spf: 'pass',
      dkim: 'pass',
      subject: `WG: ${signal.subject}`,
      messageId: `<${externalId}@${forwarderEmail.split('@')[1]}>`,
      text: `-----Ursprüngliche Nachricht-----\nVon: ${signal.from.name} <${signal.from.email}>\nAn: ${forwarderEmail}\nBetreff: ${signal.subject}\n\n${signal.body}`,
    },
  };
}
