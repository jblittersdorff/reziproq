import type { CycleStepStatus, SupplierCycle } from '@reziproq/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { routerLink } from '@/features/shell/navigation';
import { useLocale, useT } from '@/lib/i18n';

export function CycleBar({
  cycle,
  relationshipId,
  canSetJbpDate,
}: {
  cycle: SupplierCycle;
  relationshipId: string;
  canSetJbpDate: boolean;
}) {
  const t = useT();
  const { locale } = useLocale();
  const currentIndex = cycle.steps.findIndex((step) =>
    ['open', 'in_progress', 'overdue'].includes(step.status),
  );

  return (
    <section aria-labelledby="cycle-title" className="space-y-3 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="cycle-title" className="font-semibold text-lg">
          {t.workspace.cycle.title(cycle.label)}
        </h2>
        {canSetJbpDate && (
          <Button asChild size="sm" variant="outline">
            {routerLink({
              href: `/lieferanten/${relationshipId}/zyklus/termin`,
              className: '',
              children: t.workspace.cycle.setDate,
            })}
          </Button>
        )}
      </div>
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {cycle.steps.map((step, index) => {
          const current = index === currentIndex;
          const content = (
            <div className="flex h-full flex-col gap-2 rounded-md bg-muted/50 p-3">
              <span
                aria-hidden
                className={`flex size-7 items-center justify-center rounded-full text-sm ${
                  current ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                }`}
              >
                {index + 1}
              </span>
              <span className={current ? 'font-semibold' : 'font-medium'}>
                {t.workspace.cycle.steps[step.key]}
              </span>
              {step.dueDate && (
                <span className="text-muted-foreground text-sm">
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                    new Date(`${step.dueDate}T00:00:00`),
                  )}
                </span>
              )}
              <Badge
                variant={statusVariant(step.status)}
                className="max-w-full whitespace-normal text-xs leading-tight"
              >
                {t.workspace.cycle.status[step.status]}
              </Badge>
            </div>
          );
          const className =
            'block rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

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
