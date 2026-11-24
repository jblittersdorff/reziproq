import { displayNameOf, type Supplier } from '@reziproq/shared';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeftIcon, StarIcon, XIcon } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Chain } from '@/components/ui/chain';
import { LoadingState } from '@/components/ui/loading-state';
import { MeterBar } from '@/components/ui/meter-bar';
import { Monogram } from '@/components/ui/monogram';
import { NextStep } from '@/components/ui/next-step';
import { StatusDot, type StatusDotTone } from '@/components/ui/status-dot';
import { routerLink } from '@/features/shell/navigation';
import { useOverview } from '@/features/workspace/use-overview';
import { useFormat } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { useNarrow } from '@/lib/use-narrow';
import { cn } from '@/lib/utils';

export const pageSize = 50;

/** Segment „i-q“ als „Hoher Impact · ausbaufähig“ (kurz) und mit voller Beziehung (lang) */
export function useSegmentText() {
  const t = useT();
  return (type: string | null | undefined) => {
    if (!type) return null;
    const [impact, quality] = type.split('-').map(Number);
    const impactText = t.segments.impact[impact ?? 0];
    if (!impactText || !t.segments.quality[quality ?? 0]) return null;
    return {
      short: `${impactText} · ${t.segments.quality[quality ?? 0]}`,
      long: `${impactText} · ${t.segments.qualityRelationship[quality ?? 0]}`,
    };
  };
}

function useMillions() {
  const t = useT();
  const { locale } = useLocale();
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (cents: number, currency: string) => {
    const symbol =
      new Intl.NumberFormat(locale, { style: 'currency', currency })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? currency;
    return t.suppliers.list.millions(number.format(cents / 100_000_000), symbol);
  };
}

/** NAV-10 1.1: Gruppe, Ampelpunkt mit Text und Grund einer Zeile */
export type SupplierGroup = 'needs' | 'good' | 'ended';
export interface SupplierRowStatus {
  group: SupplierGroup;
  status: string;
  tone: StatusDotTone;
  /** Grund in einer Zeile; ohne Grund Warengruppe und Land */
  reason: string | null;
}

const groupOrder: SupplierGroup[] = ['needs', 'good', 'ended'];

/**
 * Lieferantenliste mit Detailleiste (LS-01, NAV-10 1.1, nach Lieferanten.dc.html und
 * A-Lieferanten.dc.html): Gruppen „Brauchen dich“ und „Laufen gut“, feste Spalten und Zeilen
 * gleicher Höhe; jede Zeile mit Ampelpunkt, Status als Text und Grund. Ein Klick wählt die Zeile
 * und zeigt rechts das Wichtigste, die Auswahl steht in der Adresse. Pfeiltasten wechseln über
 * beide Gruppen, Enter öffnet, Escape schließt.
 */
export function SupplierList({
  suppliers: unordered,
  spendYear,
  segmentOf,
  selectedId,
  onSelect,
  segmentHeading,
  rowStatus,
  groupLabels,
}: {
  /** Status je Zeile; die Liste ordnet danach in Gruppen, sonst in der gegebenen Reihenfolge */
  rowStatus: (supplier: Supplier) => SupplierRowStatus;
  groupLabels: Record<SupplierGroup, string>;
  suppliers: Supplier[];
  /** WG-18: mit Filter Warengruppe heißt die Spalte „Segment in <Warengruppe>“ */
  segmentHeading?: string | undefined;
  spendYear: number;
  /** Segment der Zeile: gesamt oder in der gefilterten Warengruppe (WG-18), als „i-q“ */
  segmentOf: (supplier: Supplier) => string | null;
  selectedId: string | undefined;
  onSelect: (id: string | undefined) => void;
}) {
  const t = useT();
  const text = t.suppliers.list;
  const narrow = useNarrow();
  const navigate = useNavigate();
  const [shown, setShown] = useState(pageSize);
  const listRef = useRef<HTMLDivElement>(null);
  // Gruppen in fester Reihenfolge; in der Gruppe bleibt die Sortierung (Spend oder Name).
  const statuses = new Map(
    unordered.map((supplier) => [supplier.relationshipId, rowStatus(supplier)]),
  );
  const statusOf = (supplier: Supplier) =>
    statuses.get(supplier.relationshipId) as SupplierRowStatus;
  const suppliers = groupOrder.flatMap((group) =>
    unordered.filter((supplier) => statusOf(supplier).group === group),
  );
  const segmentText = useSegmentText();
  const millions = useMillions();
  const format = useFormat();
  const max = Math.max(1, ...suppliers.map((supplier) => supplier.spend?.amountCents ?? 0));
  const total = suppliers.reduce((sum, supplier) => sum + (supplier.spend?.amountCents ?? 0), 0);
  const selected = suppliers.find((supplier) => supplier.relationshipId === selectedId);
  // Ohne Auswahl zeigt die rechte Spalte den Lieferanten mit dem größten Spend.
  const largest = [...suppliers].sort(
    (a, b) => (b.spend?.amountCents ?? 0) - (a.spend?.amountCents ?? 0),
  )[0];
  const panelSupplier = selected ?? largest;
  const visible = suppliers.slice(0, Math.max(shown, suppliers.indexOf(selected as Supplier) + 1));

  useEffect(() => {
    if (!selectedId) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-id="${selectedId}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedId]);

  const onKeyDown = (event: KeyboardEvent) => {
    const index = suppliers.findIndex((supplier) => supplier.relationshipId === selectedId);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next =
        event.key === 'ArrowDown'
          ? Math.min(suppliers.length - 1, index + 1)
          : Math.max(0, index < 0 ? 0 : index - 1);
      const target = suppliers[next];
      if (target) {
        onSelect(target.relationshipId);
        listRef.current
          ?.querySelector<HTMLElement>(`[data-id="${target.relationshipId}"]`)
          ?.focus();
      }
    } else if (event.key === 'Enter' && selectedId) {
      event.preventDefault();
      void navigate({ to: '/lieferanten/$id', params: { id: selectedId } });
    } else if (event.key === 'Escape' && selectedId) {
      event.preventDefault();
      onSelect(undefined);
    }
  };

  if (narrow && selected) {
    return (
      <SupplierPanel
        supplier={selected}
        spendYear={spendYear}
        total={total}
        segment={segmentOf(selected)}
        onClose={() => onSelect(undefined)}
        page
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,--spacing(96))]">
      <div className="flex min-w-0 flex-col gap-3">
        <p className="sr-only">{text.keyboardHint}</p>
        <div
          aria-hidden
          className="hidden grid-cols-[--spacing(10)_minmax(0,1fr)_--spacing(52)_--spacing(8)_--spacing(40)] gap-3 px-4 font-semibold text-muted-foreground text-chip sm:grid"
        >
          <span />
          <span>{text.columnSupplier}</span>
          <span>{segmentHeading ?? text.columnSegment}</span>
          <span className="sr-only">{text.columnFocus}</span>
          <span className="whitespace-nowrap text-right">{text.columnSpend(spendYear)}</span>
        </div>
        <div ref={listRef} className="flex flex-col gap-5">
          {groupOrder.map((group) => {
            const rows = visible.filter((supplier) => statusOf(supplier).group === group);
            if (rows.length === 0) return null;
            const headingId = `lieferanten-${group}`;
            return (
              <section key={group} aria-labelledby={headingId} className="flex flex-col gap-2">
                <h2
                  id={headingId}
                  className="px-1 font-semibold text-input-border text-sm uppercase tracking-label"
                >
                  {groupLabels[group]}
                </h2>
                <ul
                  aria-label={group === 'good' ? text.label : groupLabels[group]}
                  onKeyDown={onKeyDown}
                  className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-lg bg-card shadow-card"
                >
                  {rows.map((supplier) => {
                    const display = displayNameOf(supplier.name);
                    const segment = segmentText(segmentOf(supplier));
                    const category = supplier.topMaterialGroup ?? supplier.primaryMaterialGroup;
                    const status = statusOf(supplier);
                    const isSelected = supplier.relationshipId === selected?.relationshipId;
                    return (
                      <li key={supplier.relationshipId}>
                        <button
                          type="button"
                          data-id={supplier.relationshipId}
                          data-slot="supplier-row"
                          aria-pressed={isSelected}
                          onClick={() => onSelect(supplier.relationshipId)}
                          className={cn(
                            'grid h-16 w-full grid-cols-[--spacing(10)_minmax(0,1fr)_auto] items-center gap-3 px-4 text-left text-sm transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:grid-cols-[--spacing(10)_minmax(0,1fr)_--spacing(52)_--spacing(8)_--spacing(40)]',
                            isSelected && 'bg-mint-soft hover:bg-mint-soft',
                          )}
                        >
                          <Monogram
                            name={display.name}
                            tone={supplier.isFocus ? 'shared' : 'neutral'}
                          />
                          <span className="flex min-w-0 flex-col">
                            <span className="flex min-w-0 items-center gap-2">
                              <strong
                                data-slot="supplier-name"
                                title={supplier.name}
                                className="truncate font-semibold"
                              >
                                {display.name}
                              </strong>
                              {display.demo && <Badge>{text.demo}</Badge>}
                              {supplier.status === 'draft' && (
                                <Badge>{t.suppliers.statusDraft}</Badge>
                              )}
                              {supplier.status === 'ended' && (
                                <Badge>{t.suppliers.statusEnded}</Badge>
                              )}
                            </span>
                            <span className="flex min-w-0 items-center gap-2 text-chip text-muted-foreground">
                              <StatusDot
                                tone={status.tone}
                                label={status.status}
                                className="text-text"
                              />
                              <span className="truncate">
                                {status.reason ??
                                  [
                                    category ?? text.groupMissing,
                                    supplier.country ? format.country(supplier.country) : null,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                              </span>
                            </span>
                          </span>
                          <span className="hidden min-w-0 sm:flex">
                            {segment ? (
                              <Badge variant="neutral" className="truncate">
                                {segment.short}
                              </Badge>
                            ) : (
                              <Badge variant="plain" className="border border-line border-dashed">
                                {text.notRated}
                              </Badge>
                            )}
                          </span>
                          <span className="hidden justify-center sm:flex">
                            {supplier.isFocus && (
                              <StarIcon
                                aria-label={text.focus}
                                className="size-4 fill-petrol text-petrol"
                              />
                            )}
                          </span>
                          <span className="flex min-w-0 flex-col items-end gap-1">
                            <span className="font-semibold tabular-nums">
                              {millions(
                                supplier.spend?.amountCents ?? 0,
                                supplier.spend?.currency ?? 'EUR',
                              )}
                            </span>
                            <MeterBar
                              className="w-24"
                              value={(supplier.spend?.amountCents ?? 0) / max}
                              label={`${display.name}: ${Math.round(((supplier.spend?.amountCents ?? 0) / max) * 100)} %`}
                            />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
        {suppliers.length > visible.length && (
          <Button
            variant="secondary"
            className="self-start"
            onClick={() => setShown((current) => current + pageSize)}
          >
            {text.more(Math.min(pageSize, suppliers.length - visible.length))}
          </Button>
        )}
      </div>
      {panelSupplier && !narrow && (
        <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <SupplierPanel
            supplier={panelSupplier}
            spendYear={spendYear}
            total={total}
            segment={segmentOf(panelSupplier)}
            {...(selected ? { onClose: () => onSelect(undefined) } : {})}
          />
        </div>
      )}
    </div>
  );
}

/** Detailleiste (LS-01): Kopf, Chips, zwei Kacheln, Zyklus, nächster Schritt, Liste, Öffnen. */
function SupplierPanel({
  supplier,
  spendYear,
  total,
  segment,
  onClose,
  page = false,
}: {
  supplier: Supplier;
  spendYear: number;
  total: number;
  segment: string | null;
  onClose?: () => void;
  page?: boolean;
}) {
  const t = useT();
  const text = t.suppliers.list;
  const { locale } = useLocale();
  const format = useFormat();
  const millions = useMillions();
  const segmentText = useSegmentText();
  const overview = useOverview(supplier.relationshipId);
  const display = displayNameOf(supplier.name);
  const id = supplier.relationshipId;
  const base = `/lieferanten/${id}`;
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const share = total > 0 ? (supplier.spend?.amountCents ?? 0) / total : 0;
  const current = segmentText(segment);
  const target = segmentText(supplier.targetType);
  const data = overview.data;
  const cycle = data?.cycle ?? null;
  const currentIndex =
    cycle?.steps.findIndex((step) => ['open', 'in_progress', 'overdue'].includes(step.status)) ??
    -1;
  const currentStep = cycle?.steps[currentIndex];
  const nextStep = cycle?.steps.find(
    (step) => ['open', 'in_progress', 'overdue'].includes(step.status) && step.href !== null,
  );
  const group = supplier.topMaterialGroup ?? supplier.primaryMaterialGroup;
  // Der globale Organisationsname bleibt verborgen (PLT-03); „rechtlich“ heißt hier der volle Name.
  const legal = [supplier.name, supplier.externalRef].filter(Boolean).join(' · ');

  const rows = [
    {
      key: 'hints',
      label: text.hints,
      value: text.hintsValue(data?.openHints ?? 0),
      href: '/hinweise',
    },
    {
      key: 'commitments',
      label: text.commitments,
      value: text.commitmentsValue(data?.overdueCommitments ?? 0),
      href: `${base}/plan/zusagen`,
    },
    {
      key: 'drafts',
      label: text.drafts,
      value: text.draftsValue(data?.openDrafts ?? 0),
      href: `${base}/aktivitaeten`,
    },
    {
      key: 'sro',
      label: text.sro,
      value: supplier.sroName ?? data?.head.sro?.name ?? text.sroMissing,
      href: `${base}/beziehung/team`,
    },
  ];

  return (
    <section
      aria-label={text.detailLabel(display.name)}
      className={cn('flex flex-col gap-4 rounded-lg bg-card p-5 shadow-card', page && 'p-4')}
    >
      {page && (
        <Button variant="ghost" size="sm" className="self-start" onClick={onClose}>
          <ArrowLeftIcon aria-hidden />
          {text.back}
        </Button>
      )}
      <div className="flex items-start gap-3">
        <Monogram name={display.name} size="lg" tone={supplier.isFocus ? 'shared' : 'neutral'} />
        <span className="flex min-w-0 grow flex-col">
          <strong className="font-display font-semibold text-lg">{display.name}</strong>
          <span className="text-muted-foreground text-sm">{legal}</span>
        </span>
        {onClose && !page && (
          <Button variant="ghost" size="icon" aria-label={text.close} onClick={onClose}>
            <XIcon aria-hidden />
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {supplier.isFocus && (
          <Badge variant="shared">
            <StarIcon aria-hidden />
            {text.focus}
          </Badge>
        )}
        {display.demo && <Badge>{text.demo}</Badge>}
        <Badge variant={current ? 'neutral' : 'plain'}>
          {current ? text.segmentChip(current.long) : text.notRated}
        </Badge>
        {target && <Badge variant="neutral">{text.targetChip(target.long)}</Badge>}
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-md bg-paper p-3">
          <dt className="text-muted-foreground text-chip">{text.spendTile(spendYear)}</dt>
          <dd className="font-display font-semibold text-lg tabular-nums">
            {millions(supplier.spend?.amountCents ?? 0, supplier.spend?.currency ?? 'EUR')}
          </dd>
          <dd className="text-muted-foreground text-chip">
            {text.shareOfSpend(percent.format(share))}
          </dd>
        </div>
        <div className="flex flex-col gap-1 rounded-md bg-paper p-3">
          <dt className="text-muted-foreground text-chip">{text.groupTile}</dt>
          <dd className="font-semibold">{group ?? text.groupMissing}</dd>
          <dd className="text-muted-foreground text-chip">
            {supplier.country ? format.country(supplier.country) : '–'}
          </dd>
        </div>
      </dl>
      {!data ? (
        <LoadingState label={text.detailLoading} />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-sm">{text.yearTitle}</h3>
            {cycle && currentStep ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Chain
                  surface="card"
                  label={text.yearStep(
                    currentIndex + 1,
                    cycle.steps.length,
                    t.workspace.cycle.steps[currentStep.key],
                  )}
                  steps={cycle.steps.map((step, index) =>
                    step.status === 'completed'
                      ? 'done'
                      : index === currentIndex
                        ? 'current'
                        : 'open',
                  )}
                />
                <span aria-hidden>
                  {text.yearStep(
                    currentIndex + 1,
                    cycle.steps.length,
                    t.workspace.cycle.steps[currentStep.key],
                  )}
                </span>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{text.noCycle}</p>
            )}
          </div>
          {nextStep?.href && (
            <NextStep
              nested
              headingAs="h3"
              eyebrow={text.nextStep}
              title={t.workspace.cycle.actions[nextStep.key]}
              action={routerLink({
                href: nextStep.href,
                className: buttonVariants({ variant: 'mint', size: 'sm' }),
                children: text.nextOpen,
              })}
            />
          )}
          <ul className="flex flex-col divide-y divide-line-soft">
            {rows.map((row) => (
              <li key={row.key}>
                {routerLink({
                  href: row.href,
                  className:
                    'flex min-h-11 items-center justify-between gap-3 py-2 text-sm no-underline hover:text-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  children: (
                    <>
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-semibold">{row.value}</span>
                    </>
                  ),
                })}
              </li>
            ))}
          </ul>
        </>
      )}
      {/* NAV-10 Seitenregel 3: die eine Hauptaktion steht im „Nächsten Schritt“ darüber. */}
      {routerLink({
        href: base,
        className: buttonVariants({ variant: 'secondary', className: 'self-start' }),
        children: text.open,
      })}
    </section>
  );
}
