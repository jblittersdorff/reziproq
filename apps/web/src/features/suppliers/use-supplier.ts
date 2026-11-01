import { type FieldError, fieldErrors } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { ApiError, supplierQueryOptions } from '@/lib/api';
import type { Messages } from '@/locales/de';

/** Ein Lieferant (PLT-03b). Lädt erst mit Token; Rechte prüft die API. */
export function useSupplier(relationshipId: string) {
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({
    ...supplierQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  const notFound =
    query.error instanceof ApiError && (query.error.status === 404 || query.error.status === 400);
  return { ...query, notFound, accessToken };
}

/** Nach dem Speichern: Liste, Lieferant und Verlauf neu laden. */
export function useRefreshSupplier() {
  const queryClient = useQueryClient();
  return (relationshipId?: string) => {
    void queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    if (relationshipId) void queryClient.invalidateQueries({ queryKey: ['audit'] });
  };
}

/** Feldfehler aus zod (Seite) oder aus der API (400) als übersetzte Texte je Feld. */
export function translateFieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
  t: Messages,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.');
    const code = fieldErrors.find((known) => known === issue.message) as FieldError | undefined;
    result[key] ??= code ? t.suppliers.errors[code] : t.suppliers.errors.required;
  }
  return result;
}

/** Feldfehler aus einer 400-Antwort der API ({ errors: { feld: [code] } }). */
export function apiFieldErrors(error: unknown, t: Messages): Record<string, string> | null {
  if (!(error instanceof ApiError) || error.status !== 400) return null;
  const errors = (error.body as { errors?: Record<string, string[]> } | null)?.errors ?? {};
  return translateFieldErrors(
    Object.entries(errors).flatMap(([field, codes]) =>
      (codes ?? []).map((message) => ({ path: [field], message })),
    ),
    t,
  );
}
