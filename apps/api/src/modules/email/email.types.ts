import type { EmailDelivery } from './email.schema.js';

export const EMAIL_OUTBOX_STORE = Symbol('EMAIL_OUTBOX_STORE');
export const EMAIL_TRANSPORT = Symbol('EMAIL_TRANSPORT');

export interface EmailOutboxStore {
  claimNext(): Promise<EmailDelivery | null>;
  markSent(id: string): Promise<void>;
  markFailed(id: string): Promise<void>;
  reminderOrganizations(): Promise<string[]>;
}

export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
}

export interface EmailTransport {
  sendMail(message: EmailMessage): Promise<unknown>;
}
