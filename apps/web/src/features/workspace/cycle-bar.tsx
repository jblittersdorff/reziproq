import type { CycleStepStatus, SupplierCycle } from '@reziproq/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StepRing } from '@/components/ui/step-ring';
import { routerLink } from '@/features/shell/navigation';
import { useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function CycleBar({
  cycle,
  relationshipId,
  canSetJbpDate,
  canStartNextCycle = false,
}: {
  cycle: SupplierCycle;
  relationshipId: string;
  canSetJbpDate: boolean;
  /** ZYK-05: elf Monate nach dem JBP, für SRO und Admin */
  canStartNextCycle?: boolean;
}) {
  const t = useT();
  const { locale } = useLocale();
  const currentIndex = cycle.steps.findIndex((step) =>
    ['open', 'in_progress', 'overdue'].includes(step.status),
  );

  return (
    <section
      aria-labelledby="cycle-title"
      className="flex flex-col gap-5 rounded-lg bg-card p-6 shadow-card sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="cycle-title" className="text-section tracking-section">
          {t.workspace.cycle.title(cycle.label)}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="ghost">
            {routerLink({
              href: `/lieferanten/${relationshipId}/zyklus/archiv`,
              className: '',
              children: t.workspace.cycle.next.archiveLink,
            })}
          </Button>
          {canSetJbpDate && (
            <Button asChild size="sm" variant="secondary">
              {routerLink({
                href: `/lieferanten/${relationshipId}/zyklus/termin`,
                className: '',
                children: t.workspace.cycle.setDate,
              })}
            </Button>
          )}
          {canStartNextCycle && (
            <Button asChild size="sm">
              {routerLink({
                href: `/lieferanten/${relationshipId}/zyklus/neu`,
                className: '',
                children: t.workspace.cycle.next.link,
              })}
            </Button>
          )}
        </div>
      </div>
      {/* Schrittfolge der Designsprache: Ringe mit Linie, Status als Text darunter. */}
      <ol className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-7">
        {cycle.steps.map((step, index) => {
          const current = index === currentIndex;
          const state =
            step.status === 'completed' ? 'done' : current ? 'current' : ('open' as const);
          const content = (
            <div className="flex h-full flex-col gap-2">
              <span className="flex items-center">
                <StepRing
                  state={state}
                  number={index + 1}
                  doneLabel={t.workspace.cycle.status.completed}
                />
                {index < cycle.steps.length - 1 && (
                  <span
                    aria-hidden
                    className={cn(
                      'hidden h-0.5 flex-1 rounded-full lg:block',
                      state === 'done' ? 'bg-petrol' : 'bg-line',
                    )}
                  />
                )}
              </span>
              <span className={cn('text-sm', current ? 'font-bold' : 'font-semibold')}>
                {t.workspace.cycle.steps[step.key]}
              </span>
              {step.dueDate && (
                <span className="text-chip text-muted-foreground">
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                    new Date(`${step.dueDate}T00:00:00`),
                  )}
                </span>
              )}
              <Badge
                variant={statusVariant(step.status)}
                className="max-w-full whitespace-normal leading-tight"
              >
                {t.workspace.cycle.status[step.status]}
              </Badge>
            </div>
          );
          const className =
            'block rounded-md text-text no-underline outline-none hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50';

          return (
            <li key={step.key} className="min-w-0">
              {step.href
                ? routerLink({
                    href: step.href,
                    className,
                    'aria-current': current ? 'step' : undefined,
                    children: content,
                  })
                : content}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function statusVariant(status: CycleStepStatus) {
  switch (status) {
    case 'completed':
      return 'success';
    case 'in_progress':
      return 'selected';
    case 'overdue':
      return 'danger';
    case 'open':
    case 'unavailable':
      return 'neutral';
  }
}
