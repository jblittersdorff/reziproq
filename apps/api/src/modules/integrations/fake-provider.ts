import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { currentTime, systemTime } from '@reziproq/db';
import type { ConnectorDefinition, ItemKind } from './connectors.js';

/** Ein Element, das ein Anbieter liefert; external_id macht den Abgleich wiederholbar */
export interface ProviderItem {
  externalId: string;
  kind: ItemKind | string;
  relationshipId: string | null;
  text: string;
  /** IN-03: weitere Angaben, z. B. Absender, SPF/DKIM und iCalendar einer Einladung */
  data?: Record<string, unknown> | undefined;
}

export interface ProviderToken {
  token: string;
  expiresAt: Date | null;
}

export interface FetchContext {
  connector: ConnectorDefinition;
  parts: readonly string[];
  /** Persönliche Verbindung (Kalender einer Person) */
  personal: boolean;
  /** Beziehungen der Organisation mit Name und Mail-Domains, damit fake Beispiele bauen kann */
  relationships: readonly { id: string; name: string; domains: string[] }[];
}

/** Was jeder Anbieter können muss; der echte Anbieter einer Anbindung kommt mit IN-02 bis IN-07 */
export interface ConnectorProvider {
  authorize(connector: ConnectorDefinition): Promise<ProviderToken>;
  refresh(connector: ConnectorDefinition, token: string): Promise<ProviderToken>;
  revoke(connector: ConnectorDefinition, token: string): Promise<void>;
  fetch(context: FetchContext, token: string): Promise<ProviderItem[]>;
}

/**
 * Anbieter fake für alle Anbindungen: ohne Netzwerk, mit festen Beispielen. Tests steuern ihn über
 * nextItems, failRefresh und beforeItem.
 */
@Injectable()
export class FakeProvider implements ConnectorProvider {
  /** Ersetzt die Beispiele beim nächsten Abgleich */
  nextItems: ProviderItem[] | null = null;
  failRefresh = false;
  /** Wird vor jedem Element aufgerufen, z. B. um mitten im Job zu trennen */
  beforeItem: ((index: number) => Promise<void>) | null = null;
  readonly revoked: string[] = [];
  /** Alle ausgegebenen Tokens, damit Tests prüfen, dass keines im Klartext auftaucht */
  readonly issued: string[] = [];

  async authorize(connector: ConnectorDefinition): Promise<ProviderToken> {
    return this.token(connector);
  }

  async refresh(connector: ConnectorDefinition, _token: string): Promise<ProviderToken> {
    if (this.failRefresh) throw new Error('refresh_failed');
    return this.token(connector);
  }

  async revoke(_connector: ConnectorDefinition, token: string): Promise<void> {
    this.revoked.push(token);
  }

  async fetch(context: FetchContext, _token: string): Promise<ProviderItem[]> {
    if (this.nextItems) {
      const items = this.nextItems;
      this.nextItems = null;
      return items;
    }
    const { connector } = context;
    // IN-03: Kalender einer Person: ein Termin mit einem Lieferanten in drei Tagen
    if (context.personal && context.parts.includes('calendar')) {
      const supplier = context.relationships.find((entry) => entry.domains.length > 0);
      if (!supplier) return [];
      const start = new Date(currentTime().getTime() + 3 * 86_400_000);
      start.setUTCHours(9, 0, 0, 0);
      return [
        {
          externalId: `${connector.key}-kalender-${supplier.id}`,
          kind: 'calendar_event',
          relationshipId: null,
          text: '',
          data: {
            uid: `fake-${connector.key}-${supplier.id}@reziproq.test`,
            sequence: 0,
            subject: `Abstimmung mit ${supplier.name}`,
            startsAt: start.toISOString(),
            endsAt: new Date(start.getTime() + 3_600_000).toISOString(),
            attendees: [{ email: `einkauf@${supplier.domains[0]}`, name: null, response: null }],
          },
        },
      ];
    }
    if (!connector.items.includes('note')) {
      return [
        {
          externalId: `${connector.key}-beispiel-1`,
          kind: 'delivery',
          relationshipId: null,
          text: '',
        },
      ];
    }
    const [first, second] = context.relationships;
    const items: ProviderItem[] = [];
    if (first) {
      items.push({
        externalId: `${connector.key}-beispiel-1`,
        kind: 'note',
        relationshipId: first.id,
        text: `Beispiel aus der Anbindung (fake): Mail von ${first.name} zum Liefertermin.`,
      });
    }
    if (second) {
      items.push({
        externalId: `${connector.key}-beispiel-2`,
        kind: 'note',
        relationshipId: second.id,
        text: `Beispiel aus der Anbindung (fake): Termin mit ${second.name} vereinbart.`,
      });
    }
    // Ein Element ohne bekannte Beziehung zeigt, dass ein Fehler den Job nicht stoppt
    items.push({
      externalId: `${connector.key}-beispiel-3`,
      kind: 'note',
      relationshipId: null,
      text: 'Beispiel aus der Anbindung (fake): Mail eines unbekannten Absenders.',
    });
    return items;
  }

  private token(connector: ConnectorDefinition): ProviderToken {
    const token = `fake-${connector.key}-${randomBytes(16).toString('hex')}`;
    this.issued.push(token);
    return {
      token,
      expiresAt:
        connector.secretKind === 'oauth' ? new Date(systemTime().getTime() + 60 * 60 * 1000) : null,
    };
  }
}
