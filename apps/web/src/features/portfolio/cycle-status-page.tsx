import type { CycleStatusQuery } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useId } from 'react';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { Figure } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { SegmentedControl } from '@/components/ui/segmented-control';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { cycleStatusQueryOptions } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { segmentsHref } from '@/features/relationships/lenses';

export function useCycleStatus(query: CycleStatusQuery = {}) {
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  return useQuery({
    ...cycleStatusQueryOptions(accessToken, query),
    enabled: accessToken !== '',
  });
}

/**
 * Portfolio › Stand der Zyklen (ZYK-04): je Fokuslieferant Schritt, Fälligkeit, Verzug und
 * JBP-Termin. Ohne Termin zuerst, dann nach Verzug oder Termin. Filter in der Adresse; ein Klick
 * öffnet den Überblick des Lieferanten.
 */
export function CycleStatusPage() {
  const t = useT();
  const text = t.portfolio.cyclesPage;
  const format = useFormat();
  const search = useSearch({ from: '/_app/portfolio/zyklen' });
  const navigate = useNavigate({ from: '/portfolio/zyklen' });
  const query = useCycleStatus(search);
  const sroId = useId();
  const unitId = useId();
  const groupId = useId();
  const update = (next: Partial<CycleStatusQuery>) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });
  const options = query.data?.options;

  const filter = (
    id: string,
    label: string,
    value: string | undefined,
    entries: { id: string; name: string }[] | undefined,
    key: 'sro' | 'bu' | 'wg',
  ) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-muted-foreground text-sm">
        {label}
      </label>
      <NativeSelect
        id={id}
        value={value ?? ''}
        className="h-11 rounded-full pl-4"
        onChange={(event) => update({ [key]: event.target.value || undefined })}
      >
        <option value="">{text.all}</option>
        {entries?.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );

  return (
    <>
      <PagePath
        trail={[{ label: t.portfolio.segmentsLabel, href: segmentsHref }]}
        current={text.title}
      />
      <PageHeader size="list" title={text.title} purpose={text.purpose} />
      {query.data && (
        <dl aria-label={text.metricsLabel} className="grid gap-3 sm:grid-cols-3">
          {(['total', 'onTrack', 'overdue'] as const).map((key) => (
            <div key={key} data-metric={key}>
              <dt className="sr-only">{text.metrics[key]}</dt>
              <dd>
                <Figure label={text.metrics[key]} value={query.data.metrics[key]} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {filter(sroId, text.sro, search.sro, options?.sros, 'sro')}
        {filter(unitId, text.businessUnit, search.bu, options?.businessUnits, 'bu')}
        {filter(groupId, text.materialGroup, search.wg, options?.materialGroups, 'wg')}
      </div>
      <SegmentedControl
        label={text.sortLabel}
        value={search.sortierung ?? 'verzug'}
        onChange={(sortierung) =>
          update({ sortierung: sortierung === 'verzug' ? undefined : sortierung })
        }
        options={[
          { value: 'verzug', label: text.sortOverdue },
          { value: 'termin', label: text.sortDate },
        ]}
      />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : query.data.rows.length === 0 ? (
        <EmptyState title={text.emptyTitle} description={text.emptyText} />
      ) : (
        <Table>
          <TableCaption className="sr-only">{text.title}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{text.columns.supplier}</TableHead>
              <TableHead>{text.columns.sro}</TableHead>
              <TableHead>{text.columns.step}</TableHead>
              <TableHead>{text.columns.due}</TableHead>
              <TableHead>{text.columns.overdue}</TableHead>
              <TableHead>{text.columns.jbp}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.rows.map((row) => (
              <TableRow key={row.relationshipId} data-relationship={row.relationshipId}>
                <TableCell className="font-semibold">
                  {routerLink({
                    href: `/lieferanten/${row.relationshipId}`,
                    className:
                      'inline-flex min-h-11 items-center text-text underline-offset-4 hover:text-petrol-dark hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    children: row.supplier,
                  })}
                </TableCell>
                <TableCell>{row.sro ?? text.open}</TableCell>
                <TableCell>
                  {row.step
                    ? t.workspace.cycle.steps[row.step]
                    : row.hasCycle
                      ? text.done
                      : text.noCycle}
                </TableCell>
                <TableCell className="tabular-nums">
                  {row.dueDate ? format.date(row.dueDate) : '–'}
                </TableCell>
                <TableCell>
                  {row.daysOverdue > 0 ? (
                    <Badge variant="danger">{text.days(row.daysOverdue)}</Badge>
                  ) : row.hasCycle ? (
                    <Badge variant="success">{text.onTrack}</Badge>
                  ) : (
                    '–'
                  )}
                </TableCell>
                <TableCell className="tabular-nums">
                  {row.jbpDate ? (
                    format.date(row.jbpDate)
                  ) : (
                    <Badge variant="warning">{text.dateMissing}</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
