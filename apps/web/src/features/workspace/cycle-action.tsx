import type { SupplierOverview } from '@reziproq/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { startSupplierCycle } from '@/lib/api';
import { useT } from '@/lib/i18n';

export function CycleAction({
  relationshipId,
  overview,
}: {
  relationshipId: string;
  overview: SupplierOverview;
}) {
  const t = useT();
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const nextStep = overview.cycle?.steps.find(
    (step) => ['open', 'in_progress', 'overdue'].includes(step.status) && step.href !== null,
  );

  const start = async () => {
    setSaving(true);
    setFailed(false);
    try {
      await startSupplierCycle(accessToken, relationshipId);
      await queryClient.invalidateQueries({ queryKey: ['suppliers', relationshipId] });
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const action = nextStep?.href ? (
    <Button asChild size="sm" className="sm:ml-auto">
      {routerLink({
        href: nextStep.href,
        className: '',
        children: t.workspace.cycle.nextStep(t.workspace.cycle.actions[nextStep.key]),
      })}
    </Button>
  ) : !overview.cycle && overview.head.isFocus && overview.canStartCycle ? (
    <Button size="sm" className="sm:ml-auto" loading={saving} onClick={() => void start()}>
      {t.workspace.cycle.start}
    </Button>
  ) : null;

  return (
    <>
      {action}
      {failed && (
        <p role="alert" className="w-full text-destructive text-sm">
          {t.workspace.cycle.startFailed}
        </p>
      )}
    </>
  );
}
