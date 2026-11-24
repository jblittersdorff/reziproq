import { cycleStepKeys } from '@reziproq/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { FormGroup, FormPage } from '@/components/ui/form-page';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { useSupplier } from '@/features/suppliers/use-supplier';
import { startSupplierCycle } from '@/lib/api';
import { flash } from '@/lib/flash';
import { useMessages, useT } from '@/lib/i18n';
import { supplierMessages } from './supplier-messages';
import { useOverview } from './use-overview';

/**
 * Jahreszyklus starten (ZYK-01, NAV-10 1.1): Ziel der Karte „Als Nächstes“ im Überblick eines
 * Fokuslieferanten ohne Zyklus. Zeigt die sieben Schritte und startet mit dem einen Hauptknopf.
 */
export function CycleStartPage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = useMessages(supplierMessages).next.startCycle;
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const supplier = useSupplier(relationshipId);
  const overview = useOverview(relationshipId);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const base = `/lieferanten/${relationshipId}`;
  const allowed = overview.data
    ? !overview.data.cycle && overview.data.head.isFocus && overview.data.canStartCycle
    : true;

  const start = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await startSupplierCycle(accessToken, relationshipId);
      await queryClient.invalidateQueries({ queryKey: ['suppliers', relationshipId] });
      flash.set(text.started);
      await navigate({ to: '/lieferanten/$id', params: { id: relationshipId } });
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <>
      <PagePath
        trail={[
          { label: t.suppliers.title, href: '/beziehungen' },
          { label: supplier.data?.name ?? '…', href: base },
        ]}
        current={text.title}
      />
      <PageHeader title={text.title} purpose={text.text} />
      {!allowed ? (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {t.workspace.cycle.next.noPermission}
        </p>
      ) : (
        <FormPage
          label={text.title}
          primary={text.action}
          secondary={{ label: t.workspace.cycle.next.cancel, href: base }}
          busy={busy}
          renderLink={routerLink}
          onSubmit={(event) => {
            event.preventDefault();
            void start();
          }}
        >
          <FormGroup label={text.steps}>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5">
              {cycleStepKeys.map((key) => (
                <li key={key}>{t.workspace.cycle.steps[key]}</li>
              ))}
            </ol>
          </FormGroup>
          {failed && (
            <p role="alert" className="text-destructive">
              {t.workspace.cycle.startFailed}
            </p>
          )}
        </FormPage>
      )}
    </>
  );
}
