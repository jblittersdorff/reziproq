import { z } from 'zod';
import { orgRoles, userFunctions } from './permissions.js';

// Die eigene Organisation mit ihren Mitgliedern, für Einstellungen › Organisation (PLT-02, PLT-05).

export const organizationMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  orgRole: z.enum(orgRoles),
  isControlling: z.boolean(),
  defaultFunction: z.enum(userFunctions).nullable(),
});

export const organizationResponseSchema = z.object({
  name: z.string(),
  /** ISO-3166-1-Code, z. B. DE */
  country: z.string().nullable(),
  members: z.array(organizationMemberSchema),
});

/** PUT /api/organisation/mitglieder/:id: Rolle, Controlling und Standardfunktion (nur Admin). */
export const updateMemberRequestSchema = z.object({
  orgRole: z.enum(orgRoles, { error: 'invalid_role' }),
  isControlling: z.boolean(),
  defaultFunction: z.enum(userFunctions).nullable(),
});

export type OrganizationMember = z.infer<typeof organizationMemberSchema>;
export type OrganizationResponse = z.infer<typeof organizationResponseSchema>;
export type UpdateMemberRequest = z.infer<typeof updateMemberRequestSchema>;
