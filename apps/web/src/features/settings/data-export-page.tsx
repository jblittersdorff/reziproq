import type { DataExport } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DownloadIcon } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { ListCard, ListCardHeader, ListRow, ListRowText } from '@/components/ui/list-card';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import { useMe } from '@/features/auth/use-me';
import { useCan } from '@/features/auth/use-permissions';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { dataExportsQueryOptions, downloadDataExport, requestDataExport } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';

/**
 * Einstellungen › Datenexport (QS-03): Gesamtexport aller Daten der eigenen Organisation als ZIP.
 * Nur Admins. Er läuft als Job; die Liste zeigt Status und, 24 Stunden lang, den Link.
 */
export function DataExportPage() {
  const t = useT();
  const text = t.settings.dataExport;
  const me = useMe();
  const canExport = useCan('datenexport.anfordern');
  return (
    <>
      <PagePath
        trail={[
          { label: t.profile.title, href: '/profil' },
          { label: t.settings.title, href: '/einstellungen' },
        ]}
        current={text.navTitle}
      />
      <PageHeader title={text.title} purpose={text.purpose} />
      {me.isError ? (
        <ErrorState title={t.user.failed} />
      ) : !me.data ? (
        <LoadingState label={text.loading} />
      ) : canExport ? (
        <Exports />
      ) : (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {t.settings.adminOnly}
        </p>
      )}
    </>
  );
}

function Exports() {
  const text = useT().settings.dataExport;
  const format = useFormat();
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const queryClient = useQueryClient();
  const options = dataExportsQueryOptions(accessToken);
  const query = useQuery({ ...options, enabled: accessToken !== '' });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  if (query.isError) return <ErrorState title={text.failed} />;
  if (!query.data) return <LoadingState label={text.loading} />;
  const running = query.data.exports.some(
    (entry) => entry.status === 'pending' || entry.status === 'running',
  );

  const request = async () => {
    setBusy(true);
    setFailed(null);
    try {
      queryClient.setQueryData(options.queryKey, await requestDataExport(accessToken));
    } catch {
      setFailed(text.requestFailed);
    } finally {
      setBusy(false);
    }
  };

  const status = (entry: DataExport) =>
    entry.status === 'done' && !entry.downloadable
      ? text.statuses.expired
      : text.statuses[entry.status];

  return (
    <div className="flex flex-col gap-6">
      {failed && <StatusLine message={failed} tone="warning" />}
      <Button
        className="self-start"
        loading={busy}
        disabled={running}
        onClick={() => void request()}
      >
        {text.request}
      </Button>
      {running && <p className="text-muted-foreground">{text.runningHint}</p>}
      <ListCard aria-labelledby="export-liste">
        <ListCardHeader id="export-liste" title={text.listTitle} />
        {query.data.exports.length === 0 ? (
          <p className="px-5.5 pb-5.5 text-muted-foreground">{text.empty}</p>
        ) : (
          <ul>
            {query.data.exports.map((entry) => (
              <li key={entry.id}>
                <ListRow>
                  <ListRowText
                    title={text.requestedAt(format.dateTime(entry.createdAt))}
                    detail={
                      entry.downloadable && entry.expiresAt
                        ? text.validUntil(format.dateTime(entry.expiresAt))
                        : entry.fileName
                    }
                  />
                  <Badge
                    variant={
                      entry.status === 'failed'
                        ? 'danger'
                        : entry.downloadable
                          ? 'success'
                          : 'neutral'
                    }
                  >
                    {status(entry)}
                  </Badge>
                  {entry.downloadable && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        void downloadDataExport(accessToken, entry.id).catch(() =>
                          setFailed(text.downloadFailed),
                        )
                      }
                    >
                      <DownloadIcon aria-hidden />
                      {text.download}
                    </Button>
                  )}
                </ListRow>
              </li>
            ))}
          </ul>
        )}
      </ListCard>
    </div>
  );
}
