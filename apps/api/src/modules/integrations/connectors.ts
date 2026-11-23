import type { ConnectorKey } from '@reziproq/shared';

/**
 * IN-01: Registry der Anbindungen, nach dem Muster der Werkzeug-Registry aus KI-04. Ein Eintrag
 * nennt Teile, Rechte beim Anbieter, Art der Zugangsdaten, ob Webhooks ankommen, welche Elemente
 * er auf das Datenmodell abbildet und wie lange Rohdaten bleiben. Die echten Anbieter kommen mit
 * IN-02 bis IN-07; bis dahin gibt es für jede Anbindung nur den Anbieter fake.
 */

/** Elemente, die eine Anbindung liefert, und der Domänendienst, über den sie entstehen */
export type ItemKind = 'note' | 'calendar_invite' | 'calendar_event' | 'forwarded_mail';

export interface ConnectorDefinition {
  key: ConnectorKey;
  group: 'workplace' | 'purchasing';
  /** Stufe 2 ist ausgegraut („kommt später“) und lässt sich nicht verbinden */
  stage: 1 | 2;
  parts: readonly string[];
  /** Teile, die beim Verbinden an sind */
  defaultParts: readonly string[];
  /** Auch als eigene Verbindung einer Person (Kalender, Outlook-Add-in) */
  personal: boolean;
  /** Rechte, die die Anbindung beim Anbieter anfragt */
  scopes: readonly string[];
  secretKind: 'oauth' | 'api_key' | 'webhook_secret';
  /** Eingehende Webhooks an /api/anbindungen/eingang/:token */
  webhook: boolean;
  /** Elemente, die die Anbindung abbildet; andere werden mit ignored protokolliert */
  items: readonly ItemKind[];
  /** Aufbewahrung übertragener Rohdaten in Tagen; IN-01 speichert keine Rohdaten */
  retentionDays: number;
}

export const connectors: readonly ConnectorDefinition[] = [
  {
    key: 'microsoft365',
    group: 'workplace',
    stage: 1,
    parts: ['login', 'calendar', 'outlook', 'teams', 'transcripts'],
    defaultParts: ['login', 'calendar'],
    personal: true,
    scopes: ['openid', 'Calendars.Read', 'Calendars.ReadWrite', 'Mail.Read'],
    secretKind: 'oauth',
    webhook: true,
    items: ['note', 'calendar_event'],
    retentionDays: 30,
  },
  {
    key: 'inbound_mail',
    group: 'workplace',
    stage: 1,
    parts: ['meetings', 'notes'],
    defaultParts: ['meetings', 'notes'],
    personal: false,
    scopes: [],
    secretKind: 'webhook_secret',
    webhook: true,
    // IN-04: forwarded_mail kommt über notizen@<kunde>.reziproq.de
    items: ['note', 'calendar_invite', 'forwarded_mail'],
    retentionDays: 30,
  },
  {
    key: 'google_workspace',
    group: 'workplace',
    stage: 1,
    parts: ['login', 'calendar', 'meet', 'drive'],
    defaultParts: ['login', 'calendar'],
    personal: true,
    scopes: ['openid', 'calendar.readonly'],
    secretKind: 'oauth',
    webhook: true,
    items: ['note', 'calendar_event'],
    retentionDays: 30,
  },
  {
    key: 'slack',
    group: 'workplace',
    stage: 2,
    parts: ['hints', 'commitments', 'drafts'],
    defaultParts: [],
    personal: false,
    scopes: [],
    secretKind: 'oauth',
    webhook: true,
    items: [],
    retentionDays: 0,
  },
  {
    key: 'zoom',
    group: 'workplace',
    stage: 2,
    parts: ['transcripts'],
    defaultParts: [],
    personal: false,
    scopes: [],
    secretKind: 'oauth',
    webhook: true,
    items: [],
    retentionDays: 0,
  },
  {
    key: 'import_api',
    group: 'purchasing',
    stage: 1,
    parts: ['spend', 'suppliers'],
    defaultParts: ['spend', 'suppliers'],
    personal: false,
    scopes: [],
    secretKind: 'api_key',
    webhook: true,
    // Spend und Lieferantenstamm bildet IN-04 über den Import aus KI-15 ab
    items: [],
    retentionDays: 30,
  },
  {
    key: 'files',
    group: 'purchasing',
    stage: 1,
    parts: ['upload'],
    defaultParts: ['upload'],
    personal: false,
    scopes: [],
    secretKind: 'api_key',
    webhook: false,
    items: [],
    retentionDays: 30,
  },
  {
    key: 'sap_s4',
    group: 'purchasing',
    stage: 2,
    parts: ['orders', 'receipts', 'contracts'],
    defaultParts: [],
    personal: false,
    scopes: [],
    secretKind: 'oauth',
    webhook: false,
    items: [],
    retentionDays: 0,
  },
];

export function connectorOf(key: string): ConnectorDefinition | undefined {
  return connectors.find((entry) => entry.key === key);
}
