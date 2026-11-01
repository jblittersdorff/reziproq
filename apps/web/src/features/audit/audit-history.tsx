import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { ErrorState } from '@/components/ui/error-state';
import { HistoryList } from '@/components/ui/history-list';
import { auditQueryOptions } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatAuditEntry } from './format';

/**
 * Verlauf eines Objekts (PLT-08): lädt die Einträge und zeigt sie mit dem Baustein Verlauf.
 * Welche Einträge sichtbar sind, entscheidet die Datenbank wie beim Objekt selbst.
 */
export function AuditHistory({ objectType, objectId }: { objectType: string; objectId: string }) {
  const t = useT();
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const history = useQuery({
    ...auditQueryOptions(accessToken, objectType, objectId),
    enabled: accessToken !== '',
  });

  if (history.isError) return <ErrorState title={t.audit.failed} />;
  return (
    <HistoryList
      entries={(history.data?.entries ?? []).map((entry) => formatAuditEntry(entry, t))}
      loading={!history.data}
      loadingLabel={t.audit.loading}
      empty={{ title: t.audit.emptyTitle, description: t.audit.emptyDescription }}
    />
  );
}
