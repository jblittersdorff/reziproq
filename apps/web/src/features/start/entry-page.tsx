import { Navigate } from '@tanstack/react-router';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { useMe } from '@/features/auth/use-me';
import { useT } from '@/lib/i18n';

/**
 * Startseite der Person (NAV-10 2.0, E-K1-1, TN-06): Lead und Admin starten in Wert, alle anderen
 * Käufer in Heute; eine eigene Wahl in den Einstellungen geht vor. Die Lieferantenseite und Personen
 * ohne Organisation starten in Heute (dort erscheint der passende Hinweis).
 */
export function EntryPage() {
  const me = useMe();
  const t = useT();
  if (me.isError) return <ErrorState title={t.user.failed} />;
  if (!me.data) return <LoadingState label={t.user.loading} />;
  if (!me.data.organization || !me.data.permissions.viewBuyerAreas) {
    return <Navigate to="/heute" replace />;
  }
  const value = me.data.startPage
    ? me.data.startPage === 'overview'
    : (me.data.defaultOverview ?? me.data.orgRole === 'admin');
  return <Navigate to={value ? '/wert' : '/heute'} replace />;
}
