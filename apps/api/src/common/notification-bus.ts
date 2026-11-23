import { Global, Injectable, Logger, Module } from '@nestjs/common';

/**
 * IN-06: Anlässe für Benachrichtigungen. Fachbereiche melden hier, was passiert ist; der Dienst
 * für Benachrichtigungen entscheidet über Kanal, Bündel und Ruhezeiten. So hängen die Fachbereiche
 * nicht von den Benachrichtigungen ab (und umgekehrt). Inhalte: nur Titel, eine Zeile Kontext und
 * Link, nie private Inhalte.
 */
export interface NotificationEvent {
  orgId: string;
  userIds: string[];
  kind:
    | 'hint_high'
    | 'brief_ready'
    | 'results_ready'
    | 'commitment_due'
    | 'inbound_review'
    | 'meeting_reminder';
  objectType: string;
  objectId: string;
  title: string;
  line?: string | null;
  href: string;
  /** Beziehung, falls vorhanden: Lieferanten ohne Zugriff bekommen nichts */
  relationshipId?: string | null;
}

@Injectable()
export class NotificationBus {
  private readonly logger = new Logger('Benachrichtigungen');
  private listener: ((event: NotificationEvent) => Promise<void>) | undefined;

  listen(listener: (event: NotificationEvent) => Promise<void>) {
    this.listener = listener;
  }

  /** Nie den Fachvorgang aufhalten: Fehler werden nur protokolliert */
  async emit(event: NotificationEvent): Promise<void> {
    if (!this.listener || event.userIds.length === 0) return;
    try {
      await this.listener(event);
    } catch (error) {
      this.logger.warn(`Benachrichtigung nicht möglich: ${(error as Error).message}`);
    }
  }
}

@Global()
@Module({ providers: [NotificationBus], exports: [NotificationBus] })
export class NotificationBusModule {}
