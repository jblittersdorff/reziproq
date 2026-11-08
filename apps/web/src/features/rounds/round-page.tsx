import type { RoundDetail, RoundSupplier } from '@reziproq/shared';
import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { closeRound, extendRound } from '@/lib/api';
import { useFlash } from '@/lib/flash';
import { useLocale, useT } from '@/lib/i18n';
import { errorCode, formatDate, isNotFound, roundsPath, useRound, useToken } from './use-round';

const statusVariant = { draft: 'neutral', open: 'selected', closed: 'success' } as const;

/** Seite einer Runde: Fortschritt je Lieferant, Frist verlängern, Schließen, Nachnominieren. */
export function RoundPage({ id }: { id: string }) {
  const t = useT();
  const query = useRound(id);
  const [flashMessage, hideFlash] = useFlash();
  const round = query.data;

  return (
    <>
      <PagePath
        trail={[
          { label: t.portfolio.title, href: '/portfolio' },
          { label: t.rounds.title, href: roundsPath },
        ]}
        current={round?.name ?? t.rounds.title}
      />
      <PageHeader
        title={round?.name ?? t.rounds.title}
        purpose={t.rounds.purpose}
        badge={
          round && (
            <Badge variant={statusVariant[round.status]}>{t.rounds.status[round.status]}</Badge>
          )
        }
      />
      {flashMessage && <StatusLine message={flashMessage} onHidden={hideFlash} />}
      {query.isError ? (
        <ErrorState
          title={isNotFound(query.error) ? t.rounds.notFound : t.rounds.failed}
          action={routerLink({
            href: roundsPath,
            className: 'text-primary underline-offset-4 hover:underline',
            children: t.rounds.toRounds,
          })}
        />
      ) : !round ? (
        <LoadingState label={t.rounds.loading} />
      ) : (
        <RoundBody round={round} />
      )}
    </>
  );
}

function RoundBody({ round }: { round: RoundDetail }) {
  const t = useT();
  const { locale } = useLocale();
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const canNominate = round.suppliers.some((supplier) => supplier.canNominate);

  const update = async (request: () => Promise<RoundDetail>, done: string, failed: string) => {
    setFailure(null);
    setMessage(null);
    try {
      const saved = await request();
      queryClient.setQueryData(['rounds', round.id], saved);
      await queryClient.invalidateQueries({ queryKey: ['rounds'], exact: true });
      setMessage(done);
      return true;
    } catch (error) {
      setFailure(errorCode(error) === 'due_date_not_later' ? t.rounds.extendFailed : failed);
      return false;
    }
  };

  const extend = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const ok = await update(
      () => extendRound(accessToken, round.id, { dueDate }),
      t.rounds.extended,
      t.rounds.extendFailed,
    );
    setSaving(false);
    if (ok) setDueDate('');
  };

  const close = () => {
    void update(() => closeRound(accessToken, round.id), t.rounds.closed, t.rounds.closeFailed);
  };

  return (
    <div className="flex flex-col gap-8">
      {failure && <StatusLine message={failure} tone="warning" />}
      {message && <StatusLine message={message} />}
      <p className="text-muted-foreground">
        {t.rounds.due(formatDate(locale, round.dueDate))} ·{' '}
        {t.rounds.progress(round.submitted, round.total)}
        {round.modelVersion !== null && ` · ${t.rounds.modelVersion(round.modelVersion)}`}
      </p>
      {round.status === 'draft' &&
        routerLink({
          href: `${roundsPath}/${round.id}/name`,
          className: `${buttonVariants()} self-start`,
          children: t.rounds.continueDraft,
        })}
      {round.status === 'open' &&
        canNominate &&
        routerLink({
          href: `${roundsPath}/${round.id}/nachnominieren`,
          className: `${buttonVariants()} self-start`,
          children: t.rounds.nominate,
        })}
      {round.status === 'closed' && <p className="text-muted-foreground">{t.rounds.closedHint}</p>}
      {round.status === 'open' && round.canManage && (
        <div className="flex flex-wrap items-end gap-6">
          <form noValidate onSubmit={extend} className="flex flex-wrap items-end gap-3">
            <FormField label={t.rounds.newDue}>
              {(field) => (
                <Input
                  {...field}
                  type="date"
                  min={round.dueDate}
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              )}
            </FormField>
            <Button type="submit" variant="secondary" loading={saving} disabled={dueDate === ''}>
              {t.rounds.extendSave}
            </Button>
          </form>
          <ConfirmButton
            question={t.rounds.confirmClose}
            confirmLabel={t.rounds.confirmCloseYes}
            cancelLabel={t.rounds.cancel}
            onConfirm={close}
          >
            {t.rounds.close}
          </ConfirmButton>
        </div>
      )}
      {round.suppliers.map((supplier) => (
        <SupplierSection key={supplier.relationshipId} supplier={supplier} />
      ))}
    </div>
  );
}

function SupplierSection({ supplier }: { supplier: RoundSupplier }) {
  const t = useT();
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex flex-wrap items-baseline gap-3 font-semibold text-lg">
        {supplier.name}
        <span className="font-normal text-muted-foreground text-sm">
          {t.rounds.progress(supplier.submitted, supplier.total)}
        </span>
      </h3>
      <ul className="flex flex-col divide-y divide-border rounded-md border">
        {supplier.assignments.map((assignment) => (
          <li
            key={assignment.id}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-3"
          >
            <span className="flex min-w-0 flex-col">
              <span>
                {assignment.businessUnit.name} ·{' '}
                {assignment.materialGroup?.name ?? t.rounds.groupNone} ·{' '}
                {t.roles.functions[assignment.function]}
              </span>
              <span className="text-muted-foreground text-sm">
                {t.rounds.rater}: {assignment.rater?.name ?? t.rounds.unassigned}
              </span>
            </span>
            <Badge variant={assignment.status === 'submitted' ? 'success' : 'neutral'}>
              {t.rounds.assignmentStatus[assignment.status]}
            </Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}
