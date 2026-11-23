import { Global, Injectable, Logger, Module } from '@nestjs/common';

/**
 * KI-09: Ereignisse für eigene Agenten (feste Liste). Fachbereiche melden sie hier, ohne die
 * Agenten zu kennen; gemeldet wird nach dem Fachvorgang, nie aus einer offenen Transaktion.
 */
export type AgentEventKey = 'feedback_revealed' | 'spend_import_done';

@Injectable()
export class AgentEventBus {
  private readonly logger = new Logger('Agenten-Ereignisse');
  private listener:
    | ((orgId: string, event: AgentEventKey, relationshipId: string | null) => Promise<unknown>)
    | undefined;
  private readonly pending = new Set<Promise<void>>();

  listen(
    listener: (
      orgId: string,
      event: AgentEventKey,
      relationshipId: string | null,
    ) => Promise<unknown>,
  ) {
    this.listener = listener;
  }

  defer(orgId: string, event: AgentEventKey, relationshipId: string | null): void {
    if (!this.listener) return;
    const listener = this.listener;
    const work = new Promise<void>((resolve) => setImmediate(resolve))
      .then(() => listener(orgId, event, relationshipId))
      .then(() => undefined)
      .catch((error: Error) => this.logger.warn(`Ereignis nicht verarbeitet: ${error.message}`));
    this.pending.add(work);
    void work.finally(() => this.pending.delete(work));
  }

  async settled(): Promise<void> {
    while (this.pending.size > 0) await Promise.all([...this.pending]);
  }
}

@Global()
@Module({ providers: [AgentEventBus], exports: [AgentEventBus] })
export class AgentEventBusModule {}
