import { displayNameOf, type Money, type RelationshipSegments } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { FactoryIcon, Grid2x2Icon, LockIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { ChartBars, ChartCard } from '@/components/ui/chart-card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { PageTitle } from '@/components/ui/page-title';
import { PrivateNote } from '@/components/ui/private-note';
import { Row, RowGroup } from '@/components/ui/row-group';
import { SegmentMatrix } from '@/components/ui/segment-matrix';
import { SoWhat, type SoWhatPoint } from '@/components/ui/so-what';
import { useMe } from '@/features/auth/use-me';
import { useCan } from '@/features/auth/use-permissions';
import { useCycleStatus } from '@/features/portfolio/cycle-status-page';
import { usePortfolio } from '@/features/portfolio/use-portfolio';
import { useToken } from '@/features/ratings/use-rating';
import { roundsPath } from '@/features/rounds/use-round';
import { segmentationPath } from '@/features/segmentation/consolidate-page';
import { routerLink } from '@/features/shell/navigation';
import { useDocumentTitle } from '@/features/shell/page-header';
import { NextActionCard, shortDate } from '@/features/start/next-action';
import {
  ApiError,
  relationshipSegmentsQueryOptions,
  relationshipsNextQueryOptions,
} from '@/lib/api';
import { type Format, useFormat } from '@/lib/format';
import { useLocale, useMessages, useT } from '@/lib/i18n';
import { RelationshipLenses } from './lenses';
import { segmentsMessages } from './segments-messages';
import {
  fieldNames,
  fieldsInReadingOrder,
  levelOf,
  segmentListHref,
  shareInWords,
  spendBars,
  unratedIsLargest,
} from './segments-view';

type Text = (typeof segmentsMessages)['de'];

/** Beträge wie in der Vorlage: „18,4 Mio. €“, „5,64 Mio. €“ */
const spendOf = (format: Format, spend: Money | null | undefined) =>
  spend ? format.money(spend, { compact: true, fractionDigits: 2 }) : null;

/**
 * Seite Lieferanten, Linse Segmente (BZ-01, K2-b.5, nach Vorlage K2-Segmente): Kopf mit Portfolio,
 * Bewerteten und laufender Runde; Als Nächstes über alle Beziehungen; Das Wichtigste mit Klären und
 * Fehlt; die Matrix des aktiven Segmentmodells über das ganze Portfolio (E-K2-10) mit „Ohne
 * Bewertung“; Spend nach Segment. Rechts die Bewertungsrunden, „Nur für euch“ und die bisherigen
 * Seiten des Portfolios, bis K2-e sie ersetzt.
 */
export function SegmentsPage() {
  const t = useT();
  const text = useMessages(segmentsMessages);
  const format = useFormat();
  const { locale } = useLocale();
  const accessToken = useToken();
  const me = useMe();
  const canSeeRounds = useCan('runden.sehen');
  const canSeeModel = useCan('segmentmodell.sehen');
  const allowed = me.data?.permissions.viewSuppliers === true;
  const enabled = accessToken !== '' && allowed;
  // Wie Heute: ein Tab-Titel für beide Linsen
  useDocumentTitle(t.suppliers.title);
  const query = useQuery({ ...relationshipSegmentsQueryOptions(accessToken), enabled });
  const next = useQuery({ ...relationshipsNextQueryOptions(accessToken), enabled });

  const header = (where?: ReactNode) => (
    <div className="flex flex-col gap-5.5">
      <PageTitle title={t.suppliers.title} where={where} />
      <RelationshipLenses active="segmente" />
    </div>
  );
  const page = (where: ReactNode, content: ReactNode) => (
    <div className="flex flex-col gap-5.5">
      {header(where)}
      {content}
    </div>
  );

  // Ohne Organisation steht der Hinweis schon über jeder Seite (App-Rahmen)
  if (me.data && !me.data.organization) return header();
  const denied =
    (me.data && !allowed) ||
    (query.error instanceof ApiError && query.error.code === 'keine_berechtigung');
  if (denied) {
    return page(
      null,
      <EmptyState
        size="lg"
        icon={<LockIcon aria-hidden />}
        title={text.states.deniedTitle}
        description={text.states.deniedText}
      />,
    );
  }
  if (query.isError || me.isError) return page(null, <ErrorState title={text.states.failed} />);
  const data = query.data;
  if (!data) return page(null, <LoadingState label={text.states.loading} />);

  const round = data.round
    ? text.round(data.round.name, data.round.dueDate ? shortDate(locale, data.round.dueDate) : null)
    : null;
  const where = (
    <>
      <span className="hidden shell:inline">{text.head(data.portfolio, data.rated, round)}</span>
      <span className="shell:hidden">{text.headPhone(data.portfolio, data.rated)}</span>
    </>
  );

  if (data.portfolio === 0) {
    return page(
      where,
      <EmptyState
        size="lg"
        icon={<FactoryIcon aria-hidden />}
        title={text.states.emptyTitle}
        description={text.states.emptyText}
      />,
    );
  }
  if (!data.model) {
    return page(
      where,
      <EmptyState
        size="lg"
        icon={<Grid2x2Icon aria-hidden />}
        title={text.states.noModelTitle}
        description={text.states.noModelText}
        action={
          canSeeModel &&
          routerLink({
            href: '/einstellungen/segmentmodell',
            className: buttonVariants({ variant: 'secondary' }),
            children: text.states.noModelAction,
          })
        }
      />,
    );
  }

  return page(
    where,
    // Vorlage K2-Segmente: Arbeit links, Kontext rechts in einer schmalen Spalte (wie die Liste)
    <div className="grid gap-5.5 wide:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-5.5">
        <NextActionCard next={next.data?.next} />
        <SegmentsSummary data={data} text={text} format={format} />
        <MatrixCard data={data} model={data.model} text={text} format={format} />
        <SpendCard data={data} text={text} format={format} />
      </div>
      <aside className="flex min-w-0 flex-col gap-5.5">
        {canSeeRounds && <Rounds round={data.round} text={text} locale={locale} />}
        <PrivateNote title={text.aside.privateTitle} chip={text.aside.privateChip}>
          <p>{text.aside.privateText}</p>
        </PrivateNote>
        <PortfolioDetail text={text} />
        {canSeeModel && (
          <RowGroup label={text.aside.model}>
            <Row
              href="/einstellungen/segmentmodell"
              title={text.aside.criteria}
              detail={text.aside.criteriaSub(
                data.model.impactLabel,
                data.model.qualityLabel,
                data.model.gridSize,
              )}
              wrap
              renderLink={routerLink}
            />
          </RowGroup>
        )}
      </aside>
    </div>,
  );
}

/**
 * Das Wichtigste (Vorlage K2-Segmente): ein Satz zum Feld mit beiden höchsten Stufen aus belegten
 * Zahlen (G-6), darunter Klären je strittigem Lieferanten und Fehlt für die ohne Bewertung,
 * höchstens drei Zeilen. „Vorschlag“ (Segment vorschlagen) kommt mit K2-e.
 */
function SegmentsSummary({
  data,
  text,
  format,
}: {
  data: RelationshipSegments;
  text: Text;
  format: Format;
}) {
  const top = data.summary.top;
  const topSpend = spendOf(format, top?.spend[0]);
  const words = top?.share == null ? null : shareInWords(top.share);
  const share =
    top?.share == null
      ? null
      : words
        ? text.summary.approx[words.approx](text.summary.fractions[words.fraction])
        : text.summary.percent(top.share);
  const statement =
    top && top.count > 0 && topSpend ? text.summary.top(top.count, top.name, topSpend, share) : '';
  const clarify = data.summary.disputed.slice(0, 2);
  const largest = data.unrated.suppliers[0];
  const points: SoWhatPoint[] = [
    ...clarify.map((entry) => ({
      key: `klaeren-${entry.relationshipId}`,
      status: text.summary.chips.clarify,
      tone: 'warning' as const,
      text: text.summary.clarify(
        displayNameOf(entry.name).name,
        Math.round(entry.max - entry.min),
        entry.criterion.name,
        entry.decidesSegment,
      ),
      // Bis zur Segment-Mappe (K2-e) die Segmentierung des Lieferanten mit Konsolidieren (SEG-07)
      href: segmentationPath(entry.relationshipId),
    })),
    ...(largest
      ? [
          {
            key: 'fehlt',
            status: text.summary.chips.missing,
            tone: 'warning' as const,
            text: text.summary.missing(
              data.unrated.count,
              displayNameOf(largest.name).name,
              unratedIsLargest(data),
            ),
            href: segmentListHref('ohne'),
          },
        ]
      : []),
  ];
  if (!statement && points.length === 0) return null;
  const sources = [
    clarify.length > 0 ? text.summary.sources.round : null,
    topSpend ? text.summary.sources.spend : null,
    text.summary.sources.model,
  ].filter((source): source is string => source !== null);
  return (
    <section aria-label={text.summary.label}>
      <SoWhat
        heading={text.summary.heading}
        statement={statement}
        sources={sources}
        points={points}
        renderLink={routerLink}
      />
    </section>
  );
}

/**
 * Matrix über das ganze Portfolio (Vorlage: „Portfolio · nur eure Seite“), darunter „Ohne
 * Bewertung“. Jedes Feld öffnet die Liste mit Filter Segment. Abweichung nach Designsprache
 * (Diagramme, Regel 1): Die Karte trägt eine Aussage mit Zahl als Titel.
 */
function MatrixCard({
  data,
  model,
  text,
  format,
}: {
  data: RelationshipSegments;
  model: NonNullable<RelationshipSegments['model']>;
  text: Text;
  format: Format;
}) {
  const size = model.gridSize;
  const disputed = data.fields.reduce(
    (sum, field) => sum + field.suppliers.filter((supplier) => supplier.disputed).length,
    0,
  );
  const fields = fieldsInReadingOrder(data.fields).map((field) => {
    const { names, rest } = fieldNames(field.suppliers);
    return {
      key: field.key,
      name: field.name,
      count: field.count,
      value: spendOf(format, field.spend[0]) ?? undefined,
      position: text.matrix.position(
        model.impactLabel,
        text.matrix.levels[levelOf(field.impactLevel, size)],
        model.qualityLabel,
        text.matrix.levels[levelOf(field.qualityLevel, size)],
      ),
      top: field.impactLevel === size && field.qualityLevel === size,
      names: names.map(({ supplier, label }) => ({
        key: supplier.relationshipId,
        label,
        disputed: supplier.disputed,
      })),
      rest: rest > 0 ? text.matrix.rest(rest) : undefined,
      href: field.count > 0 ? segmentListHref(field.key) : undefined,
    };
  });
  const largest = data.unrated.suppliers[0];
  return (
    <ChartCard
      label={text.matrix.label}
      title={text.matrix.title(data.rated, data.portfolio, disputed)}
      source={text.matrix.source(model.impactLabel, model.qualityLabel)}
    >
      <SegmentMatrix
        size={size}
        fields={fields}
        label={text.matrix.name}
        disputedLabel={text.matrix.disputed}
        renderLink={routerLink}
      />
      {largest && (
        <div className="overflow-hidden rounded-md border border-row-line">
          <Row
            href={segmentListHref('ohne')}
            title={text.matrix.unrated(data.unrated.count)}
            detail={text.matrix.unratedDetail(
              displayNameOf(largest.name).name,
              spendOf(format, largest.spend),
            )}
            value={<Badge variant="warning">{text.matrix.unratedChip}</Badge>}
            wrap
            renderLink={routerLink}
          />
        </div>
      )}
    </ChartCard>
  );
}

/** Spend nach Segment (Vorlage): Balken der Größe nach, Wert rechts, Petrol (Designsprache, Regel 3) */
function SpendCard({
  data,
  text,
  format,
}: {
  data: RelationshipSegments;
  text: Text;
  format: Format;
}) {
  const bars = spendBars(data);
  const total = spendOf(format, data.ratedSpend[0]);
  if (bars.length === 0 || !total) return null;
  return (
    <ChartCard
      label={text.spend.label(data.year)}
      title={text.spend.title(data.rated, total)}
      source={text.spend.source}
    >
      <ChartBars
        items={bars.map((bar) => ({
          key: bar.key,
          label: bar.name,
          share: bar.share,
          value: spendOf(format, bar.spend) ?? '',
        }))}
      />
    </ChartCard>
  );
}

/**
 * Bewertungsrunden (Anker `#runde`, BZ-01 Weiterleitungen): die offene Runde und alle Runden auf
 * ihren bisherigen Seiten. Die Karte mit Fortschritt je Lieferant (Vorlage) kommt mit K2-e.
 */
function Rounds({
  round,
  text,
  locale,
}: {
  round: RelationshipSegments['round'];
  text: Text;
  locale: string;
}) {
  return (
    <div id="runde" className="scroll-mt-6">
      <RowGroup label={text.aside.rounds}>
        {round && (
          <Row
            href={`${roundsPath}/${round.id}`}
            title={round.name}
            detail={
              round.dueDate
                ? text.aside.roundUntil(shortDate(locale, round.dueDate))
                : text.aside.roundOpen
            }
            renderLink={routerLink}
          />
        )}
        <Row
          href={roundsPath}
          title={text.aside.allRounds}
          detail={text.aside.allRoundsSub}
          renderLink={routerLink}
        />
      </RowGroup>
    </div>
  );
}

/**
 * Die bisherigen Seiten des Portfolios (SEG-07, ZYK-04), bis K2-e sie in Mappen und Linsen
 * überführt: Matrix mit Filtern (auch nach Warengruppe, WG-18), offene Entscheidungen,
 * Fokuslieferanten und Stand der Zyklen, je mit ihrer Zahl.
 */
function PortfolioDetail({ text }: { text: Text }) {
  const portfolio = usePortfolio();
  const cycles = useCycleStatus();
  const counts = portfolio.data;
  return (
    <RowGroup label={text.aside.detail}>
      <Row
        href="/portfolio/matrix"
        title={text.aside.matrix}
        detail={text.aside.matrixSub}
        wrap
        renderLink={routerLink}
      />
      <Row
        href="/portfolio/offen"
        title={text.aside.open}
        detail={counts ? text.aside.openSub(counts.openCount) : undefined}
        renderLink={routerLink}
      />
      <Row
        href="/portfolio/fokus"
        title={text.aside.focus}
        detail={counts ? text.aside.focusSub(counts.focusCount) : undefined}
        renderLink={routerLink}
      />
      <Row
        href="/portfolio/zyklen"
        title={text.aside.cycles}
        detail={cycles.data ? text.aside.cyclesSub(cycles.data.metrics.overdue) : undefined}
        renderLink={routerLink}
      />
    </RowGroup>
  );
}
