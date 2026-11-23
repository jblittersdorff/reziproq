import type { CategoryConflict, SupplierCategories } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { AiDraft } from '@/components/ui/ai-draft';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { LoadingState } from '@/components/ui/loading-state';
import { Monogram } from '@/components/ui/monogram';
import { NextStep, NextStepArrow } from '@/components/ui/next-step';
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
import { Textarea } from '@/components/ui/textarea';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { SupplierFrame } from '@/features/suppliers/supplier-frame';
import { InternalBadge } from '@/features/workspace/internal-badge';
import {
  adoptSegmentProposal,
  resolveCategoryConflict,
  supplierCategoriesQueryOptions,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';

const card = 'flex flex-col gap-3 rounded-lg bg-card p-5 shadow-card';

/**
 * WG-20 (nach Vorlage L-Warengruppen.neu.dc.html): Strategie › Warengruppen. Je Warengruppe Lead,
 * Umsatz, Anteil dort, Segment Ist, Soll-Typ und Stand der Strategie; Widersprüche als nächster
 * Schritt und mit Lösen; Vorschlag für das Gesamtsegment als Entwurf von Reziproq mit Rechenweg.
 * Übergaben in den Lieferantenplan und „Einschätzung anfragen“ folgen in 31b.
 */
export function SupplierCategoriesPage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = t.supplierCategories;
  const accessToken = useToken();
  const client = useQueryClient();
  const options = supplierCategoriesQueryOptions(accessToken, relationshipId);
  const query = useQuery({ ...options, enabled: accessToken !== '' });
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  const run = async (work: (token: string) => Promise<SupplierCategories>) => {
    setMessage(null);
    setFailure(null);
    try {
      client.setQueryData(options.queryKey, await work(accessToken));
      setMessage(text.saved);
      return true;
    } catch (error) {
      const code = (error as { body?: { code?: string } }).body?.code;
      setFailure((code && text.errors[code]) || text.saveFailed);
      return false;
    }
  };

  return (
    <SupplierFrame relationshipId={relationshipId} area="strategy" current={text.page}>
      {(supplier) => {
        const data = query.data;
        return (
          <>
            <PageHeader
              title={text.title(supplier.name)}
              purpose={text.purpose}
              badge={<InternalBadge />}
            />
            {message && <StatusLine message={message} onHidden={() => setMessage(null)} />}
            {failure && <StatusLine message={failure} tone="warning" />}
            {query.isError ? (
              <ErrorState title={text.failed} />
            ) : !data ? (
              <LoadingState label={text.loading} />
            ) : data.rows.length === 0 ? (
              <p className="rounded-lg bg-card p-5 text-muted-foreground shadow-card">
                {text.empty}
              </p>
            ) : (
              <Content
                data={data}
                resolving={resolving}
                setResolving={setResolving}
                onResolve={(conflict, status, note) =>
                  run((token) => resolveCategoryConflict(token, conflict.id, { status, note }))
                }
                onAdopt={() => run((token) => adoptSegmentProposal(token, relationshipId))}
              />
            )}
          </>
        );
      }}
    </SupplierFrame>
  );
}

function Content({
  data,
  resolving,
  setResolving,
  onResolve,
  onAdopt,
}: {
  data: SupplierCategories;
  resolving: string | null;
  setResolving: (id: string | null) => void;
  onResolve: (
    conflict: CategoryConflict,
    status: 'aligned' | 'accepted',
    note: string,
  ) => Promise<boolean>;
  onAdopt: () => Promise<boolean>;
}) {
  const text = useT().supplierCategories;
  const format = useFormat();
  const money = (cents: number) =>
    format.money({ amountCents: cents, currency: data.currency }, { compact: true });
  const open = data.conflicts.filter((conflict) => conflict.status === 'open');
  const resolvable = open.filter((conflict) => conflict.canResolve);
  const qualities = [
    ...new Set(
      data.rows
        .map((row) => row.qualityLevel)
        .filter((level): level is number => level !== null)
        .map((level) => text.qualities[level - 1] ?? ''),
    ),
  ];
  const groupNames = (conflict: CategoryConflict) =>
    conflict.groups.map((group) => group.name).join(', ');

  return (
    <div className="flex flex-col gap-5">
      {open.length > 0 && (
        <NextStep
          eyebrow={text.conflictEyebrow}
          title={text.conflictTitle(open.length)}
          text={`${text.rules[open[0]?.ruleKey ?? '']?.(groupNames(open[0] as CategoryConflict)) ?? ''} ${text.conflictText}`}
          action={
            resolvable.length > 0 ? (
              <Button
                variant="mint"
                size="hero"
                onClick={() => setResolving(resolvable[0]?.id ?? null)}
              >
                {text.resolve}
                <NextStepArrow />
              </Button>
            ) : undefined
          }
        />
      )}
      <section className={card} aria-label={text.page}>
        <div className="overflow-x-auto">
          <Table className="min-w-180">
            <caption className="sr-only">{text.page}</caption>
            <TableHeader>
              <TableRow>
                <TableHead>{text.columns.group}</TableHead>
                <TableHead className="text-right">{text.columns.spend(data.spendYear)}</TableHead>
                <TableHead className="text-right">{text.columns.share}</TableHead>
                <TableHead>{text.columns.ist}</TableHead>
                <TableHead>{text.columns.soll}</TableHead>
                <TableHead>{text.columns.strategy}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.groupId}>
                  <TableCell>
                    <span className="flex items-center gap-2.5">
                      <Monogram name={row.groupName} tone="ink" />
                      <span className="flex min-w-0 flex-col">
                        {routerLink({
                          href: `/warengruppen/${row.groupId}`,
                          className: 'font-semibold text-text underline-offset-2 hover:underline',
                          children: row.groupName,
                        })}
                        <span className="text-muted-foreground text-sm">
                          {row.lead ? text.lead(row.lead.name) : text.noLead}
                        </span>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(row.amountCents)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {`${Math.round(row.shareInGroup * 100)} %`}
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral" className="whitespace-normal">
                      {row.segmentIst?.name ?? text.noSegment}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={row.sollType?.kind === 'ended' ? 'danger' : 'neutral'}
                      className="whitespace-normal"
                    >
                      {row.sollType?.kind === 'ended'
                        ? text.ended
                        : (row.sollType?.name ?? text.noSegment)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.strategy ? (
                      <Badge variant={row.strategy.status === 'approved' ? 'success' : 'warning'}>
                        {text.strategyState(
                          row.strategy.year,
                          text.states[row.strategy.status] ?? '',
                        )}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">{text.noStrategy}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}

              <TableRow className="border-line border-t-2">
                <TableCell className="font-semibold">{text.total(data.supplierName)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {money(data.totalCents)}
                </TableCell>
                <TableCell colSpan={4} />
              </TableRow>
            </TableBody>
          </Table>
        </div>
        {qualities.length > 1 && (
          <p className="text-muted-foreground text-sm">
            {text.qualitySpread(qualities.join(', '))}
          </p>
        )}
      </section>

      <section aria-labelledby="wg-conflicts" className={card}>
        <h2 id="wg-conflicts" className="font-semibold text-lg">
          {text.conflictsTitle}
        </h2>
        {data.conflicts.length === 0 ? (
          <p className="text-muted-foreground text-sm">{text.noConflicts}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft">
            {data.conflicts.map((conflict) => (
              <ConflictRow
                key={conflict.id}
                conflict={conflict}
                label={text.rules[conflict.ruleKey]?.(groupNames(conflict)) ?? ''}
                open={resolving === conflict.id}
                onOpen={() => setResolving(conflict.id)}
                onClose={() => setResolving(null)}
                onResolve={async (status, note) => {
                  if (await onResolve(conflict, status, note)) setResolving(null);
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Proposal data={data} onAdopt={onAdopt} />
        <aside className={card} aria-labelledby="wg-levels">
          <h2 id="wg-levels" className="font-semibold">
            {text.levelsTitle}
          </h2>
          <dl className="flex flex-col gap-2 text-sm">
            {text.levels.map(([term, body]) => (
              <div key={term}>
                <dt className="font-semibold">{term}</dt>
                <dd className="text-muted-foreground">{body}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </div>
  );
}

function ConflictRow({
  conflict,
  label,
  open,
  onOpen,
  onClose,
  onResolve,
}: {
  conflict: CategoryConflict;
  label: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onResolve: (status: 'aligned' | 'accepted', note: string) => Promise<void>;
}) {
  const text = useT().supplierCategories;
  const format = useFormat();
  const [status, setStatus] = useState<'aligned' | 'accepted'>('aligned');
  const [note, setNote] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onResolve(status, note);
  };
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 basis-64 text-sm">{label}</p>
        <Badge variant={conflict.status === 'open' ? 'warning' : 'success'}>
          {text.statuses[conflict.status]}
        </Badge>
      </div>
      {conflict.status !== 'open' && conflict.decidedAt && (
        <p className="text-muted-foreground text-sm">
          {text.decided(
            text.statuses[conflict.status] ?? '',
            conflict.decidedBy ?? '',
            format.date(conflict.decidedAt),
          )}
          {conflict.note ? `: ${conflict.note}` : ''}
        </p>
      )}
      {conflict.canResolve && !open && (
        <Button size="sm" variant="secondary" className="self-start" onClick={onOpen}>
          {text.resolve}
        </Button>
      )}
      {open && (
        <form aria-label={text.resolveTitle} className="flex flex-col gap-3" onSubmit={submit}>
          <SegmentedControl<'aligned' | 'accepted'>
            label={text.resolveTitle}
            value={status}
            onChange={setStatus}
            options={[
              { value: 'aligned', label: text.aligned },
              { value: 'accepted', label: text.accepted },
            ]}
          />
          <FormField label={status === 'aligned' ? text.alignedNote : text.acceptedNote}>
            {(field) => (
              <Textarea
                {...field}
                rows={3}
                maxLength={2000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            )}
          </FormField>
          <FormActions>
            <Button type="submit" size="sm">
              {text.save}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>
              {text.cancel}
            </Button>
          </FormActions>
        </form>
      )}
    </li>
  );
}

function Proposal({
  data,
  onAdopt,
}: {
  data: SupplierCategories;
  onAdopt: () => Promise<boolean>;
}) {
  const text = useT().supplierCategories;
  const format = useFormat();
  const proposal = data.proposal;
  const value = (n: number | null) => (n === null ? '–' : format.number(n));
  return (
    <AiDraft
      heading={text.proposalHeading}
      sourcesLabel={text.sources}
      sources={(proposal?.sources ?? []).map((source) => ({
        key: source.groupId,
        label: text.weight(
          source.groupName,
          `${format.number(Math.round(source.weight * 1000) / 10)} %`,
        ),
        href: `/warengruppen/${source.groupId}/segmentierung`,
      }))}
      actions={
        <div className="flex flex-wrap gap-2">
          {data.canAdopt && proposal?.ist && proposal.soll && (
            <Button onClick={() => void onAdopt()}>{text.adopt}</Button>
          )}
          {routerLink({
            href: `/lieferanten/${data.relationshipId}/strategie/segmentierung`,
            className: buttonVariants({ variant: 'secondary' }),
            children: text.review,
          })}
        </div>
      }
    >
      {proposal?.ist ? (
        <div className="flex flex-col gap-2">
          <h2 className="font-display font-semibold text-lg">
            {text.proposalTitle(proposal.ist.typeName)}
          </h2>
          {proposal.soll && (
            <p className="font-semibold">{text.proposalSoll(proposal.soll.typeName)}</p>
          )}
          <p className="text-muted-foreground">{text.proposalText}</p>
          <details>
            <summary className="cursor-pointer font-semibold">{text.criteriaTitle}</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {proposal.criteria.map((criterion) => (
                <li key={criterion.criterionKey}>
                  {text.criterion(criterion.label, value(criterion.ist), value(criterion.soll))}
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : (
        <p>{text.proposalNone}</p>
      )}
      {proposal && proposal.skipped.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
          {proposal.skipped.map((entry) => (
            <li key={entry.groupId}>{text.skipped[entry.reason]?.(entry.groupName)}</li>
          ))}
        </ul>
      )}
      {data.decided && (
        <p className="mt-2 text-muted-foreground">
          {text.decidedNow(data.decided.ist, data.decided.soll)}
          {data.decided.origin === 'merged' ? ` · ${text.merged}` : ''}
        </p>
      )}
    </AiDraft>
  );
}
