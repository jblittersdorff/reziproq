import { Collapsible } from '@/components/ui/collapsible';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import { useDocumentTitle } from '@/features/shell/page-header';
import { useSupplier } from '@/features/suppliers/use-supplier';
import { useFlash } from '@/lib/flash';
import { useMessages, useT } from '@/lib/i18n';
import { CycleBar } from './cycle-bar';
import {
  ContactsCard,
  DatesCard,
  FiguresCard,
  GoalCard,
  OverviewRows,
  PerformanceCard,
  PhaseChain,
  SummaryCard,
} from './overview-cards';
import { SupplierNextCard } from './overview-next';
import { supplierMessages } from './supplier-messages';
import { useOverview } from './use-overview';

/**
 * Überblick eines Lieferanten (NAV-10 1.1, Vorlagen `L-Ueberblick.dc.html`, `A-Lieferant.dc.html`,
 * `A-Lieferant-Desktop.dc.html`): unter dem Lieferantenkopf die Schrittfolge mit vier Phasen, dann
 * zwei Spalten. Links „Als Nächstes“, die Zeilen mit Stand-Chip, die Diagrammkarte Leistung und die
 * Zusammenfassung von Reziproq; rechts Kennzahlen, Ergebnisse gegen Ziel, Termine und Fristen und
 * die Kontakte. Auf dem Telefon untereinander in dieser Reihenfolge. Die sieben Schritte des
 * Jahreszyklus (ZYK-01) stehen eingeklappt unter den Zeilen. Speichert nichts selbst.
 */
export function OverviewPage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = useMessages(supplierMessages);
  const supplier = useSupplier(relationshipId);
  const overview = useOverview(relationshipId);
  const [message, hideMessage] = useFlash();
  useDocumentTitle(
    supplier.data ? `${supplier.data.name} · ${t.workspace.overview}` : t.workspace.overview,
  );
  if (!supplier.data) return null;
  const name = supplier.data.name;
  const data = overview.data;

  return (
    <>
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      {overview.isError && <ErrorState title={t.workspace.failed} />}
      {overview.isPending && <LoadingState label={t.workspace.loading} />}
      {data?.cycle && <PhaseChain cycle={data.cycle} />}
      {/* Jede Karte erscheint mit ihren eigenen Daten; fehlt der Überblick, bleiben die übrigen. */}
      <div className="grid gap-5.5 wide:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5.5">
          {!overview.isPending && (
            <SupplierNextCard relationshipId={relationshipId} overview={data} />
          )}
          {data && <OverviewRows relationshipId={relationshipId} overview={data} />}
          {data?.cycle && (
            <Collapsible title={text.phases.detail}>
              <div className="px-2 pb-2">
                <CycleBar
                  cycle={data.cycle}
                  relationshipId={relationshipId}
                  canSetJbpDate={data.canSetJbpDate}
                  canStartNextCycle={data.canStartNextCycle ?? false}
                />
              </div>
            </Collapsible>
          )}
          <PerformanceCard relationshipId={relationshipId} />
          <SummaryCard relationshipId={relationshipId} />
        </div>
        <aside aria-label={text.figures.label} className="flex min-w-0 flex-col gap-5.5">
          {data && <FiguresCard figures={data.figures} name={name} />}
          <GoalCard relationshipId={relationshipId} />
          <DatesCard relationshipId={relationshipId} />
          <ContactsCard relationshipId={relationshipId} name={name} />
        </aside>
      </div>
    </>
  );
}
