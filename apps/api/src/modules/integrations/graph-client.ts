import { Injectable } from '@nestjs/common';

/**
 * IN-03: Beschreibung eines Termins im Kalender des Organisators lesen und schreiben (Microsoft
 * Graph, delegierte Rechte). Der echte Client kommt mit der Freischaltung von Graph; bis dahin der
 * Nachbau ohne Netzwerk, in dem Tests Termine anlegen und lesen.
 */
export const GRAPH_CLIENT = Symbol('GRAPH_CLIENT');

export interface GraphClient {
  getEventBody(token: string, eventId: string): Promise<string | null>;
  updateEventBody(token: string, eventId: string, body: string): Promise<void>;
  /** IN-04: genau eine Mail mit Anhängen (Inhalt der Dateien Base64) */
  getMessage(token: string, messageId: string): Promise<GraphMessage | null>;
}

export interface GraphMessage {
  internetMessageId: string;
  subject: string;
  from: { email: string; name: string | null };
  to: string[];
  cc: string[];
  sentAt: string;
  body: string;
  bodyIsHtml: boolean;
  attachments: { name: string; contentType: string; size: number; contentBytes: string | null }[];
}

@Injectable()
export class FakeGraphClient implements GraphClient {
  readonly events = new Map<string, string>();
  readonly messages = new Map<string, GraphMessage>();
  /** Welche Mails gelesen wurden (IN-04: nur nach einem Klick) */
  readonly messageReads: string[] = [];

  async getMessage(_token: string, messageId: string) {
    this.messageReads.push(messageId);
    return this.messages.get(messageId) ?? null;
  }

  async getEventBody(_token: string, eventId: string) {
    return this.events.get(eventId) ?? null;
  }

  async updateEventBody(_token: string, eventId: string, body: string) {
    this.events.set(eventId, body);
  }
}
