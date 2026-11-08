import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { describe, expect, test, vi } from 'vitest';
import { env } from '../../config/env.js';
import type { EmailDelivery } from './email.schema.js';
import type { EmailOutboxStore, EmailTransport } from './email.types.js';
import { EmailProcessor } from './email-processor.js';

describe.skipIf(!process.env.MAILPIT_URL)('QS-01 Mailpit-Akzeptanz', () => {
  test('liefert Testmails auf Deutsch und Englisch an Mailpit', async () => {
    const marker = randomUUID();
    const deliveries: EmailDelivery[] = [
      {
        id: randomUUID(),
        template: 'invitation',
        locale: 'de',
        recipient: 'qs01-de@example.com',
        title: `Einladung ${marker}`,
        link: '/fragen',
      },
      {
        id: randomUUID(),
        template: 'invitation',
        locale: 'en',
        recipient: 'qs01-en@example.com',
        title: `Invitation ${marker}`,
        link: '/questions',
      },
    ];
    const claimNext = vi.fn(async () => deliveries.shift() ?? null);
    const outbox: EmailOutboxStore = {
      claimNext,
      markSent: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
      reminderOrganizations: vi.fn(async () => []),
    };
    const smtp = nodemailer.createTransport({
      host: env.EMAIL_SMTP_HOST,
      port: env.EMAIL_SMTP_PORT,
      secure: false,
    });
    const transport: EmailTransport = { sendMail: (message) => smtp.sendMail(message) };
    const processor = new EmailProcessor(outbox, transport);

    expect(await processor.processPending()).toBe(2);
    const response = await fetch(new URL('/api/v1/messages', process.env.MAILPIT_URL));
    expect(response.ok).toBe(true);
    const result = (await response.json()) as {
      messages?: { Subject?: string }[];
    };
    const subjects = result.messages?.map((message) => message.Subject ?? '') ?? [];

    expect(subjects.filter((subject) => subject.includes(marker))).toHaveLength(2);
    expect(subjects).toContain(`Einladung: Einladung ${marker}`);
    expect(subjects).toContain(`Invitation: Invitation ${marker}`);
  });
});
