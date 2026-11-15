import { type Lever, leverTemplates } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckIcon, ClipboardCheckIcon } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { LoadingState } from '@/components/ui/loading-state';
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
import { useToken } from '@/features/jbp/jbp-pages';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { decideValidation, validationQueryOptions, validationsQueryOptions } from '@/lib/api';
import { flash, useFlash } from '@/lib/flash';
import { useFormat } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { MaturitySteps } from './impact-pages';

// PNL-06: Freigaben durch Controlling unter Wirkung › Freigaben, über alle Lieferanten.

const listPath = '/wirkung/freigaben';

function useMonth() {
  const { locale } = useLocale();
  const format = new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' });
  return (iso: string) => format.format(new Date(`${iso.slice(0, 7)}-01T00:00:00`));
}

const statusVariant = { requested: 'neutral', approved: 'success', rejected: 'warning' } as const;

/** Liste der Anfragen; offene zuerst. */
export function ValidationsPage() {
  const t = useT();
  const text = t.impact;
  const accessToken = useToken();
  const month = useMonth();
  const format = useFormat();
  const [message, hideMessage] = useFlash();
  const query = useQuery({ ...validationsQueryOptions(accessToken), enabled: accessToken !== '' });
  const rows = [...(query.data?.validations ?? [])].sort(
    (a, b) => Number(b.status === 'requested') - Number(a.status === 'requested'),
  );
  return (
    <>
      <PagePath trail={[{ label: text.title, href: '/wirkung' }]} current={text.validationsTitle} />
      <PageHeader size="list" title={text.validationsTitle} purpose={text.validationsPurpose} />
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      {query.isError ? (
        <ErrorState title={text.validationsFailed} />
      ) : !query.data ? (
        <LoadingState label={text.validationsLoading} />
      ) : rows.length === 0 ? (
        <EmptyState
          size="lg"
          icon={<ClipboardCheckIcon aria-hidden />}
          title={text.validationsEmpty}
          description={text.validationsPurpose}
        />
      ) : (
        <ul data-slot="validation-list" className="overflow-hidden rounded-lg bg-card shadow-card">
          {rows.map((entry) => (
            <li
              key={entry.id}
              data-validation={entry.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 border-line-soft border-b px-5 py-4 last:border-b-0"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                {routerLink({
                  href: `${listPath}/${entry.id}`,
                  className:
                    'font-semibold hover:underline focus-visible:underline focus-visible:outline-none',
                  children: entry.initiative,
                })}
                <span className="text-muted-foreground text-sm">
                  {entry.supplier} ·{' '}
                  {text.validationPeriod(month(entry.periodFrom), month(entry.periodTo))} ·{' '}
                  {text.validationBy(entry.requestedByName, format.date(entry.requestedAt))}
                </span>
              </span>
              <Badge variant={statusVariant[entry.status]}>
                {text.validationStatuses[entry.status]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Prüfseite: Rechenregel mit Version, Baseline, Monatswerte mit Eingaben, Beträge, Nachweise. */
export function ValidationReviewPage({ validationId }: { validationId: string }) {
  const t = useT();
  const text = t.impact;
  const accessToken = useToken();
  const { locale } = useLocale();
  const month = useMonth();
  const format = useFormat();
  const queryClient = useQueryClient();
  const query = useQuery({
    ...validationQueryOptions(accessToken, validationId),
    enabled: accessToken !== '',
  });
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const money = (cents: number) => formatMoney({ amountCents: cents, currency: 'EUR' }, locale);
  const data = query.data;
  const title = data?.validation.initiative ?? text.validationsTitle;
  const decide = async (decision: 'approved' | 'rejected') => {
    if (decision === 'rejected' && !reason.trim()) {
      setReasonError(text.required);
      return;
    }
    setReasonError(null);
    setFailed(false);
    setBusy(true);
    try {
      await decideValidation(accessToken, validationId, {
        decision,
        comment: decision === 'rejected' ? reason.trim() : null,
      });
      await queryClient.invalidateQueries({ queryKey: ['validations'] });
      flash.set(text.decided);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  const shown = (kind: string, value: string | undefined) => {
    if (value === undefined) return '–';
    return kind === 'money'
      ? money(Number(value))
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(Number(value));
  };
  const template = data ? leverTemplates[data.impact.lever as Lever] : null;
  return (
    <>
      <PagePath
        trail={[
          { label: text.title, href: '/wirkung' },
          { label: text.validationsTitle, href: listPath },
        ]}
        current={title}
      />
      <PageHeader title={title} purpose={text.reviewPurpose} />
      {query.isError ? (
        <ErrorState title={text.validationsFailed} />
      ) : !data || !template ? (
        <LoadingState label={text.validationsLoading} />
      ) : (
        <div className="flex max-w-4xl flex-col gap-8">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={statusVariant[data.validation.status]}>
              {text.validationStatuses[data.validation.status]}
            </Badge>
            <span>
              {data.validation.supplier} ·{' '}
              {text.validationPeriod(
                month(data.validation.periodFrom),
                month(data.validation.periodTo),
              )}
            </span>
          </div>

          <section aria-labelledby="pruefung-regel" className="flex flex-col gap-2">
            <h2
              id="pruefung-regel"
              className="font-display font-semibold text-section tracking-section"
            >
              {text.reviewRule}
            </h2>
            <p>
              {text.levers[data.impact.lever]} ·{' '}
              {text.ruleLabel(
                text.leverRules[data.impact.lever] ?? '',
                data.impact.leverTemplateVersion,
              )}
            </p>
            <p className="text-muted-foreground text-sm">
              {text.pnlLineLabel}: {data.impact.pnlLine.name} · {text.effectLabel}:{' '}
              {text.effects[data.impact.effectType]}
            </p>
          </section>

          <section aria-labelledby="pruefung-baseline" className="flex flex-col gap-2">
            <h2
              id="pruefung-baseline"
              className="font-display font-semibold text-section tracking-section"
            >
              {text.reviewBaseline}
            </h2>
            {data.baseline ? (
              <>
                <p className="text-muted-foreground text-sm">
                  {text.baselineVersion(
                    data.baseline.version,
                    data.baseline.frozenByName,
                    format.dateTime(data.baseline.frozenAt),
                  )}
                </p>
                <dl className="flex flex-wrap gap-x-8 gap-y-2 rounded-lg bg-card shadow-card p-5">
                  {template.baseline.map((field) => (
                    <div key={field.key} className="flex flex-col">
                      <dt className="text-muted-foreground text-sm">{text.inputs[field.key]}</dt>
                      <dd className="font-semibold tabular-nums">
                        {shown(field.kind, data.baseline?.inputs[field.key])}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="text-muted-foreground">{text.baselineEmpty}</p>
            )}
          </section>

          <section aria-labelledby="pruefung-monate" className="flex flex-col gap-2">
            <h2
              id="pruefung-monate"
              className="font-display font-semibold text-section tracking-section"
            >
              {text.reviewMonths}
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{text.monthColumn}</TableHead>
                  {template.month.map((field) => (
                    <TableHead key={field.key}>{text.inputs[field.key]}</TableHead>
                  ))}
                  <TableHead>{text.kinds.plan}</TableHead>
                  <TableHead>{text.kinds.actual}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.months.map((row) => (
                  <TableRow key={row.month} data-month={row.month}>
                    <TableCell>{month(row.month)}</TableCell>
                    {template.month.map((field) => (
                      <TableCell key={field.key} className="tabular-nums">
                        {shown(field.kind, row.actual?.inputs[field.key])}
                      </TableCell>
                    ))}
                    <TableCell className="tabular-nums">
                      {row.plan?.amountCents == null ? '–' : money(row.plan.amountCents)}
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {row.actual?.amountCents == null ? '–' : money(row.actual.amountCents)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-semibold">{text.total}</TableCell>
                  {template.month.map((field) => (
                    <TableCell key={field.key} />
                  ))}
                  <TableCell className="tabular-nums">{money(data.totals.plan)}</TableCell>
                  <TableCell className="font-semibold tabular-nums">
                    {money(data.totals.actual)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </section>

          <section aria-labelledby="pruefung-nachweise" className="flex flex-col gap-2">
            <h2
              id="pruefung-nachweise"
              className="font-display font-semibold text-section tracking-section"
            >
              {text.reviewEvidence}
            </h2>
            <MaturitySteps maturity={data.maturity} />
          </section>

          {data.canDecide ? (
            <section
              data-slot="decision"
              className="flex flex-col gap-4 rounded-lg bg-card shadow-card p-5"
            >
              <Button className="self-start" loading={busy} onClick={() => void decide('approved')}>
                <CheckIcon aria-hidden />
                {text.approve}
              </Button>
              <div className="flex flex-col gap-3 border-line-soft border-t pt-4">
                <FormField
                  label={text.rejectReason}
                  hint={text.rejectHint}
                  error={reasonError ?? undefined}
                >
                  {(field) => (
                    <Textarea
                      {...field}
                      rows={3}
                      maxLength={2000}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  )}
                </FormField>
                <Button
                  variant="outline"
                  className="self-start"
                  onClick={() => void decide('rejected')}
                >
                  {text.reject}
                </Button>
              </div>
              {failed && (
                <p role="alert" className="text-destructive">
                  {text.saveFailed}
                </p>
              )}
            </section>
          ) : (
            data.validation.status === 'requested' && (
              <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
                {text.onlyControlling}
              </p>
            )
          )}
          {data.validation.comment && (
            <p className="rounded-lg bg-card px-4 py-3">
              {text.rejectReason}: {data.validation.comment}
            </p>
          )}
        </div>
      )}
    </>
  );
}
