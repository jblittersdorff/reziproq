import { Inject, Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env.js';
import type { EmailOutboxStore, EmailTransport } from './email.types.js';
import { EMAIL_OUTBOX_STORE, EMAIL_TRANSPORT } from './email.types.js';
import { renderEmail } from './templates.js';

@Injectable()
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    @Inject(EMAIL_OUTBOX_STORE) private readonly outbox: EmailOutboxStore,
    @Inject(EMAIL_TRANSPORT) private readonly transport: EmailTransport,
  ) {}

  /** Verarbeitet alle fälligen Mailereignisse; eine eindeutige Logzeile verhindert Doppelversand. */
  async processPending(): Promise<number> {
    let sent = 0;
    for (;;) {
      const delivery = await this.outbox.claimNext();
      if (!delivery) return sent;

      try {
        const { id, recipient, ...content } = delivery;
        const rendered = renderEmail(content, env.WEB_APP_URL);
        await this.transport.sendMail({
          from: 'noreply@reziproq.de',
          to: recipient,
          ...rendered,
          headers: { 'Message-ID': `<${id}@reziproq.de>` },
        });
      } catch (error) {
        await this.outbox.markFailed(delivery.id);
        const kind = error instanceof Error ? error.name : 'UnknownError';
        this.logger.error(
          `E-Mail ${delivery.id} fehlgeschlagen (${kind}); Versand wird erneut versucht.`,
        );
        continue;
      }

      await this.outbox.markSent(delivery.id);
      sent += 1;
    }
  }
}
