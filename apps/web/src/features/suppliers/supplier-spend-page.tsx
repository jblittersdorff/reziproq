import type { SpendOverview } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';
import { useAuth } from 'react-oidc-context';
import { SpendChart, spendChartData } from '@/components/charts/spend-chart';
import { buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatusLine } from '@/components/ui/status-line';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { InternalBadge } from '@/features/workspace/internal-badge';
import { spendOverviewQueryOptions } from '@/lib/api';
import { useFlash } from '@/lib/flash';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { SupplierFrame } from './supplier-frame';

export type SpendSplit = 'bu' | 'warengruppe';

export function useSpendOverview(relationshipId: string) {
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({
    ...spendOverviewQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  return { ...query, accessToken };
}

/**
 * Strategie › Spend (PLT-03b, SPL-04): Kennzahlen, Spend je Jahr als gestapelte Säulen nach
 * Business Unit oder Warengruppe (Umschalter in der Adresse), Summen je Jahr und die Einträge.
 */
export function SupplierSpendPage({
  relationshipId,
  by = 'bu',
}: {
  relationshipId: string;
  by?: SpendSplit;
}) {
  const t = useT();
  const text = t.suppliers.spendDevelopment;
  const query = useSpendOverview(relationshipId);
  const [message, hideMessage] = useFlash();
  return (
    <SupplierFrame relationshipId={relationshipId} area="strategy" current={t.suppliers.spend}>
      {() => (
        <>
          <PageHeader title={t.suppliers.spend} purpose={text.purpose} badge={<InternalBadge />} />
          {message && <StatusLine message={message} onHidden={hideMessage} />}
          {query.isError ? (
            <ErrorState title={text.failed} />
          ) : !query.data ? (
            <LoadingState label={text.loading} />
          ) : (
            <SpendContent data={query.data} relationshipId={relationshipId} by={by} />
          )}
        </>
      )}
    </SupplierFrame>
  );
}

function SpendContent({
  data,
  relationshipId,
  by,
}: {
  data: SpendOverview;
  relationshipId: string;
  by: SpendSplit;
}) {
  const t = useT();
  const text = t.suppliers.spendDevelopment;
  const format = useFormat();
  const navigate = useNavigate();
  const base = `/lieferanten/${relationshipId}/strategie/spend`;
  const money = (amountCents: number) =>
    format.money({ amountCents, currency: data.currency ?? 'EUR' });
  // Basispunkte als Prozent mit einer Nachkommastelle.
  const percent = (basisPoints: number) => `${format.number(Math.round(basisPoints / 10) / 10)} %`;
  const { rows, series } = spendChartData(data.years, by, {
    unassigned: text.unassigned,
    more: text.more,
    year: text.yearLabel,
  });
  const addLink = data.canEdit
    ? routerLink({
        href: `${base}/neu`,
        className: buttonVariants(),
        children: (
          <>
            <PlusIcon />
            {text.add}
          </>
        ),
      })
    : null;

  return (
    <>
      {addLink && <div>{addLink}</div>}
      {data.kpis && (
        <section aria-label={text.kpis}>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1 rounded-lg bg-card p-4">
              <dt className="text-muted-foreground text-sm">{text.lastYear(data.kpis.year)}</dt>
              <dd className="font-display font-semibold text-figure tabular-nums tracking-section">
                {format.money(data.kpis.amount)}
              </dd>
            </div>
            <div className="flex flex-col gap-1 rounded-lg bg-card p-4">
              <dt className="text-muted-foreground text-sm">{text.change}</dt>
              <dd className="font-display font-semibold text-figure tabular-nums tracking-section">
                {data.kpis.changeBasisPoints === null
                  ? text.noPrevious
                  : `${data.kpis.changeBasisPoints > 0 ? '+' : ''}${percent(data.kpis.changeBasisPoints)}`}
              </dd>
            </div>
            <div className="flex flex-col gap-1 rounded-lg bg-card p-4">
              <dt className="text-muted-foreground text-sm">{text.share}</dt>
              <dd className="font-display font-semibold text-figure tabular-nums tracking-section">
                {data.kpis.shareBasisPoints === null
                  ? text.shareUnknown
                  : percent(data.kpis.shareBasisPoints)}
              </dd>
            </div>
          </dl>
        </section>
      )}
      <SegmentedControl
        label={text.by}
        value={by}
        options={(['bu', 'warengruppe'] as const).map((value) => ({
          value,
          label: text.byOptions[value] ?? value,
        }))}
        onChange={(value) =>
          void navigate({
            to: base,
            search: value === 'bu' ? {} : { nach: value },
            replace: true,
          })
        }
      />
      <SpendChart
        title={
          data.kpis
            ? text.chartTitle(data.kpis.year, format.money(data.kpis.amount))
            : text.chartTitleEmpty
        }
        rows={rows}
        series={series}
        formatMoney={money}
        formatAxis={(cents) =>
          new Intl.NumberFormat(format.locale, {
            style: 'currency',
            currency: data.currency ?? 'EUR',
            notation: 'compact',
            maximumFractionDigits: 1,
          }).format(cents / 100)
        }
        empty={{ title: text.chartEmptyTitle, description: text.chartEmptyText }}
        kindNames={{ actual: text.kinds.actual ?? '', plan: text.kinds.plan ?? '' }}
      />
      {rows.some((row) => row.kind === 'plan') && (
        <p className="text-muted-foreground text-sm">{text.planHint}</p>
      )}
      {data.otherCurrencies.length > 0 && (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {text.otherCurrencies(data.otherCurrencies.join(', '))}
        </p>
      )}
      {data.years.length > 0 && (
        <section aria-labelledby="spend-summen" className="flex flex-col gap-3">
          <h2 id="spend-summen" className="font-semibold text-lg">
            {text.totals}
          </h2>
          <Table>
            <caption className="sr-only">{text.totals}</caption>
            <TableHeader>
              <TableRow>
                <TableHead>{text.year}</TableHead>
                <TableHead>{text.kind}</TableHead>
                <TableHead className="text-right">{text.amount}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...data.years].reverse().map((year) => (
                <TableRow key={`${year.year}-${year.kind}`}>
                  <TableCell className="font-medium tabular-nums">{year.year}</TableCell>
                  <TableCell>{text.kinds[year.kind]}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(year.amountCents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
      {data.entries.length > 0 && (
        <section aria-labelledby="spend-eintraege" className="flex flex-col gap-3">
          <h2 id="spend-eintraege" className="font-semibold text-lg">
            {text.entries}
          </h2>
          <Table>
            <caption className="sr-only">{text.entries}</caption>
            <TableHeader>
              <TableRow>
                <TableHead>{text.year}</TableHead>
                <TableHead>{text.kind}</TableHead>
                <TableHead>{text.businessUnit}</TableHead>
                <TableHead>{text.materialGroup}</TableHead>
                <TableHead className="text-right">{text.amount}</TableHead>
                {data.canEdit && <TableHead className="sr-only">{text.edit}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium tabular-nums">{entry.year}</TableCell>
                  <TableCell>{text.kinds[entry.kind]}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.businessUnit?.name ?? (entry.materialGroup ? '–' : text.wholeSupplier)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.materialGroup?.name ?? (entry.businessUnit ? '–' : text.wholeSupplier)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {format.money(entry.amount)}
                  </TableCell>
                  {data.canEdit && (
                    <TableCell className="text-right">
                      {routerLink({
                        href: `${base}/${entry.id}`,
                        className: buttonVariants({ variant: 'ghost' }),
                        'aria-label': text.editLabel(entry.year),
                        children: text.edit,
                      })}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </>
  );
}
