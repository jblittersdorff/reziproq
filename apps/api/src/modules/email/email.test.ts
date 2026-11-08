import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EmailDelivery } from './email.schema.js';
import { emailTemplates } from './email.schema.js';
import { EmailService } from './email.service.js';
import type { EmailOutboxStore, EmailTransport } from './email.types.js';
import { EmailProcessor } from './email-processor.js';
import { buildEmailLink, renderEmail } from './templates.js';

const delivery: EmailDelivery = {
  id: '019d9e8e-1b2c-7a8b-9c0d-123456789abc',
  template: 'invitation',
  locale: 'de',
  recipient: 'ada@example.com',
  firstName: 'Ada',
  title: 'Bewertung Beispiel AG (Demo)',
  deadline: '30. Juni 2027',
  link: '/bewertungen/123',
};

describe('QS-01 E-Mail-Vorlagen', () => {
  it.each(
    (['invitation', 'reminder', 'approval', 'escalation'] as const).flatMap((template) =>
      (['de', 'en'] as const).map((locale) => [template, locale] as const),
    ),
  )('rendert %s auf %s mit Titel und Link', (template, locale) => {
    const result = renderEmail(
      { template, locale, title: delivery.title, link: delivery.link },
      'https://app.example.com',
    );

    expect(result.subject).toContain(delivery.title);
    expect(result.text).toContain('https://app.example.com/bewertungen/123');
    expect(result.html).toContain('href="https://app.example.com/bewertungen/123"');
  });

  it('escaped HTML-Inhalte und lehnt zusätzliche Variablen ab', () => {
    const result = renderEmail(
      {
        template: 'reminder',
        locale: 'en',
        title: '<script>alert(1)</script>',
        link: '/fragen',
      },
      'https://app.example.com',
    );
    expect(result.html).toContain('&lt;script&gt;');
    expect(result.html).not.toContain('<script>');

    expect(() =>
      new EmailService().prepare({
        recipient: 'ada@example.com',
        template: 'reminder',
        locale: 'en',
        title: 'A reminder',
        link: '/fragen',
        confidentialDetails: 'not allowed',
      }),
    ).toThrow();
  });

  it.each(emailTemplates)('lehnt nicht erlaubte Variablen für %s ab', (template) => {
    expect(() =>
      new EmailService().prepare({
        recipient: 'ada@example.com',
        template,
        locale: 'de',
        title: 'Eine Einladung',
        link: '/fragen',
        privateSpend: 'not allowed',
      }),
    ).toThrow();
  });

  it.each(['https://evil.example', '//evil.example', '/fragen?token=secret', '/a/../b'])(
    'lehnt unsicheren E-Mail-Link %s ab',
    (link) => {
      expect(() => buildEmailLink('https://app.example.com', link)).toThrow();
    },
  );
});

describe('QS-01 Outbox-Verarbeitung', () => {
  afterEach(() => vi.restoreAllMocks());

  it('versendet ein Outbox-Ereignis auch bei wiederholtem Job nur einmal', async () => {
    const claimNext = vi.fn<EmailOutboxStore['claimNext']>();
    claimNext.mockResolvedValueOnce(delivery).mockResolvedValue(null);
    const outbox: EmailOutboxStore = {
      claimNext,
      markSent: vi.fn<EmailOutboxStore['markSent']>().mockResolvedValue(undefined),
      markFailed: vi.fn<EmailOutboxStore['markFailed']>().mockResolvedValue(undefined),
      reminderOrganizations: vi.fn<EmailOutboxStore['reminderOrganizations']>().mockResolvedValue([]),
    };
    const sendMail = vi.fn<EmailTransport['sendMail']>().mockResolvedValue(undefined);
    const processor = new EmailProcessor(outbox, { sendMail });

    await processor.processPending();
    await processor.processPending();

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(outbox.markSent).toHaveBeenCalledWith(delivery.id);
  });

  it('protokolliert einen Versandfehler und versucht die Mail beim nächsten Job erneut', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const claimNext = vi.fn<EmailOutboxStore['claimNext']>();
    claimNext
      .mockResolvedValueOnce(delivery)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(delivery)
      .mockResolvedValueOnce(null);
    const outbox: EmailOutboxStore = {
      claimNext,
      markSent: vi.fn<EmailOutboxStore['markSent']>().mockResolvedValue(undefined),
      markFailed: vi.fn<EmailOutboxStore['markFailed']>().mockResolvedValue(undefined),
      reminderOrganizations: vi.fn<EmailOutboxStore['reminderOrganizations']>().mockResolvedValue([]),
    };
    const sendMail = vi
      .fn<EmailTransport['sendMail']>()
      .mockRejectedValueOnce(new Error('SMTP temporarily unavailable'))
      .mockResolvedValueOnce(undefined);
    const processor = new EmailProcessor(outbox, { sendMail });

    await processor.processPending();
    await processor.processPending();

    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(outbox.markFailed).toHaveBeenCalledWith(delivery.id);
    expect(outbox.markSent).toHaveBeenCalledWith(delivery.id);
  });
});
