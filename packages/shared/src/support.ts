import { z } from 'zod';

// Betreiber-Zugang (PLT-13): Mitarbeiter von Reziproq wechseln in einen Kunden.

/** Header, in dem die Oberfläche den gewählten Kunden bei jeder Anfrage mitschickt. */
export const supportHeader = 'x-reziproq-kunde';

export const customerSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string().nullable(),
});

export type Customer = z.infer<typeof customerSchema>;

export const customersResponseSchema = z.object({ customers: z.array(customerSchema) });

export type CustomersResponse = z.infer<typeof customersResponseSchema>;
