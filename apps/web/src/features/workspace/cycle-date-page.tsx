import { calculateCycleDueDate, type SupplierCycle } from '@reziproq/shared';
import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-group';
import { StatusLine } from '@/components/ui/status-line';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { useSupplier } from '@/features/suppliers/use-supplier';
import { setSupplierJbpDate } from '@/lib/api';
import { useLocale, useT } from '@/lib/i18n';
import { useOverview } from './use-overview';

export function CycleDatePage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const supplier = useSupplier(relationshipId);
  const overview = useOverview(relationshipId);

  if (supplier.isError) return <ErrorState title={t.workspace.failed} />;
  if (!supplier.data) return <LoadingState label={t.suppliers.detailLoading} />;

  return (
    <>
      <PagePath
        trail={[
          { label: t.suppliers.title, href: '/beziehungen' },
          { label: supplier.data.name, href: `/lieferanten/${relationshipId}` },
        ]}
        current={t.workspace.cycle.dateTitle}
      />
      <PageHeader title={t.workspace.cycle.dateTitle} purpose={t.workspace.cycle.datePurpose} />
      {overview.isError ? (
        <ErrorState title={t.workspace.cycle.dateFailed} />
      ) : !overview.data ? (
        <LoadingState label={t.workspace.cycle.dateLoading} />
      ) : !overview.data.cycle ? (
        <EmptyState
          size="lg"
          title={t.workspace.cycle.dateNoCycle}
          description={t.workspace.cycle.dateNoCycleHint}
          action={
            <Button asChild variant="outline">
              {routerLink({
                href: `/lieferanten/${relationshipId}`,
                className: '',
                children: t.workspace.overview,
              })}
            </Button>
          }
        />
      ) : !overview.data.canSetJbpDate ? (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {t.workspace.cycle.dateNoPermission}
        </p>
      ) : (
        <CycleDateForm relationshipId={relationshipId} cycle={overview.data.cycle} />
      )}
    </>
  );
}

function CycleDateForm({
  relationshipId,
  cycle,
}: {
  relationshipId: string;
  cycle: SupplierCycle;
}) {
  const t = useT();
  const { locale } = useLocale();
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const [jbpDate, setJbpDate] = useState(cycle.jbpDate ?? '');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFailed(false);
    setSaved(false);
    try {
      const result = await setSupplierJbpDate(accessToken, relationshipId, jbpDate);
      setJbpDate(result.jbpDate ?? '');
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['suppliers', relationshipId] });
      await queryClient.invalidateQueries({ queryKey: ['start'] });
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const deadlines = cycle.schedule.map((setting) => ({
    ...setting,
    dueDate: jbpDate ? calculateCycleDueDate(jbpDate, setting.weeksRelativeToJbp) : null,
  }));
  const displayDate = (date: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${date}T00:00:00`));

  return (
    <form className="flex max-w-3xl flex-col gap-6" onSubmit={(event) => void save(event)}>
      {saved && <StatusLine message={t.workspace.cycle.dateSaved} />}
      {failed && <StatusLine message={t.workspace.cycle.dateSaveFailed} tone="warning" />}
      <SettingsGroup>
        <SettingsRow label={t.workspace.cycle.dateLabel} htmlFor="jbp-date">
          <Input
            id="jbp-date"
            type="date"
            required
            value={jbpDate}
            onChange={(event) => {
              setJbpDate(event.target.value);
              setSaved(false);
            }}
          />
        </SettingsRow>
      </SettingsGroup>
      <section aria-labelledby="cycle-deadline-preview" className="space-y-3">
        <h2 id="cycle-deadline-preview" className="font-semibold text-lg">
          {t.workspace.cycle.datePreview}
        </h2>
        {jbpDate ? (
          <ul className="divide-y divide-line-soft rounded-lg bg-card px-4">
            {deadlines.map(({ step, dueDate }) => (
              <li key={step} className="flex min-h-12 items-center justify-between gap-4 py-2">
                <span>{t.workspace.cycle.steps[step]}</span>
                <span className="text-muted-foreground text-right">
                  {dueDate ? displayDate(dueDate) : '–'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
            {t.workspace.cycle.datePreviewEmpty}
          </p>
        )}
      </section>
      <Button className="self-start" loading={saving} type="submit">
        {t.workspace.cycle.dateSave}
      </Button>
    </form>
  );
}
