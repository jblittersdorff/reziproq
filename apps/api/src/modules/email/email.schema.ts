import { z } from 'zod';

export const emailTemplates = ['invitation', 'reminder', 'approval', 'escalation'] as const;
export const emailTemplateSchema = z.enum(emailTemplates);
export const emailLocaleSchema = z.enum(['de', 'en']);

const shortText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !hasControlCharacters(value), 'Darf keine Steuerzeichen enthalten.');

const hasControlCharacters = (value: string) =>
  [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 || code === 127;
  });

export const internalLinkSchema = z
  .string()
  .min(2)
  .max(512)
  .refine((value) => {
    if (
      !value.startsWith('/') ||
      value.startsWith('//') ||
      value.includes('?') ||
      value.includes('#') ||
      value.includes('\\') ||
      /\s/u.test(value) ||
      hasControlCharacters(value)
    ) {
      return false;
    }
    try {
      const url = new URL(value, 'https://reziproq.invalid');
      return url.origin === 'https://reziproq.invalid' && url.pathname === value;
    } catch {
      return false;
    }
  }, 'Der Link muss ein relativer Pfad dieser Anwendung sein.');

export const emailContentSchema = z
  .object({
    template: emailTemplateSchema,
    locale: emailLocaleSchema,
    firstName: shortText(80).optional(),
    title: shortText(140),
    deadline: shortText(100).optional(),
    link: internalLinkSchema,
  })
  .strict();

export const emailNotificationSchema = z
  .object({
    recipient: z.string().trim().max(254).pipe(z.email()),
    ...emailContentSchema.shape,
  })
  .strict();

export const emailDeliverySchema = z
  .object({
    id: z.uuid(),
    ...emailNotificationSchema.shape,
  })
  .strict();

export type EmailContent = z.infer<typeof emailContentSchema>;
export type EmailNotification = z.infer<typeof emailNotificationSchema>;
export type EmailDelivery = z.infer<typeof emailDeliverySchema>;
