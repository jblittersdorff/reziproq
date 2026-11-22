import { Navigate } from '@tanstack/react-router';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { useMe } from '@/features/auth/use-me';
import { useT } from '@/lib/i18n';
import { StartPage } from './start-page';

export function EntryPage({ bookmark = false }: { bookmark?: boolean }) {
  const me = useMe();
  const t = useT();
  if (me.isError) return <ErrorState title={t.user.failed} />;
  if (!me.data) return <LoadingState label={t.user.loading} />;
  if (!me.data.organization || !me.data.permissions.viewBuyerAreas) {
    return bookmark ? <StartPage /> : <Navigate to="/start" replace />;
  }
  const overview = me.data.startPage
    ? me.data.startPage === 'overview'
    : (me.data.defaultOverview ?? me.data.orgRole === 'admin');
  return <Navigate to={!bookmark && overview ? '/uebersicht' : '/mein-tag'} replace />;
}
