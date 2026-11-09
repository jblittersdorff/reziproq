import type { OverviewMetric, WorkspaceArea, WorkspaceHead } from '@reziproq/shared';
import { workspaceAreas } from '@reziproq/shared';
import { useRouterState } from '@tanstack/react-router';
import { ChevronRightIcon, StarIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Stage } from '@/components/ui/stage';
import { Tile } from '@/components/ui/tile';
import { VisibilityBadge } from '@/components/ui/visibility-badge';
import { routerLink } from '@/features/shell/navigation';
import { useDocumentTitle } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { InStageSlot } from '@/features/shell/stage-slot';
import { useSupplier } from '@/features/suppliers/use-supplier';
import { useFormat } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { builtAreas, builtPages, workspacePath } from './areas';
import { CycleBar } from './cycle-bar';
import { useOverview } from './use-overview';

/**
 * Ein Lieferant auf einer Seite (NAV-06, Handschrift Bühne A2): helle Bühne mit Warengruppe, Name,
 * Spend und SRO, rechts der Beziehungstyp Ist → Soll. Darunter die Zyklus-Leiste (ZYK-01) und je
 * gebautem Bereich eine Kachel mit einer Aussage und den Unterseiten. Strategie ist intern und
 * dunkel, die geteilten Bereiche tragen „Geteilt mit …“. Speichert nichts selbst.
 */
export function OverviewPage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const format = useFormat();
  const supplier = useSupplier(relationshipId);
  const overview = useOverview(relationshipId);
  useDocumentTitle(
    supplier.data ? `${supplier.data.name} · ${t.workspace.overview}` : t.workspace.overview,
  );
  const hash = useRouterState({ select: (state) => state.location.hash });
  const ready = Boolean(supplier.data);
  // Der Abschnitt steht erst nach dem Laden auf der Seite; dann dorthin springen.
  useEffect(() => {
    if (!ready || !hash) return;
    const section = document.getElementById(hash);
    // Ältere Umgebungen wie jsdom kennen scrollIntoView nicht.
    if (typeof section?.scrollIntoView === 'function') section.scrollIntoView({ block: 'start' });
  }, [ready, hash]);
  if (!supplier.data) return null;
  const detail = supplier.data;
  const eyebrow = [
    detail.materialGroups?.[0],
    detail.country ? format.country(detail.country) : null,
  ].filter(Boolean);
  const metrics = overview.data?.metrics ?? [];

  return (
    <>
      <InStageSlot>
        <Stage
          tone="light"
          path={
            <PagePath
              trail={[{ label: t.suppliers.title, href: '/lieferanten' }]}
              current={detail.name}
            />
          }
          eyebrow={eyebrow.length > 0 ? eyebrow.join(' · ') : t.workspace.overview}
          title={detail.name}
          actions={
            overview.data && (
              <OverviewHead
                head={overview.data.head}
                spend={metrics.find((metric) => metric.kind === 'spend')}
              />
            )
          }
          aside={overview.data && <TypeFigure segment={overview.data.head.segment} />}
        />
      </InStageSlot>
      {overview.isError && <ErrorState title={t.workspace.failed} />}
      {overview.isPending && <LoadingState label={t.workspace.loading} />}
      {overview.data?.cycle && (
        <CycleBar
          cycle={overview.data.cycle}
          relationshipId={relationshipId}
          canSetJbpDate={overview.data.canSetJbpDate}
        />
      )}
      {/* Die Kacheln mit ihren Unterseiten stehen auch, wenn die Kennzahlen nicht laden. */}
      <div className="grid gap-4 md:grid-cols-2">
        {builtAreas.map((area) => (
          <AreaTile
            key={area}
            area={area}
            relationshipId={relationshipId}
            supplierName={detail.name}
            head={overview.data?.head ?? emptyHead}
            metrics={metrics}
          />
        ))}
      </div>
    </>
  );
}

const emptyHead: WorkspaceHead = { segment: null, sro: null, nextMeeting: null };

/** Spend und SRO groß unter dem Namen; Fokuslieferant als Kennzeichen davor. */
function OverviewHead({ head, spend }: { head: WorkspaceHead; spend: OverviewMetric | undefined }) {
  const t = useT();
  const { locale } = useLocale();
  const entries = [
    {
      key: 'spend',
      label:
        spend?.kind === 'spend' ? t.workspace.head.spend(spend.year) : t.workspace.head.noSpend,
      value: spend?.kind === 'spend' ? formatMoney(spend.amount, locale, { compact: true }) : null,
    },
    { key: 'sro', label: t.workspace.head.sro, value: head.sro?.name ?? null },
  ];
  return (
    <dl aria-label={t.workspace.head.label} className="flex flex-wrap items-end gap-x-10 gap-y-4">
      {head.isFocus && (
        <div data-head="focus" className="flex items-center self-center">
          <Badge variant="selected">
            <StarIcon aria-hidden />
            {t.portfolio.focusPage.badge}
          </Badge>
        </div>
      )}
      {entries.map((entry) => (
        <div key={entry.key} data-head={entry.key} className="flex flex-col-reverse gap-1">
          <dt className="text-muted-foreground">{entry.label}</dt>
          <dd
            className={cn(
              'font-bold text-xl tabular-nums tracking-title',
              entry.value === null && 'font-normal text-muted-foreground',
            )}
          >
            {entry.value ?? t.workspace.head.open}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Beziehungstyp als kleine Grafik: Ist links, Soll rechts, verbunden durch eine Linie. */
function TypeFigure({ segment }: { segment: WorkspaceHead['segment'] }) {
  const text = useT().workspace.typeFigure;
  return (
    <figure data-slot="type-figure" className="flex flex-col gap-5 rounded-xl bg-card p-6 sm:p-7">
      <figcaption className="font-semibold text-muted-foreground text-sm">{text.title}</figcaption>
      <div aria-hidden className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <span className="size-3.5 rounded-full border-2 border-muted-foreground" />
        <span className="h-0.5 bg-gradient-to-r from-border to-primary" />
        <span className={cn('size-3.5 rounded-full', segment ? 'bg-primary' : 'bg-border')} />
      </div>
      <dl className="flex justify-between gap-4">
        <div className="flex flex-col-reverse">
          <dt className="text-muted-foreground text-sm">{text.current}</dt>
          <dd className="font-semibold">{segment?.current ?? text.open}</dd>
        </div>
        <div className="flex flex-col-reverse text-right">
          <dt className="text-muted-foreground text-sm">{text.target}</dt>
          <dd className={cn('font-semibold', segment && 'text-primary')}>
            {segment?.target ?? text.open}
          </dd>
        </div>
      </dl>
    </figure>
  );
}

const tileTone: Partial<Record<WorkspaceArea, 'stage' | 'shared' | 'card'>> = {
  strategy: 'stage',
  relationship: 'shared',
  plan: 'card',
  execution: 'card',
};

/**
 * Kachel eines Bereichs: Kennzeichen, Titel, eine Aussage aus der Kennzahl des Moduls, ein Satz
 * dazu und die Unterseiten als Links.
 */
function AreaTile({
  area,
  relationshipId,
  supplierName,
  head,
  metrics,
}: {
  area: WorkspaceArea;
  relationshipId: string;
  supplierName: string;
  head: WorkspaceHead;
  metrics: OverviewMetric[];
}) {
  const t = useT();
  const segment = workspaceAreas.find((entry) => entry.key === area)?.segment ?? area;
  const headingId = `abschnitt-${segment}`;
  const { statement, detail, big } = useAreaStatement(area, head, metrics);
  return (
    <Tile asChild size="lg" tone={tileTone[area] ?? 'card'}>
      <section
        id={segment}
        aria-labelledby={headingId}
        data-area={area}
        // Die klebenden Leisten verdecken sonst den Titel, wenn die Seite zum Abschnitt springt.
        className="min-h-72 scroll-mt-32 gap-2"
      >
        {area === 'strategy' || area === 'impact' ? (
          <VisibilityBadge visibility="internal" label={t.workspace.internal} />
        ) : (
          // Kurz wie im Entwurf A2: „Geteilt mit Rheintal“.
          <VisibilityBadge
            visibility="shared"
            label={t.workspace.sharedWith(supplierName.split(' ')[0] ?? supplierName)}
          />
        )}
        <h2 id={headingId} className="mt-2 font-bold text-xl tracking-title sm:text-2xl">
          {t.workspace.areas[area]}
        </h2>
        <p
          data-slot="statement"
          className={cn(
            big ? 'font-bold text-primary text-xl tracking-title sm:text-2xl' : 'text-lg',
          )}
        >
          {statement}
        </p>
        {detail && <p className="text-muted-foreground">{detail}</p>}
        <span className="grow" />
        <ul aria-label={t.workspace.areas[area]} className="mt-4 flex flex-wrap gap-x-6">
          {builtPages(area).map((page) => (
            <li key={page.key}>
              {routerLink({
                href: `${workspacePath(relationshipId, area)}/${page.segment}`,
                className:
                  'inline-flex min-h-11 items-center gap-0.5 font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none [&_svg]:size-4',
                children: (
                  <>
                    <span>{t.workspace.pages[page.key].title}</span>
                    <ChevronRightIcon aria-hidden />
                  </>
                ),
              })}
            </li>
          ))}
        </ul>
      </section>
    </Tile>
  );
}

/** Die Aussage je Bereich aus den Kennzahlen der Module; ohne Kennzahl ein ruhiger Hinweis. */
function useAreaStatement(area: WorkspaceArea, head: WorkspaceHead, metrics: OverviewMetric[]) {
  const t = useT();
  const format = useFormat();
  const text = t.workspace.tiles;
  const find = <K extends OverviewMetric['kind']>(kind: K) =>
    metrics.find((metric): metric is Extract<OverviewMetric, { kind: K }> => metric.kind === kind);
  if (area === 'strategy') {
    const target = find('segment_target');
    return target
      ? { statement: target.typeName, detail: text.strategyTarget(target.provisional), big: true }
      : { statement: text.strategyEmpty, detail: text.strategyEmptyText, big: false };
  }
  if (area === 'relationship') {
    const rules = find('rules');
    const team = find('team_size');
    const teamText = team ? text.team(team.count) : text.noTeam;
    return rules
      ? {
          statement: text.rules(rules.version),
          detail: `${text.rulesShared(format.date(rules.sharedAt))} ${teamText}`,
          big: false,
        }
      : { statement: text.rulesEmpty, detail: teamText, big: false };
  }
  if (area === 'impact') {
    return { statement: text.impact, detail: text.impactText, big: false };
  }
  if (area === 'plan') {
    const plan = find('jbp');
    return plan
      ? {
          statement: plan.meetingDate
            ? text.planDate(format.date(plan.meetingDate))
            : text.plan[plan.status],
          detail: plan.meetingDate
            ? `${text.plan[plan.status]}. ${text.planCounts(plan.topics, plan.initiatives)}`
            : text.planCounts(plan.topics, plan.initiatives),
          big: false,
        }
      : { statement: text.planEmpty, detail: text.planEmptyText, big: false };
  }
  const actions = find('actions');
  return {
    statement: head.nextMeeting ? text.meeting(format.date(head.nextMeeting.date)) : text.noMeeting,
    detail: actions ? text.actions(actions.open, actions.overdue) : text.noActions,
    big: false,
  };
}
