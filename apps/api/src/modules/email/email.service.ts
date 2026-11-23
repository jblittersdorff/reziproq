import { Injectable } from '@nestjs/common';
import type { OutboxEmailPayload } from '@reziproq/db';
import { applyCategoryLabel, type CategoryLabel } from '@reziproq/shared';
import { emailNotificationSchema } from './email.schema.js';

@Injectable()
export class EmailService {
  /**
   * Validiert die erlaubten Mailvariablen für einen Outbox-Eintrag in derselben Transaktion. Mit
   * der Bezeichnung des Kunden (WG-01) steht in Titel und Nachricht dessen Wort statt „Warengruppe“.
   */
  prepare(input: unknown, options: { categoryLabel?: CategoryLabel } = {}): OutboxEmailPayload {
    const parsed = emailNotificationSchema.parse(input);
    const label = options.categoryLabel;
    const notification = {
      ...parsed,
      title: applyCategoryLabel(parsed.title, label),
      ...(parsed.message === undefined
        ? {}
        : { message: applyCategoryLabel(parsed.message, label) }),
    };
    return {
      template: notification.template,
      locale: notification.locale,
      recipient: notification.recipient,
      ...(notification.firstName === undefined ? {} : { firstName: notification.firstName }),
      title: notification.title,
      ...(notification.deadline === undefined ? {} : { deadline: notification.deadline }),
      link: notification.link,
      ...(notification.sender === undefined ? {} : { sender: notification.sender }),
      ...(notification.message === undefined ? {} : { message: notification.message }),
    };
  }
}
