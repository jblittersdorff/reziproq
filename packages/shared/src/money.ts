import { z } from 'zod';

/** Geldbetrag als Ganzzahl in Cent mit ISO-4217-Währung – nie als Gleitkommazahl. */
export const moneySchema = z.object({
  amountCents: z.number().int(),
  currency: z.string().regex(/^[A-Z]{3}$/),
});

export type Money = z.infer<typeof moneySchema>;
