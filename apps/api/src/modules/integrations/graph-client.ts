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
}

@Injectable()
export class FakeGraphClient implements GraphClient {
  readonly events = new Map<string, string>();

  async getEventBody(_token: string, eventId: string) {
    return this.events.get(eventId) ?? null;
  }

  async updateEventBody(_token: string, eventId: string, body: string) {
    this.events.set(eventId, body);
  }
}
