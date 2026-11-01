import { z } from 'zod';

// Betreiber-Zugang (PLT-13, UMB-01): Mitarbeiter von Reziproq wechseln in einen Kunden.

/**
 * Header, in dem die Oberfläche den gewählten Kunden bei jeder Anfrage mitschickt. „Kunde“ bleibt
 * frei für den Kundenkontext der Lieferanten (app.customer_org_id, LIF-02).
 */
export const supportHeader = 'x-reziproq-support-org';

export const customerSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string().nullable(),
});

export type Customer = z.infer<typeof customerSchema>;

export const customersResponseSchema = z.object({ customers: z.array(customerSchema) });

export type CustomersResponse = z.infer<typeof customersResponseSchema>;
