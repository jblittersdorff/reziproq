import type { OverviewInsight, PortfolioMatrix, StrategyOverview } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChartBars, ChartCard, ChartColumns } from '@/components/ui/chart-card';
import { ErrorState } from '@/components/ui/error-state';
import { GoalRings } from '@/components/ui/goal-rings';
import { LoadingState } from '@/components/ui/loading-state';
import { PageTitle } from '@/components/ui/page-title';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SoWhat, type SoWhatTone } from '@/components/ui/so-what';
import { StatusLine } from '@/components/ui/status-line';
import { TimelineRail } from '@/components/ui/timeline-rail';
import { useMe } from '@/features/auth/use-me';
import { useCan } from '@/features/auth/use-permissions';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { useDocumentTitle } from '@/features/shell/page-header';
import { overviewMessages, timelineMessages } from '@/features/start/my-day-messages';
import { localToday, NextActionCard, shortDate, timelineEntry } from '@/features/start/next-action';
import {
  dueQueryOptions,
  needsYouQueryOptions,
  nextActionQueryOptions,
  overviewInsightQueryOptions,
  portfolioMatrixQueryOptions,
  reportStatement,
  saveEbitGoal,
  strategyOverviewQueryOptions,
  timelineQueryOptions,
} from '@/lib/api';
import { useLocale, useMessages, useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { AmountForm } from './insight-pages';

type Period = 'quarter' | 'year' | 'all';
type Text = (typeof overviewMessages)['de'];

const chipTone: Record<'good' | 'stuck' | 'todo', SoWhatTone> = {
  good: 'success',
  stuck: 'danger',
  todo: 'warning',
};

/** Höchstens acht Einträge in der Terminschiene (NAV-10) */
const railLimit = 8;

function useAmount() {
  const { locale } = useLocale();
  return (cents: number, currency = 'EUR') =>
    formatMoney({ amountCents: cents, currency }, locale, { compact: true });
}

/**
 * Übersicht (NAV-10 1.1, Vorlagen `Uebersicht.dc.html`, `A-Uebersicht.dc.html`): ein Lagebild über
 * alle Bereiche. Erste Reihe Ergebnisse links, rechts „Als Nächstes“ und die Zusammenfassung von
 * Reziproq (auf dem Telefon in dieser Reihenfolge zuerst); darunter die Terminschiene der nächsten
 * vier Wochen und je Bereich mit Daten eine Diagrammkarte. EBIT und Cash werden nie addiert.
 * Risiko und Claims erscheinen nur mit aktivem Modul (UX-20); in Release 1.1 gibt es sie nicht.
 */
export function OverviewPage() {
  const t = useT();
  const text = useMessages(overviewMessages);
  const rail = useMessages(timelineMessages);
  const { locale } = useLocale();
  const accessToken = useToken();
  const me = useMe();
  const enabled = accessToken !== '';
  const query = useQuery({ ...overviewInsightQueryOptions(accessToken), enabled });
  const next = useQuery({ ...nextActionQueryOptions(accessToken), enabled }).data;
  const timeline = useQuery({ ...timelineQueryOptions(accessToken, 28), enabled }).data;
  const due = useQuery({ ...dueQueryOptions(accessToken), enabled }).data;
  const modules = me.data?.modules;
  const strategies = useQuery({
    ...strategyOverviewQueryOptions(accessToken),
    enabled: enabled && Boolean(modules?.category_strategy),
  }).data;
  const canPortfolio = useCan('portfolio.sehen');
  const matrix = useQuery({
    ...portfolioMatrixQueryOptions(accessToken, {}),
    enabled: enabled && canPortfolio,
  }).data;
  const needsYou = useQuery({ ...needsYouQueryOptions(accessToken), enabled }).data;
  const [period, setPeriod] = useState<Period>('year');
  useDocumentTitle(text.title);

  const today = localToday();
  const data = query.data;
  const where = data
    ? text.where(me.data?.organization?.name ?? '', data.fiscalYear, shortDate(locale, today))
    : undefined;
  const switcher = (
    <SegmentedControl<Period>
      label={text.period}
      value={period}
      onChange={setPeriod}
      options={[
        { value: 'quarter', label: text.periods.quarter },
        { value: 'year', label: text.periods.year },
        { value: 'all', label: text.periods.all },
      ]}
    />
  );

  if (query.isError) {
    return (
      <>
        <PageTitle title={text.title} />
        <ErrorState title={t.insights.failed} />
      </>
    );
  }
  if (!data) {
    return (
      <>
        <PageTitle title={text.title} />
        <LoadingState label={t.insights.loading} />
      </>
    );
  }

  const dueToday = (due?.items ?? []).filter((item) => item.dueDate <= today);
  const overdue = dueToday.filter((item) => item.dueDate < today).length;
  const railItems = (timeline?.items ?? [])
    .filter((item) => item.date >= today)
    .slice(0, railLimit)
    .map((item) => timelineEntry(rail, item, locale));

  return (
    <>
      <PageTitle title={text.title} where={where} aside={switcher} />
      <div className="grid gap-5.5 wide:grid-cols-2">
        <div className="order-2 flex min-w-0 wide:order-1">
          <ResultsCard data={data} period={period} text={text} />
        </div>
        <div className="order-1 flex min-w-0 flex-col gap-5.5 wide:order-2">
          <NextActionCard next={next?.next} />
          <Summary data={data} text={text} today={today} />
        </div>
      </div>
      <ChartCard label={text.railKicker(railItems.length)} title={text.railTitle}>
        <TimelineRail
          label={text.railLabel}
          locale={locale}
          today={{
            key: 'today',
            date: today,
            kind: rail.today,
            title: rail.todayTitle(dueToday.length),
            sub: rail.todaySub(overdue),
            href: '/mein-tag',
          }}
          items={railItems}
          renderLink={routerLink}
        />
      </ChartCard>
      <div className="grid gap-5.5 wide:grid-cols-2">
        {strategies && <CategoriesCard strategies={strategies} text={text} />}
        {matrix && <SuppliersCard matrix={matrix} text={text} needsYou={needsYou?.items.length} />}
        {/* Risiko und Claims (NAV-10 Ablauf 4) nur mit aktivem Modul in org_module; in Release
            1.1 sind beide aus und haben keine Daten, deshalb erscheint keine Karte. */}
      </div>
    </>
  );
}

/** Ergebnisse: Ring nur mit Jahresziel, daneben Zahl, Ziel und was fehlt; darunter je Quartal */
function ResultsCard({
  data,
  period,
  text,
}: {
  data: OverviewInsight;
  period: Period;
  text: Text;
}) {
  const amount = useAmount();
  const { locale } = useLocale();
  const percent = (share: number) =>
    new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(share);
  const insights = useT().insights;
  const accessToken = useToken();
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const quarters = data.quarters ?? [];
  const current =
    quarters.find((entry) => entry.state === 'current') ??
    [...quarters].reverse().find((entry) => entry.state === 'past');
  const figure =
    period === 'year'
      ? data.securedEbitCents
      : period === 'quarter'
        ? (current?.securedCents ?? 0)
        : (data.sinceStartSecuredCents ?? data.securedEbitCents);
  const label =
    period === 'year'
      ? text.results(data.fiscalYear)
      : period === 'quarter' && current
        ? text.resultsQuarter(current.quarter)
        : text.resultsAll;
  const goal = period === 'year' ? data.goalEbitCents : null;
  const highest = Math.max(1, ...quarters.map((entry) => entry.securedCents));

  return (
    <ChartCard
      className="w-full"
      label={label}
      title={text.ebit(amount(figure, data.currency))}
      source={text.cash(amount(data.cashCents, data.currency))}
      link={{ label: text.allResults, href: '/uebersicht/ergebnisse' }}
      renderLink={routerLink}
    >
      {saved && <StatusLine message={insights.goalSaved} onHidden={() => setSaved(false)} />}
      {goal !== null && (
        <div className="flex flex-col gap-2">
          <GoalRings
            result={{
              label: text.goal(data.fiscalYear),
              actual: figure,
              target: goal,
              format: (value, target) => percent(target ? value / target : 0),
            }}
          />
          <p className="text-base text-muted-foreground">
            {figure >= goal
              ? text.goalReached(amount(goal, data.currency))
              : text.ofGoal(amount(goal, data.currency), amount(goal - figure, data.currency))}
          </p>
        </div>
      )}
      {period === 'year' && data.goalEbitCents === null && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">{text.noGoal}</span>
          {data.canSetGoal && !editing && (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              {insights.setGoal}
            </Button>
          )}
        </div>
      )}
      {editing && (
        <AmountForm
          label={insights.goalLabel(data.fiscalYear)}
          submitLabel={insights.saveGoal}
          onCancel={() => setEditing(false)}
          onSubmit={async (cents) => {
            await saveEbitGoal(accessToken, { year: data.fiscalYear, amountCents: cents });
            await client.invalidateQueries({ queryKey: ['uebersicht'] });
            setEditing(false);
            setSaved(true);
          }}
        />
      )}
      {quarters.length === 4 && (
        <ChartColumns
          label={text.quarters}
          items={quarters.map((entry) => ({
            key: String(entry.quarter),
            label:
              entry.state === 'current'
                ? text.quarterNow(entry.quarter)
                : text.quarter(entry.quarter),
            value: entry.state === 'future' ? '–' : amount(entry.securedCents, data.currency),
            share: entry.securedCents / highest,
            future: entry.state === 'future',
          }))}
        />
      )}
    </ChartCard>
  );
}

/**
 * „Zusammengefasst von Reziproq“: ein Satz mit der wichtigsten Zahl, höchstens drei Punkte mit
 * Status-Chip und die Quellen. Ohne geprüfte Aussage steht der neutrale Titel des Bereichs.
 */
function Summary({ data, text, today }: { data: OverviewInsight; text: Text; today: string }) {
  const t = useT();
  const { locale } = useLocale();
  const accessToken = useToken();
  const [reported, setReported] = useState(false);
  const sentences = data.sentences ?? [];
  if (!data.statement && sentences.length === 0) return null;
  const statement = data.statement;
  return (
    <SoWhat
      heading={text.summary}
      statement={statement?.headline ?? text.neutral}
      points={sentences.map((sentence) => ({
        key: sentence.kind,
        status: text.chips[sentence.kind],
        tone: chipTone[sentence.kind],
        text: sentence.text,
        href: sentence.href,
      }))}
      source={
        statement && statement.sources.length > 0
          ? text.sources(
              statement.sources.map((source) => source.label).join(', '),
              shortDate(locale, today),
            )
          : undefined
      }
      action={
        statement &&
        (reported ? (
          <span role="status" className="text-muted-foreground text-sm">
            {t.insights.reported}
          </span>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await reportStatement(accessToken, statement.id);
              setReported(true);
            }}
          >
            {t.insights.report}
          </Button>
        ))
      }
      renderLink={routerLink}
    />
  );
}

/** Warengruppen: Stand der Strategien je Warengruppe (F-UX-15: EBIT je Warengruppe fehlt noch) */
function CategoriesCard({ strategies, text }: { strategies: StrategyOverview; text: Text }) {
  const groups = strategies.groups.filter((group) => !group.hidden);
  if (groups.length === 0) return null;
  const done = (group: (typeof groups)[number]) =>
    group.strategy?.steps.filter((state) => state === 'done').length ?? 0;
  const sorted = [...groups].sort((a, b) => done(b) - done(a)).slice(0, 6);
  return (
    <ChartCard
      label={text.categories.label}
      title={text.categories.title(strategies.approvedCount, groups.length)}
      source={text.categories.source(strategies.year)}
      link={{ label: text.categories.link(strategies.groups.length), href: '/warengruppen' }}
      renderLink={routerLink}
    >
      <ChartBars
        items={sorted.map((group) => ({
          key: group.id,
          label: group.name,
          share: done(group) / 10,
          value:
            group.strategy?.status === 'approved'
              ? text.categories.approved
              : group.strategy
                ? text.categories.value(done(group))
                : text.categories.notStarted,
        }))}
      />
    </ChartCard>
  );
}

/** Lieferanten: Spend nach Segment, sortiert; Link „n Lieferanten brauchen dich“ */
function SuppliersCard({
  matrix,
  text,
  needsYou,
}: {
  matrix: PortfolioMatrix;
  text: Text;
  needsYou: number | undefined;
}) {
  const amount = useAmount();
  const { locale } = useLocale();
  const bySegment = new Map<string, number>();
  for (const point of matrix.points) {
    bySegment.set(
      point.soll.typeName,
      (bySegment.get(point.soll.typeName) ?? 0) + point.spendCents,
    );
  }
  const total = [...bySegment.values()].reduce((sum, value) => sum + value, 0);
  if (matrix.points.length === 0 || total === 0) return null;
  const segments = [...bySegment.entries()].sort((a, b) => b[1] - a[1]);
  const [top] = segments;
  const currency = matrix.points[0]?.currency ?? 'EUR';
  const percent = (value: number) =>
    new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(value);
  return (
    <ChartCard
      label={text.suppliers.label}
      title={top ? text.suppliers.title(top[0], percent(top[1] / total)) : text.suppliers.label}
      source={text.suppliers.source(matrix.spendYear, matrix.points.length)}
      link={{
        label: needsYou ? text.suppliers.link(needsYou) : text.suppliers.linkNone,
        href: '/lieferanten',
      }}
      renderLink={routerLink}
    >
      <ChartBars
        items={segments.map(([name, value]) => ({
          key: name,
          label: name,
          share: value / (top?.[1] ?? 1),
          value: amount(value, currency),
        }))}
      />
    </ChartCard>
  );
}
