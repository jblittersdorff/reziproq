import type { ArchivedCycle, NextCyclePreview } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import { useToken } from '@/features/ratings/use-rating';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { useSupplier } from '@/features/suppliers/use-supplier';
import { cycleArchiveQueryOptions, nextCycleQueryOptions, startNextCycle } from '@/lib/api';
import { flash } from '@/lib/flash';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';

function useTrail(relationshipId: string) {
  const t = useT();
  const supplier = useSupplier(relationshipId);
  return [
    { label: t.suppliers.title, href: '/lieferanten' },
    { label: supplier.data?.name ?? '…', href: `/lieferanten/${relationshipId}` },
  ];
}

/**
 * Zyklus starten (ZYK-05): zeigt, was übernommen wird und was neu beginnt, fragt nach dem Termin
 * des nächsten JBP und bestätigt auf der Seite.
 */
export function NextCyclePage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = t.workspace.cycle.next;
  const accessToken = useToken();
  const trail = useTrail(relationshipId);
  const query = useQuery({
    ...nextCycleQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  return (
    <>
      <PagePath trail={trail} current={text.title} />
      <PageHeader title={text.title} purpose={text.purpose} />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : (
        <NextCycleForm relationshipId={relationshipId} preview={query.data} />
      )}
    </>
  );
}

function NextCycleForm({
  relationshipId,
  preview,
}: {
  relationshipId: string;
  preview: NextCyclePreview;
}) {
  const text = useT().workspace.cycle.next;
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [label, setLabel] = useState(preview.nextLabel);
  const [jbpDate, setJbpDate] = useState('');
  const [failed, setFailed] = useState(false);

  const start = async () => {
    setFailed(false);
    try {
      await startNextCycle(accessToken, relationshipId, { label: label.trim(), jbpDate });
      await queryClient.invalidateQueries({ queryKey: ['suppliers', relationshipId] });
      flash.set(text.started(label.trim()));
      await navigate({ to: '/lieferanten/$id', params: { id: relationshipId } });
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col gap-3 p-6">
          <CardTitle as="h2">{text.carryTitle}</CardTitle>
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>
              {preview.approvedPlan
                ? text.plan(preview.approvedPlan.version, preview.approvedPlan.objectives)
                : text.noPlan}
            </li>
            {preview.jointPlan && (
              <li>
                {preview.jointPlan.approved
                  ? text.jointPlan(preview.jointPlan.version)
                  : text.jointPlanOpen}
              </li>
            )}
            <li>
              {text.stay(preview.runningInitiatives, preview.openCommitments, preview.openActions)}
            </li>
          </ul>
        </Card>
        <Card className="flex flex-col gap-3 p-6">
          <CardTitle as="h2">{text.newTitle}</CardTitle>
          <p className="text-muted-foreground">{text.fresh}</p>
        </Card>
      </div>
      {!preview.canStart ? (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {text.noPermission}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {failed && <StatusLine message={text.startFailed} tone="warning" />}
          <FormField label={text.label}>
            {(field) => (
              <Input
                {...field}
                value={label}
                maxLength={40}
                onChange={(event) => setLabel(event.target.value)}
              />
            )}
          </FormField>
          <FormField label={text.jbpDate}>
            {(field) => (
              <Input
                {...field}
                type="date"
                value={jbpDate}
                onChange={(event) => setJbpDate(event.target.value)}
              />
            )}
          </FormField>
          {label.trim() && jbpDate && (
            <div>
              <ConfirmButton
                variant="default"
                question={text.question(preview.current.label)}
                confirmLabel={text.confirm}
                cancelLabel={text.cancel}
                onConfirm={() => void start()}
              >
                {text.submit}
              </ConfirmButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Frühere Zyklen (ZYK-05), nur lesend. */
export function CycleArchivePage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = t.workspace.cycle.next;
  const accessToken = useToken();
  const trail = useTrail(relationshipId);
  const query = useQuery({
    ...cycleArchiveQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  return (
    <>
      <PagePath trail={trail} current={text.archiveTitle} />
      <PageHeader title={text.archiveTitle} purpose={text.archivePurpose} />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : query.data.cycles.length === 0 ? (
        <EmptyState title={text.archiveEmpty} description={text.archivePurpose} />
      ) : (
        query.data.cycles.map((cycle) => <ArchivedCycleCard key={cycle.id} cycle={cycle} />)
      )}
    </>
  );
}

function ArchivedCycleCard({ cycle }: { cycle: ArchivedCycle }) {
  const t = useT();
  const text = t.workspace.cycle.next;
  const format = useFormat();
  const headingId = useId();
  const rows = (items: { key: string; title: string; meta?: string }[]) =>
    items.length === 0 ? (
      <p className="text-muted-foreground text-sm">{text.none}</p>
    ) : (
      <ul className="divide-y divide-line-soft">
        {items.map((item) => (
          <li key={item.key} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
            <span>{item.title}</span>
            {item.meta && <span className="text-muted-foreground">{item.meta}</span>}
          </li>
        ))}
      </ul>
    );
  return (
    <Card className="flex flex-col gap-5 p-6" aria-labelledby={headingId} role="region">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-section tracking-section">
          {t.workspace.cycle.title(cycle.label)}
        </h2>
        <p className="text-muted-foreground text-sm">
          {text.period(
            format.date(cycle.startedAt),
            cycle.closedAt ? format.date(cycle.closedAt) : '–',
          )}
        </p>
      </div>
      <section className="flex flex-col gap-2">
        <h3 className="text-lg">{text.supplierPlan}</h3>
        {cycle.supplierPlans.length === 0 ? (
          <p className="text-muted-foreground text-sm">{text.none}</p>
        ) : (
          cycle.supplierPlans.map((plan) => (
            <div key={plan.id} className="flex flex-col gap-2 rounded-md bg-paper p-4">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-sm">
                {text.version(plan.version)}
                <Badge>{t.supplierPlan.status[plan.status as 'draft'] ?? plan.status}</Badge>
              </p>
              {plan.summary && <p className="whitespace-pre-wrap text-sm">{plan.summary}</p>}
              {rows(
                plan.objectives.map((objective, index) => ({
                  key: `o${index}`,
                  title: objective.text,
                  meta: `${objective.category} · ${objective.targetYear}`,
                })),
              )}
              {rows(plan.topics.map((topic, index) => ({ key: `t${index}`, title: topic })))}
            </div>
          ))
        )}
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-lg">{text.jointPlans}</h3>
        {cycle.jointPlans.length === 0 ? (
          <p className="text-muted-foreground text-sm">{text.none}</p>
        ) : (
          cycle.jointPlans.map((plan) => (
            <div key={plan.version} className="flex flex-col gap-2 rounded-md bg-paper p-4">
              <p className="font-semibold text-sm">
                {text.version(plan.version)} · {text.approvedOn(format.date(plan.approvedAt))}
              </p>
              {rows(
                plan.initiatives.map((initiative, index) => ({
                  key: `i${index}`,
                  title: initiative.title,
                  meta: text.period(
                    format.date(initiative.startsOn),
                    format.date(initiative.endsOn),
                  ),
                })),
              )}
              {rows(
                plan.commitments.map((commitment, index) => ({
                  key: `c${index}`,
                  title: commitment.title,
                  meta: `${commitment.ownerName} · ${format.date(commitment.dueOn)}`,
                })),
              )}
            </div>
          ))
        )}
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-lg">{text.scorecard}</h3>
        {rows(
          cycle.scorecards.flatMap((card) =>
            card.kpis.map((kpi, index) => ({
              key: `${card.version}-${index}`,
              title: kpi.name,
              meta: `${kpi.target} ${kpi.unit} · ${text.version(card.version)}`,
            })),
          ),
        )}
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-lg">{text.feedback}</h3>
        {rows(
          cycle.feedback.map((wave) => ({
            key: wave.id,
            title: `${text.kinds[wave.kind] ?? wave.kind} · ${format.date(wave.dueDate)}`,
            meta: wave.revealed ? text.revealed : text.notRevealed,
          })),
        )}
      </section>
    </Card>
  );
}
