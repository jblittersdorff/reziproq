import { recommendedTopicLimit, type SupplierDetail, type SupplierPlan } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { formatDate } from '@/features/start/start-page';
import { SupplierFrame } from '@/features/suppliers/supplier-frame';
import { useSupplier } from '@/features/suppliers/use-supplier';
import { workspacePath } from '@/features/workspace/areas';
import {
  createSupplierPlan,
  newSupplierPlanVersion,
  reorderStrategicTopics,
  submitSupplierPlan,
  supplierPlanQueryOptions,
  surveyWavesQueryOptions,
} from '@/lib/api';
import { useFlash } from '@/lib/flash';
import { useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function SupplierPlanPage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const supplier = useSupplier(relationshipId);

  if (!supplier.data) return null;
  return (
    <SupplierFrame relationshipId={relationshipId} area="strategy" current={t.supplierPlan.title}>
      {() => <PlanContent relationshipId={relationshipId} supplier={supplier.data} />}
    </SupplierFrame>
  );
}

function PlanContent({
  relationshipId,
  supplier,
}: {
  relationshipId: string;
  supplier: SupplierDetail;
}) {
  const t = useT();
  const { locale } = useLocale();
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const planQuery = useQuery({
    ...supplierPlanQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  const [creating, setCreating] = useState(false);
  const [createFailed, setCreateFailed] = useState(false);
  const [message, hideMessage] = useFlash();

  const create = async () => {
    setCreating(true);
    setCreateFailed(false);
    try {
      await createSupplierPlan(accessToken, relationshipId);
      await queryClient.invalidateQueries({
        queryKey: ['suppliers', relationshipId, 'supplier-plan'],
      });
      setCreateFailed(false);
    } catch {
      setCreateFailed(true);
    } finally {
      setCreating(false);
    }
  };

  if (planQuery.isError || !planQuery.data) {
    return (
      <>
        <PageHeader title={t.supplierPlan.title} purpose={t.supplierPlan.purpose} />
        {planQuery.isError ? (
          <ErrorState title={t.supplierPlan.failed} />
        ) : (
          <LoadingState label={t.supplierPlan.loading} />
        )}
      </>
    );
  }

  const { plan, cycleId, canCreate } = planQuery.data;
  if (!plan) {
    return (
      <>
        <PageHeader title={t.supplierPlan.title} purpose={t.supplierPlan.purpose} />
        {message && <StatusLine message={message} onHidden={hideMessage} />}
        {createFailed && <StatusLine message={t.supplierPlan.createFailed} tone="warning" />}
        {!cycleId ? (
          <EmptyState
            size="lg"
            title={t.supplierPlan.noCycleTitle}
            description={t.supplierPlan.noCycleHint}
            action={
              <Button asChild variant="outline">
                {routerLink({
                  href: workspacePath(relationshipId),
                  className: '',
                  children: t.workspace.overview,
                })}
              </Button>
            }
          />
        ) : (
          <EmptyState
            size="lg"
            title={t.supplierPlan.noPlanTitle}
            description={t.supplierPlan.noPlanHint}
            action={
              canCreate ? (
                <Button loading={creating} onClick={() => void create()}>
                  {t.supplierPlan.create}
                </Button>
              ) : undefined
            }
          />
        )}
      </>
    );
  }

  const byCategory = new Map<string, typeof plan.objectives>();
  for (const objective of plan.objectives) {
    const items = byCategory.get(objective.categoryName) ?? [];
    items.push(objective);
    byCategory.set(objective.categoryName, items);
  }

  return (
    <>
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      <PageHeader
        title={t.supplierPlan.title}
        purpose={t.supplierPlan.purpose}
        badge={
          <Badge variant={plan.status === 'approved' ? 'success' : 'neutral'}>
            {t.supplierPlan.status[plan.status]}
          </Badge>
        }
      />
      {plan.canManage && (
        <div className="flex flex-wrap justify-end gap-3">
          {routerLink({
            href: `/lieferanten/${relationshipId}/strategie/lieferantenplan/beitraege/neu`,
            className: buttonVariants({ variant: 'outline' }),
            children: t.supplierPlan.requestContributions,
          })}
          <Button asChild>
            {routerLink({
              href: `/lieferanten/${relationshipId}/strategie/lieferantenplan/ziele/neu`,
              className: '',
              children: (
                <>
                  <PlusIcon aria-hidden />
                  {t.supplierPlan.addGoal}
                </>
              ),
            })}
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span>{t.supplierPlan.version(plan.version)}</span>
        <span>
          {t.supplierPlan.targetType}: {plan.targetType ?? '–'}
        </span>
        <span>
          {t.supplierPlan.sro}: {plan.sro?.name ?? t.supplierPlan.noSro}
        </span>
      </div>
      <PlanApprovalBar relationshipId={relationshipId} plan={plan} />

      <section aria-labelledby="plan-summary" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="plan-summary" className="font-semibold text-lg">
            {t.supplierPlan.summary}
          </h2>
          {plan.canManage &&
            routerLink({
              href: `/lieferanten/${relationshipId}/strategie/lieferantenplan/zusammenfassung/bearbeiten`,
              className: buttonVariants({ variant: 'outline' }),
              children: t.supplierPlan.editSummary,
            })}
        </div>
        <p className="max-w-3xl whitespace-pre-wrap text-muted-foreground">
          {plan.summary || t.supplierPlan.summaryEmpty}
        </p>
      </section>

      <section aria-labelledby="plan-contributions" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="plan-contributions" className="font-semibold text-lg">
            {t.supplierPlan.contributions}
          </h2>
          {plan.contributions.total > 0 && (
            <p className="text-muted-foreground text-sm">
              {t.supplierPlan.contributionsProgress(
                plan.contributions.done,
                plan.contributions.total,
              )}
            </p>
          )}
        </div>
        {plan.contributions.total === 0 ? (
          <p className="text-muted-foreground">{t.supplierPlan.contributionsNone}</p>
        ) : (
          <ul className="divide-y divide-border">
            {plan.contributions.items
              .filter((item) => item.status === 'open')
              .map((item) => (
                <li key={item.id} className="py-3 text-sm">
                  {t.supplierPlan.contributionOpenItem(
                    (item.businessUnit ?? item.materialGroup)?.name ?? '',
                    item.assignee.name,
                    formatDate(locale, item.dueDate),
                  )}
                </li>
              ))}
          </ul>
        )}
      </section>

      <TopicsSection relationshipId={relationshipId} plan={plan} />

      <section aria-labelledby="plan-objectives" className="space-y-5">
        <h2 id="plan-objectives" className="font-semibold text-lg">
          {t.supplierPlan.goals}
        </h2>
        {plan.objectives.length === 0 ? (
          <p className="text-muted-foreground">{t.supplierPlan.noGoals}</p>
        ) : (
          [...byCategory].map(([category, objectives]) => (
            <div key={category} className="space-y-3">
              <h3 className="font-medium">{category}</h3>
              <ul className="divide-y divide-border">
                {objectives.map((objective) => (
                  <li
                    key={objective.id}
                    className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">{objective.text}</p>
                      <p className="text-sm text-muted-foreground">
                        {objective.businessUnit?.name ?? objective.materialGroup?.name} ·{' '}
                        {objective.owner.name} · {t.supplierPlan.target(objective.targetYear)}
                      </p>
                    </div>
                    {objective.canEdit &&
                      routerLink({
                        href: `/lieferanten/${relationshipId}/strategie/lieferantenplan/ziele/${objective.id}/bearbeiten`,
                        className: buttonVariants({ variant: 'outline', size: 'sm' }),
                        children: t.supplierPlan.edit,
                      })}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
      <ReferenceTiles supplier={supplier} relationshipId={relationshipId} />
    </>
  );
}

function TopicsSection({ relationshipId, plan }: { relationshipId: string; plan: SupplierPlan }) {
  const t = useT();
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);
  const topics = plan.topics;

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    const moved = topics[index];
    if (!moved || target < 0 || target >= topics.length) return;
    const ids = topics.map((topic) => topic.id);
    ids.splice(index, 1);
    ids.splice(target, 0, moved.id);
    setFailed(false);
    try {
      await reorderStrategicTopics(accessToken, relationshipId, plan.id, { topicIds: ids });
      await queryClient.invalidateQueries({
        queryKey: ['suppliers', relationshipId, 'supplier-plan'],
      });
      requestAnimationFrame(() => {
        const buttons = document.querySelectorAll<HTMLButtonElement>(
          `[data-move-topic="${moved.id}"]:not(:disabled)`,
        );
        (buttons[direction === 1 ? buttons.length - 1 : 0] ?? buttons[0])?.focus();
      });
    } catch {
      setFailed(true);
    }
  };

  return (
    <section aria-labelledby="plan-topics" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="plan-topics" className="font-semibold text-lg">
          {t.supplierPlan.topics}
        </h2>
        {plan.canManage &&
          routerLink({
            href: `/lieferanten/${relationshipId}/strategie/lieferantenplan/themen/neu`,
            className: buttonVariants({ variant: 'outline' }),
            children: t.supplierPlan.addTopic,
          })}
      </div>
      {topics.length > recommendedTopicLimit && (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-sm">
          {t.supplierPlan.topicsLimit}
        </p>
      )}
      {failed && <StatusLine message={t.supplierPlan.moveFailed} tone="warning" />}
      {topics.length === 0 ? (
        <p className="text-muted-foreground">{t.supplierPlan.topicsNone}</p>
      ) : (
        <ol className="divide-y divide-border">
          {topics.map((topic, index) => (
            <li
              key={topic.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <h3 className="font-medium">
                  {index + 1}. {topic.title}
                </h3>
                <p className="whitespace-pre-wrap text-muted-foreground">{topic.reason}</p>
                <p className="text-sm text-muted-foreground">
                  {t.supplierPlan.topicLinked}:{' '}
                  {topic.objectives.map((entry) => entry.text).join(' · ')}
                </p>
              </div>
              {plan.canManage && (
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    data-move-topic={topic.id}
                    disabled={index === 0}
                    aria-label={t.supplierPlan.moveUp(topic.title)}
                    onClick={() => void move(index, -1)}
                  >
                    <ArrowUpIcon aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    data-move-topic={topic.id}
                    disabled={index === topics.length - 1}
                    aria-label={t.supplierPlan.moveDown(topic.title)}
                    onClick={() => void move(index, 1)}
                  >
                    <ArrowDownIcon aria-hidden />
                  </Button>
                  {routerLink({
                    href: `/lieferanten/${relationshipId}/strategie/lieferantenplan/themen/${topic.id}/bearbeiten`,
                    className: buttonVariants({ variant: 'outline', size: 'sm' }),
                    children: t.supplierPlan.edit,
                  })}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ReferenceTiles({
  supplier,
  relationshipId,
}: {
  supplier: SupplierDetail;
  relationshipId: string;
}) {
  const t = useT();
  const { locale } = useLocale();
  const latestSpend = supplier.spend[0];
  const spendValue = latestSpend
    ? new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: latestSpend.amount.currency,
      }).format(latestSpend.amount.amountCents / 100)
    : t.workspace.metrics.noSpend;
  // SPL-04: mit Veränderung zum Vorjahr, wenn es erfasst ist und dieselbe Währung hat.
  const previousSpend = supplier.spend.find(
    (entry) =>
      latestSpend &&
      entry.year === latestSpend.year - 1 &&
      entry.amount.currency === latestSpend.amount.currency,
  );
  const spendChange =
    latestSpend && previousSpend && previousSpend.amount.amountCents > 0
      ? t.supplierPlan.spendChange(
          latestSpend.year,
          new Intl.NumberFormat(locale, {
            style: 'percent',
            maximumFractionDigits: 1,
            signDisplay: 'exceptZero',
          }).format(
            (latestSpend.amount.amountCents - previousSpend.amount.amountCents) /
              previousSpend.amount.amountCents,
          ),
        )
      : latestSpend
        ? String(latestSpend.year)
        : null;
  // PUL-03: größte Lücke der jüngsten aufgedeckten Welle, aus ihrem Ort.
  const accessToken = useToken();
  const waves = useQuery({
    ...surveyWavesQueryOptions(accessToken, 'buyer', relationshipId),
    enabled: accessToken !== '',
  });
  const revealed = waves.data?.waves.find((wave) => wave.revealedAt && wave.topGap);
  const feedbackValue = revealed?.topGap
    ? t.feedback.biggestGap(
        t.settings.survey.dimensions[revealed.topGap.dimension] ?? '',
        new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
          Math.abs(revealed.topGap.delta),
        ),
      )
    : t.supplierPlan.notAvailable;
  const cards = [
    {
      title: t.supplierPlan.feedback,
      value: feedbackValue,
      href: `/lieferanten/${relationshipId}/beziehung/feedback`,
    },
    {
      title: t.supplierPlan.spend,
      value: spendChange ? `${spendValue} · ${spendChange}` : spendValue,
      href: `/lieferanten/${relationshipId}/strategie/spend`,
    },
    {
      title: t.supplierPlan.profile,
      value: supplier.organizationName,
      href: `/lieferanten/${relationshipId}/strategie/profil`,
    },
    { title: t.supplierPlan.approval, value: t.supplierPlan.notAvailable },
  ];

  return (
    <section aria-labelledby="plan-references" className="space-y-3">
      <h2 id="plan-references" className="font-semibold text-lg">
        {t.supplierPlan.references}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <li key={card.title} className="rounded-lg bg-card p-4">
            <h3 className="font-medium">{card.title}</h3>
            {card.href ? (
              routerLink({
                href: card.href,
                className:
                  'mt-2 inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                children: card.value,
              })
            ) : (
              <p className="mt-2 text-muted-foreground">{card.value}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * SPL-07: Freigabe auf der Plan-Seite. Im Entwurf „Zur Freigabe“ mit Hinweisen davor, in Freigabe
 * der Weg zur Freigabe-Seite, freigegeben das Datum und „Neue Version“. Versionen immer.
 */
function PlanApprovalBar({ relationshipId, plan }: { relationshipId: string; plan: SupplierPlan }) {
  const t = useT();
  const text = t.supplierPlan.approvalFlow;
  const { locale } = useLocale();
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);
  const { approval } = plan;
  const base = `/lieferanten/${relationshipId}/strategie/lieferantenplan`;
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['suppliers', relationshipId, 'supplier-plan'] });
  const date = (iso: string) => formatDate(locale, iso.slice(0, 10));
  const hints = [
    approval.hints.openContributions > 0 &&
      text.hintContributions(approval.hints.openContributions),
    approval.hints.noTopics && text.hintTopics,
  ].filter((hint): hint is string => Boolean(hint));

  return (
    <section
      aria-label={t.supplierPlan.approval}
      data-slot="plan-approval"
      className="flex flex-col gap-3 rounded-xl bg-card px-5 py-4"
    >
      {plan.status === 'draft' && approval.canSubmit && (
        <>
          {hints.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-warning-soft-foreground">
              {hints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          )}
          <ConfirmButton
            question={text.submitQuestion}
            confirmLabel={text.submitConfirm}
            cancelLabel={t.supplierPlan.cancel}
            variant="default"
            onConfirm={() => {
              setFailed(false);
              submitSupplierPlan(accessToken, relationshipId, plan.id)
                .then(() => refresh())
                .catch(() => setFailed(true));
            }}
          >
            {text.submit}
          </ConfirmButton>
        </>
      )}
      {plan.status === 'in_review' && (
        <div className="flex flex-wrap items-center gap-4">
          <p className="flex-1">
            {approval.submittedAt && text.inReview(date(approval.submittedAt))}
          </p>
          {routerLink({
            href: `${base}/freigabe`,
            className: buttonVariants({ variant: approval.canDecide ? 'default' : 'outline' }),
            children: text.toApproval,
          })}
        </div>
      )}
      {plan.status === 'approved' && (
        <div className="flex flex-wrap items-center gap-4">
          <p className="flex-1 font-semibold">
            {approval.approvedAt && text.approvedAt(date(approval.approvedAt))}
          </p>
          {approval.canNewVersion && (
            <ConfirmButton
              question={text.newVersionQuestion}
              confirmLabel={text.newVersionConfirm}
              cancelLabel={t.supplierPlan.cancel}
              variant="default"
              onConfirm={() => {
                setFailed(false);
                newSupplierPlanVersion(accessToken, relationshipId, plan.id)
                  .then(() => refresh())
                  .catch(() => setFailed(true));
              }}
            >
              {text.newVersion}
            </ConfirmButton>
          )}
        </div>
      )}
      {failed && <p className="text-destructive text-sm">{text.failed}</p>}
      {routerLink({
        href: `${base}/versionen`,
        className: cn(buttonVariants({ variant: 'link' }), 'self-start px-0'),
        children: text.versions,
      })}
    </section>
  );
}
