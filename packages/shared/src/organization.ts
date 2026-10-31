import { z } from 'zod';

// Die eigene Organisation mit ihren Mitgliedern, für Einstellungen → Organisation (PLT-02).

export const organizationMemberSchema = z.object({
  name: z.string(),
  email: z.email(),
});

export const organizationResponseSchema = z.object({
  name: z.string(),
  /** ISO-3166-1-Code, z. B. DE */
  country: z.string().nullable(),
  members: z.array(organizationMemberSchema),
});

export type OrganizationMember = z.infer<typeof organizationMemberSchema>;
export type OrganizationResponse = z.infer<typeof organizationResponseSchema>;
