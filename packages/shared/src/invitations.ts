import { z } from 'zod';

// LIF-01a: Personen des Lieferanten einladen und Einladung annehmen.

/** Gültigkeit eines Einladungslinks. */
export const invitationValidDays = 7;

/** Token im Link /einladung/<token>: 32 Zufallsbytes als base64url (43 Zeichen). */
export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,100}$/);

export const inviteSupplierRequestSchema = z
  .object({
    email: z.string().trim().max(254).pipe(z.email()),
    message: z.string().trim().max(500).optional(),
  })
  .strict();

/** Stand einer Einladung aus Sicht der einladenden Organisation. */
export const invitationStatuses = ['open', 'expired', 'accepted', 'revoked'] as const;
export type InvitationStatus = (typeof invitationStatuses)[number];

export const invitationSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  status: z.enum(invitationStatuses),
  invitedBy: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
  expiresAt: z.iso.datetime({ offset: true }),
  acceptedAt: z.iso.datetime({ offset: true }).nullable(),
});

export const invitationListSchema = z.object({
  invitations: z.array(invitationSchema),
  /** Admin oder SRO der Beziehung, und die Beziehung ist nicht beendet */
  canInvite: z.boolean(),
  /** Vorschläge aus den Kontakten des Lieferanten (PLT-07b) */
  suggestions: z.array(z.object({ name: z.string(), email: z.string() })),
});

/**
 * Rolle der eingeladenen Person im Team ihrer Seite. sro ist auf der Lieferantenseite der Key
 * Account Manager; es gibt ihn je Beziehung nur einmal.
 */
export const supplierTeamRoles = ['sro', 'sponsor', 'member'] as const;
export type SupplierTeamRole = (typeof supplierTeamRoles)[number];

/** Was /einladung/<token> ohne Login zeigt; used heißt: schon angenommen. */
export const publicInvitationStatuses = ['open', 'expired', 'used', 'revoked'] as const;

export const publicInvitationSchema = z.object({
  status: z.enum(publicInvitationStatuses),
  customer: z.string(),
  sro: z.string().nullable(),
  supplier: z.string(),
  kamTaken: z.boolean(),
});

export const acceptInvitationRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    teamRole: z.enum(supplierTeamRoles),
    /** Sprache der Seite; gilt danach für Oberfläche und Mails der Person (PLT-09). */
    locale: z.enum(['de', 'en']).default('de'),
  })
  .strict();

/** Wohin es nach der Annahme geht: zur Einrichtung des Passkeys bei Zitadel. */
export const acceptInvitationResponseSchema = z.object({ next: z.string() });

export type InviteSupplierRequest = z.infer<typeof inviteSupplierRequestSchema>;
export type Invitation = z.infer<typeof invitationSchema>;
export type InvitationList = z.infer<typeof invitationListSchema>;
export type PublicInvitation = z.infer<typeof publicInvitationSchema>;
export type AcceptInvitationRequest = z.infer<typeof acceptInvitationRequestSchema>;
export type AcceptInvitationResponse = z.infer<typeof acceptInvitationResponseSchema>;
