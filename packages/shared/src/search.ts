import { z } from 'zod';

// QS-05: Suche über ein Suchwort, ohne KI, nur in dem, was die Person sehen darf.

/** Ab so vielen Zeichen sucht Reziproq */
export const minSearchLength = 3;
/** Höchstens so viele Treffer je Art */
export const maxHitsPerKind = 5;

export const searchKinds = ['suppliers', 'initiatives', 'actions'] as const;
export type SearchKind = (typeof searchKinds)[number];

export const searchHitSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  /** z. B. der Lieferant oder die eigene Nummer */
  detail: z.string().nullable(),
  /** Ort in der App */
  href: z.string(),
});
export type SearchHit = z.infer<typeof searchHitSchema>;

export const searchResultsSchema = z.object({
  query: z.string(),
  suppliers: z.array(searchHitSchema),
  initiatives: z.array(searchHitSchema),
  actions: z.array(searchHitSchema),
});
export type SearchResults = z.infer<typeof searchResultsSchema>;

export const searchQuerySchema = z.object({
  q: z.string().trim().min(minSearchLength).max(200),
  /** Lieferanten-Nutzer: Beziehung des aktuellen Kunden */
  kunde: z.uuid().optional(),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;
