import type { Action } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { permissionsQueryOptions } from '@/lib/api';
import { useMe } from './use-me';

/**
 * Was die Person darf, aus GET /api/me/permissions (PLT-05). Erst nach /me, das beim ersten
 * Login die Rollen übernimmt. Die Oberfläche blendet damit nur Knöpfe aus; entscheidend ist
 * die Prüfung im Backend.
 */
export function usePermissions() {
  const auth = useAuth();
  const me = useMe();
  const accessToken = auth.user?.access_token ?? '';
  return useQuery({
    ...permissionsQueryOptions(accessToken),
    enabled: accessToken !== '' && me.isSuccess,
  });
}

/** true, wenn die Person die Aktion darf; solange es nicht feststeht, false. */
export function useCan(action: Action): boolean {
  return usePermissions().data?.actions.includes(action) ?? false;
}
