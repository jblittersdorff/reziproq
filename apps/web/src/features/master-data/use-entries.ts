import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import {
  businessUnitsQueryOptions,
  type MasterDataKind,
  materialGroupsQueryOptions,
} from '@/lib/api';
import type { Entry } from './kinds';

/** Alle Einträge einer Art der eigenen Organisation (PLT-06). */
export function useEntries(kind: MasterDataKind) {
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const units = useQuery({
    ...businessUnitsQueryOptions(accessToken),
    enabled: accessToken !== '' && kind === 'business-units',
  });
  const groups = useQuery({
    ...materialGroupsQueryOptions(accessToken),
    enabled: accessToken !== '' && kind === 'material-groups',
  });
  const query = kind === 'business-units' ? units : groups;
  const entries: Entry[] | undefined =
    kind === 'business-units' ? units.data?.businessUnits : groups.data?.materialGroups;
  return { entries, isError: query.isError, accessToken };
}
