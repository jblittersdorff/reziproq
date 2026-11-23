import { Injectable } from '@nestjs/common';
import type { AuthContext } from '../auth/auth.guard.js';
import type { ProviderItem } from './fake-provider.js';

/** Was ein Fachbereich über ein Element einer Anbindung wissen muss */
export interface ItemContext {
  orgId: string;
  connectionId: string;
  connectorKey: string;
  scope: 'org' | 'user';
  /** Bei persönlichen Verbindungen die Person, sonst null */
  userId: string | null;
  settings: Record<string, unknown>;
  /** Die verbindende Person mit ihrer heutigen Rolle */
  actor: AuthContext | null;
}

export interface ItemOutcome {
  status: 'applied' | 'ignored' | 'rejected' | 'failed';
  reason?: string | null;
  objectType?: string | null;
  objectId?: string | null;
}

export type ItemHandler = (context: ItemContext, item: ProviderItem) => Promise<ItemOutcome>;

/**
 * IN-01: Weitere Elementarten melden die Fachbereiche hier an (z. B. IN-03 Einladungen und
 * Kalendertermine). So schreibt die Schicht nur über deren Domänendienste, ohne sie selbst zu kennen.
 */
@Injectable()
export class ItemHandlers {
  private readonly handlers = new Map<string, ItemHandler>();

  register(kind: string, handler: ItemHandler) {
    this.handlers.set(kind, handler);
  }

  get(kind: string): ItemHandler | undefined {
    return this.handlers.get(kind);
  }
}
