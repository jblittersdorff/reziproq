import { Module } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { EmailService } from './email.service.js';
import type { EmailTransport } from './email.types.js';
import { EMAIL_OUTBOX_STORE, EMAIL_TRANSPORT } from './email.types.js';
import { EmailWorker } from './email.worker.js';
import { PostgresEmailOutboxStore } from './email-outbox.store.js';
import { EmailProcessor } from './email-processor.js';
import { CycleReminderService } from './cycle-reminder.service.js';
import { OverviewModule } from '../overview/overview.module.js';

@Module({
  imports: [OverviewModule],
  providers: [
    EmailService,
    EmailProcessor,
    CycleReminderService,
    EmailWorker,
    PostgresEmailOutboxStore,
    { provide: EMAIL_OUTBOX_STORE, useExisting: PostgresEmailOutboxStore },
    {
      provide: EMAIL_TRANSPORT,
      useFactory: (): EmailTransport => {
        const smtp = nodemailer.createTransport({
          host: env.EMAIL_SMTP_HOST,
          port: env.EMAIL_SMTP_PORT,
          secure: false,
          connectionTimeout: 30_000,
          greetingTimeout: 30_000,
          socketTimeout: 30_000,
          ...(env.EMAIL_SMTP_USER && env.EMAIL_SMTP_PASSWORD
            ? { auth: { user: env.EMAIL_SMTP_USER, pass: env.EMAIL_SMTP_PASSWORD } }
            : {}),
        });
        return { sendMail: (message) => smtp.sendMail(message) };
      },
    },
  ],
  exports: [EmailService],
})
export class EmailModule {}
