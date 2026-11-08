import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { ApiError, ratingQueryOptions } from '@/lib/api';

export const ratingsPath = '/bewertungen';

export const linkClass =
  'inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

export function useToken() {
  const auth = useAuth();
  return auth.user?.access_token ?? '';
}

export function useRating(id: string) {
  const accessToken = useToken();
  return useQuery({ ...ratingQueryOptions(accessToken, id), enabled: accessToken !== '' });
}

export function formatDate(locale: string, date: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(`${date}T00:00:00`),
  );
}

export function isNotFound(error: unknown) {
  return error instanceof ApiError && (error.status === 404 || error.status === 403);
}

export function errorBody(error: unknown): { code?: string; missing?: string[] } {
  if (!(error instanceof ApiError)) return {};
  return (error.body as { code?: string; missing?: string[] } | null) ?? {};
}
