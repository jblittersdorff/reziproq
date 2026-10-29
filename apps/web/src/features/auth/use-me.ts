import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { meQueryOptions } from '@/lib/api';

/** Name und E-Mail der angemeldeten Person aus GET /api/me. */
export function useMe() {
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  return useQuery({ ...meQueryOptions(accessToken), enabled: accessToken !== '' });
}
