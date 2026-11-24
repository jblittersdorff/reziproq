import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { ListCard, ListCardHeader, ListRow, ListRowText } from '@/components/ui/list-card';
import { LoadingState } from '@/components/ui/loading-state';
import { NextStep, NextStepArrow } from '@/components/ui/next-step';
import { RangeBars } from '@/components/ui/range-bars';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tile } from '@/components/ui/tile';
import { Statement } from '@/features/insights/statement';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { valueOverviewQueryOptions } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { Totals, useFormatters } from './opportunity-pages';

const supplierPage = (relationshipId: string) =>
  `/lieferanten/${relationshipId}/wirkung/wertpotenziale`;

/**
 * Wertpotenziale über alle Lieferanten (KI-11, Ablauf 7), nach Vorlage KI-Wert-Uebersicht.neu: drei
 * Zahlen, größtes neues Potenzial als nächster Schritt, Tabelle je Lieferant; rechts häufigste
 * Hebel, Marktsignale mit Wirkung und häufigste Datenlücken.
 */
export function ValueOverviewPage() {
  const t = useT();
  const text = t.opportunities;
  const overview = text.overview;
  const accessToken = useToken();
  const format = useFormatters();
  const query = useQuery({
    ...valueOverviewQueryOptions(accessToken),
    enabled: accessToken !== '',
  });
  const data = query.data;
  const header = (
    <>
      <PagePath
        trail={[{ label: t.insights.overviewTitle, href: '/wert' }]}
        current={text.pageTitle}
      />
      <PageHeader size="list" title={overview.title} purpose={overview.purpose} />
    </>
  );
  if (query.isError)
    return (
      <>
        {header}
        <ErrorState title={text.failed} />
      </>
    );
  if (!data)
    return (
      <>
        {header}
        <LoadingState label={text.loading} />
      </>
    );
  const range = (value: { low: number; high: number } | null) =>
    value ? format.range(value) : '–';
  const biggest = data.biggest;
  return (
    <>
      {header}
      <div className="grid items-start gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          <Statement statement={data.statement} />
          <Totals data={data} note={overview.lowExcluded(data.counts.lowExcluded)} />
          <NextStep
            eyebrow={overview.biggestEyebrow}
            title={
              biggest
                ? overview.biggestTitle(
                    biggest.supplierName,
                    text.templates[biggest.templateKey] ?? '',
                  )
                : overview.noneTitle
            }
            text={
              biggest
                ? overview.biggestText(
                    format.range(biggest.buyer),
                    text.impact[biggest.impactType] ?? '',
                    text.confidence[biggest.confidence] ?? '',
                  )
                : overview.noneText
            }
            action={
              biggest ? (
                <Button variant="mint" size="hero" asChild>
                  {routerLink({
                    href: supplierPage(biggest.relationshipId),
                    className: '',
                    children: (
                      <>
                        {overview.view}
                        <NextStepArrow />
                      </>
                    ),
                  })}
                </Button>
              ) : undefined
            }
          />
          {data.suppliers.some((entry) => entry.ebitNew) && (
            <Tile className="gap-4">
              <h2 className="font-display font-semibold text-section tracking-section">
                {overview.rangeTitle}
              </h2>
              <RangeBars
                label={overview.rangeTitle}
                rows={data.suppliers.flatMap((entry) =>
                  entry.ebitNew
                    ? [
                        {
                          key: entry.relationshipId,
                          label: entry.name,
                          text: entry.name,
                          low: entry.ebitNew.low,
                          high: entry.ebitNew.high,
                        },
                      ]
                    : [],
                )}
                format={(low, high) => format.range({ low, high })}
                note={overview.rangeNote}
              />
            </Tile>
          )}
          {data.suppliers.length === 0 ? (
            <p className="rounded-lg bg-card px-4 py-3 text-muted-foreground">{overview.empty}</p>
          ) : (
            <ListCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{overview.supplier}</TableHead>
                    <TableHead className="text-right">{overview.newCount}</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">
                      {overview.adoptedCount}
                    </TableHead>
                    <TableHead className="text-right">{overview.ebitNew}</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">
                      {overview.cashNew}
                    </TableHead>
                    <TableHead className="hidden md:table-cell">{overview.confidence}</TableHead>
                    <TableHead className="hidden md:table-cell">{overview.nextStep}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.suppliers.map((entry) => (
                    <TableRow key={entry.relationshipId}>
                      <TableCell className="whitespace-normal font-semibold">
                        {routerLink({
                          href: supplierPage(entry.relationshipId),
                          className: 'text-primary underline-offset-4 hover:underline',
                          children: entry.name,
                        })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{entry.newCount}</TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        {entry.adoptedCount}
                      </TableCell>
                      <TableCell className="whitespace-normal text-right tabular-nums">
                        {range(entry.ebitNew)}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        {range(entry.cashNew)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {entry.confidence ? overview.confidenceShort[entry.confidence] : '–'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {overview.next[entry.nextStep]}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="border-line-soft border-t px-5.5 py-3.5 text-muted-foreground text-sm">
                {overview.tableNote}
              </p>
            </ListCard>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <ListCard aria-labelledby="wpu-hebel">
            <ListCardHeader id="wpu-hebel" title={overview.leversTitle} />
            {data.levers.length === 0 ? (
              <p className="px-5.5 pb-5 text-muted-foreground text-sm">{overview.nothingYet}</p>
            ) : (
              data.levers.map((lever) => (
                <ListRow key={lever.templateKey}>
                  <ListRowText title={text.templates[lever.templateKey]} />
                  <span className="font-semibold tabular-nums">{lever.count}</span>
                </ListRow>
              ))
            )}
          </ListCard>
          <ListCard aria-labelledby="wpu-signale">
            <ListCardHeader id="wpu-signale" title={overview.signalsTitle} />
            {data.signals.length === 0 ? (
              <p className="px-5.5 pb-5 text-muted-foreground text-sm">{overview.nothingYet}</p>
            ) : (
              data.signals.map((signal) => (
                <ListRow key={signal.title}>
                  <ListRowText
                    title={signal.title}
                    detail={overview.suppliersCount(signal.suppliers)}
                  />
                </ListRow>
              ))
            )}
          </ListCard>
          <ListCard aria-labelledby="wpu-luecken">
            <ListCardHeader id="wpu-luecken" title={overview.gapsTitle} />
            {data.dataGaps.length === 0 ? (
              <p className="px-5.5 pb-5 text-muted-foreground text-sm">{overview.nothingYet}</p>
            ) : (
              data.dataGaps.map((gap) => (
                <ListRow key={gap.dataKey}>
                  <ListRowText
                    title={gap.description}
                    detail={overview.suppliersCount(gap.suppliers)}
                  />
                </ListRow>
              ))
            )}
            <p className="border-line-soft border-t px-5.5 py-3.5 text-muted-foreground text-sm">
              {overview.gapsNote}
            </p>
          </ListCard>
        </div>
      </div>
    </>
  );
}
