import { Injectable } from '@nestjs/common';
import type { OutboxEmailPayload } from '@reziproq/db';
import { emailNotificationSchema } from './email.schema.js';

@Injectable()
export class EmailService {
  /** Validiert die erlaubten Mailvariablen für einen Outbox-Eintrag in derselben Transaktion. */
  prepare(input: unknown): OutboxEmailPayload {
    const notification = emailNotificationSchema.parse(input);
    return {
      template: notification.template,
      locale: notification.locale,
      recipient: notification.recipient,
      ...(notification.firstName === undefined ? {} : { firstName: notification.firstName }),
      title: notification.title,
      ...(notification.deadline === undefined ? {} : { deadline: notification.deadline }),
      link: notification.link,
    };
  }
}
