import { displayNameOf } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { KpiLineChart } from '@/components/charts/kpi-line-chart';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Row, RowGroup } from '@/components/ui/row-group';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { akteHeadQueryOptions, kpiDetailQueryOptions } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useLocale, useMessages, useT } from '@/lib/i18n';
import { akteMessages } from './akte-messages';
import { AkteSheet } from './akte-sheet';
import { akteSheetMessages } from './akte-sheet-messages';
import { measureText, monthOf, oldPage } from './akte-view';

const tones = { on_track: 'success', close: 'warning', off: 'danger' } as const;

/**
 * Blatt Kennzahl-Verlauf (AK-01, K2-c.5, E-K4-4; nach Regeln): aus einer Zeile der Scorecard. Stand,
 * Basis und Ziel, der Verlauf als Linie von der Basis zum Ziel mit den Ist-Werten (JBP-09) und die
 * Werte mit Herkunft. Erfassen führt bis zum Gemeinsamen Plan (K4-e) auf die bisherige Seite.
 */
export function KpiSheet({ relationshipId, kpiId }: { relationshipId: string; kpiId: string }) {
  const t = useT();
  const all = useMessages(akteSheetMessages);
  const text = all.kpi;
  const tracks = useMessages(akteMessages).scorecard.tracks;
  const format = useFormat();
  const { locale } = useLocale();
  const accessToken = useToken();
  const enabled = accessToken !== '';
  const head = useQuery({ ...akteHeadQueryOptions(accessToken, relationshipId), enabled });
  const query = useQuery({
    ...kpiDetailQueryOptions(accessToken, `/suppliers/${relationshipId}`, kpiId),
    enabled,
  });
  const name = head.data ? displayNameOf(head.data.name).name : '';
  const kpi = query.data?.kpi;
  const side = kpi ? (kpi.ownerSide === 'buyer' ? text.ownSide : name) : '';
  const measure = (value: string) => (kpi ? measureText(value, kpi.unit, locale) : value);
  const latest = kpi?.values.at(-1);
  const month = new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const values = [...(query.data?.values ?? [])].sort((a, b) => b.period.localeCompare(a.period));

  return (
    <AkteSheet
      relationshipId={relationshipId}
      title={kpi?.name ?? text.title}
      subtitle={
        kpi
          ? text.subtitle(
              side,
              measure(kpi.target),
              format.date(kpi.targetDate),
              // Bei Kennzahlen des Gegenübers ist die Verantwortung oft die Organisation selbst
              kpi.ownerName.trim() === side.trim() ? null : kpi.ownerName,
            )
          : undefined
      }
    >
      {query.isError ? (
        <ErrorState title={all.failed} />
      ) : !query.data || !kpi ? (
        <LoadingState label={all.loading} />
      ) : (
        <div className="flex flex-col gap-5.5">
          <p className="flex flex-wrap items-center gap-2 text-base">
            <Badge variant={kpi.track ? tones[kpi.track] : 'neutral'}>
              {tracks[kpi.track ?? 'none']}
            </Badge>
            <span className="text-muted-foreground">
              {[
                text.line(
                  kpi.baseline === null ? null : measure(kpi.baseline),
                  measure(kpi.target),
                ),
                latest
                  ? text.latest(monthOf(latest.period, locale), measure(latest.value))
                  : text.noValue,
              ].join(' · ')}
            </span>
          </p>
          <KpiLineChart
            title={text.chartTitle(tracks[kpi.track ?? 'none'])}
            description={text.chartHint(query.data.tolerancePercent)}
            names={{ actual: text.actual, plan: text.plan }}
            points={[
              {
                time: Date.parse(`${kpi.startDate}T00:00:00Z`),
                plan: Number(kpi.baseline ?? kpi.values[0]?.value ?? kpi.target),
              },
              ...kpi.values.map((entry) => ({
                time: Date.parse(`${entry.period}T00:00:00Z`),
                actual: Number(entry.value),
              })),
              { time: Date.parse(`${kpi.targetDate}T00:00:00Z`), plan: Number(kpi.target) },
            ].sort((a, b) => a.time - b.time)}
            formatValue={(value) => measure(String(value))}
            formatTime={(time) => month.format(new Date(time))}
            empty={{ title: text.chartEmpty, description: text.chartEmptyHint }}
          />
          {values.length > 0 && (
            <RowGroup id="werte" label={text.values}>
              {values.map((row) => (
                <Row
                  key={row.period}
                  title={`${monthOf(row.period, locale)} ${row.period.slice(0, 4)}`}
                  detail={text.valueDetail(
                    row.enteredByName,
                    format.date(row.enteredAt),
                    t.jbp.scorecard.sources[row.source] ?? row.source,
                  )}
                  value={measure(row.value)}
                  wrap
                />
              ))}
            </RowGroup>
          )}
          {kpi.canEnter ? (
            <div className="flex flex-wrap gap-2">
              {routerLink({
                href: oldPage(relationshipId, `/plan/scorecard/${kpi.id}/wert`),
                className: buttonVariants({ variant: 'secondary' }),
                children: text.enter,
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{text.onlyOwner(side)}</p>
          )}
        </div>
      )}
    </AkteSheet>
  );
}
