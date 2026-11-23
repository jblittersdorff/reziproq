import { Injectable } from '@nestjs/common';

/**
 * IN-06: Persönlicher Bot in Teams, der Adaptive Cards sendet. Der echte Client braucht eine
 * Bot-Registrierung bei Microsoft (Durchstich, Block C); bis dahin der Nachbau ohne Netzwerk, in dem
 * Tests Karten lesen.
 */
export const TEAMS_CLIENT = Symbol('TEAMS_CLIENT');

/** Karte: Titel als Aussage, eine Zeile Kontext, höchstens zwei Knöpfe und „In Reziproq öffnen“ */
export interface TeamsCard {
  title: string;
  line: string | null;
  buttons: { action: string; label: string; notificationId: string }[];
  openUrl: string;
  openLabel: string;
}

export interface TeamsClient {
  /** Sendet eine Karte, liefert den Verweis auf die Nachricht */
  send(conversationRef: string, card: TeamsCard): Promise<string>;
  /** Ersetzt eine gesendete Karte, z. B. beim Bündeln */
  update(conversationRef: string, messageRef: string, card: TeamsCard): Promise<void>;
}

/** Adaptive Card (Schema 1.5) zu einer Karte; so geht sie an Teams */
export function adaptiveCard(card: TeamsCard) {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      { type: 'TextBlock', text: card.title, weight: 'Bolder', wrap: true },
      ...(card.line ? [{ type: 'TextBlock', text: card.line, wrap: true, isSubtle: true }] : []),
    ],
    actions: [
      ...card.buttons.slice(0, 2).map((button) => ({
        type: 'Action.Submit',
        title: button.label,
        data: { action: button.action, notificationId: button.notificationId },
      })),
      { type: 'Action.OpenUrl', title: card.openLabel, url: card.openUrl },
    ],
  };
}

@Injectable()
export class FakeTeamsClient implements TeamsClient {
  /** Gesendete Karten je Nachricht, mit der Zahl der Änderungen */
  readonly messages = new Map<
    string,
    { conversationRef: string; card: TeamsCard; updates: number }
  >();
  private next = 0;

  async send(conversationRef: string, card: TeamsCard) {
    this.next += 1;
    const ref = `fake-msg-${this.next}`;
    this.messages.set(ref, { conversationRef, card, updates: 0 });
    return ref;
  }

  async update(conversationRef: string, messageRef: string, card: TeamsCard) {
    const existing = this.messages.get(messageRef);
    this.messages.set(messageRef, {
      conversationRef,
      card,
      updates: (existing?.updates ?? 0) + 1,
    });
  }

  /** Karten an eine Person (über ihren Gesprächsverweis) */
  cardsFor(conversationRef: string) {
    return [...this.messages.values()].filter((entry) => entry.conversationRef === conversationRef);
  }
}
