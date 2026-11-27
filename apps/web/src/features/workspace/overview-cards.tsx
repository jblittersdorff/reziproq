import {
  type OverviewFigures,
  type OverviewMetric,
  progressFromBaseline,
  type SupplierCycle,
  type SupplierOverview,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LockIcon } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChartBars, ChartCard, ChartFigures } from '@/components/ui/chart-card';
import { DateList } from '@/components/ui/date-list';
import { GoalRings } from '@/components/ui/goal-rings';
import { Monogram } from '@/components/ui/monogram';
import { ProcessChain } from '@/components/ui/process-chain';
import { Row, RowGroup } from '@/components/ui/row-group';
import { SoWhat, type SoWhatPoint } from '@/components/ui/so-what';
import { VisibilityBadge } from '@/components/ui/visibility-badge';
import { useHintWhy } from '@/features/hints/hint-panel';
import { AmountForm } from '@/features/insights/insight-pages';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { timelineMessages } from '@/features/start/my-day-messages';
import { timelineDateItem } from '@/features/start/next-action';
import {
  activitiesQueryOptions,
  approveSupplierTarget,
  proposeSupplierTarget,
  reportStatement,
  scorecardQueryOptions,
  supplierRingsQueryOptions,
  timelineQueryOptions,
  touchpointsQueryOptions,
} from '@/lib/api';
import { useLocale, useMessages, useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { cyclePhases } from './phases';
import { supplierMessages } from './supplier-messages';
import { tabHref } from './tabs';

function useAmount() {
  const { locale } = useLocale();
  return (cents: number, currency = 'EUR') =>
    formatMoney({ amountCents: cents, currency }, locale, { compact: true });
}

function usePercent() {
  const { locale } = useLocale();
  const format = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const signed = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
    signDisplay: 'exceptZero',
  });
  return {
    share: (basisPoints: number) => format.format(basisPoints / 10_000),
    change: (basisPoints: number) => signed.format(basisPoints / 10_000),
  };
}

const metricOf = <K extends OverviewMetric['kind']>(metrics: OverviewMetric[], kind: K) =>
  metrics.find((metric): metric is Extract<OverviewMetric, { kind: K }> => metric.kind === kind);

/** Schrittfolge mit vier Phasen unter dem Kopf (NAV-10 Seitenregel 2, Vorlage L-Ueberblick) */
export function PhaseChain({ cycle }: { cycle: SupplierCycle }) {
  const text = useMessages(supplierMessages).phases;
  return (
    <ProcessChain
      label={text.label(cycle.label)}
      stateLabels={text.states}
      renderLink={routerLink}
      steps={cyclePhases(cycle).map((phase) => ({
        key: phase.key,
        label: text[phase.key],
        state: phase.state,
        ...(phase.href ? { href: phase.href } : {}),
      }))}
    />
  );
}

/**
 * Zeilen mit Stand-Chip (NAV-10 1.1): Hinweise (KI-16, oben im Überblick), Ergebnisse,
 * Aktivitäten, Gemeinsamer Plan, Team und Spielregeln (bis zum Beziehungsnetz, F-UX-02) und die
 * private Strategie (WG-14, WG-20). Claims und Risiken entfallen, solange ihre Module aus sind.
 */
export function OverviewRows({
  relationshipId,
  overview,
}: {
  relationshipId: string;
  overview: SupplierOverview;
}) {
  const text = useMessages(supplierMessages).rows;
  const accessToken = useToken();
  const amount = useAmount();
  const hintWhy = useHintWhy();
  const enabled = accessToken !== '';
  const rings = useQuery({ ...supplierRingsQueryOptions(accessToken, relationshipId), enabled });
  const activities = useQuery({ ...activitiesQueryOptions(accessToken, relationshipId), enabled });
  const base = `/lieferanten/${relationshipId}`;
  const metrics = overview.metrics;
  const ring = rings.data;
  const risk = ring?.risk ?? null;
  const approved = ring?.target?.approved ? ring.target.ebitTargetCents : null;
  const chance = ring?.chance ?? null;
  const latest = activities.data?.items[0];
  const plan = metricOf(metrics, 'jbp');
  const team = metricOf(metrics, 'team_size');
  const rules = metricOf(metrics, 'rules');
  const target = metricOf(metrics, 'segment_target');
  const segment = overview.head.segment;
  const hints = overview.openHints ?? 0;
  const overdue = overview.overdueCommitments ?? 0;
  const drafts = overview.openDrafts ?? 0;
  const conflicts = overview.openConflicts ?? 0;
  const awards = overview.upcomingAwards ?? 0;
  const join = (parts: (string | null | false | undefined)[]) =>
    parts.filter(Boolean).join(' · ') || undefined;

  return (
    <RowGroup label={text.label}>
      {hints > 0 && (
        <Row
          title={text.hints}
          detail={risk ? hintWhy({ ruleKey: risk.ruleKey, detail: risk.detail }) : undefined}
          value={<Badge variant="warning">{text.hintsOpen(hints)}</Badge>}
          href={risk ? `/warum/${risk.hintId}` : '/heute?ansicht=alles'}
          renderLink={routerLink}
        />
      )}
      <Row
        title={text.results}
        detail={
          ring
            ? join([
                approved !== null
                  ? text.resultsOf(
                      amount(ring.securedEbitCents, ring.currency),
                      amount(approved, ring.currency),
                    )
                  : text.resultsNoTarget(amount(ring.securedEbitCents, ring.currency)),
                chance &&
                  text.chance(
                    amount(chance.low, ring.currency),
                    amount(chance.high, ring.currency),
                  ),
              ])
            : undefined
        }
        value={
          ring && approved
            ? `${Math.round((Math.max(0, ring.securedEbitCents) / approved) * 100)} %`
            : undefined
        }
        valueTone="accent"
        href={tabHref(relationshipId, 'results')}
        renderLink={routerLink}
      />
      <Row
        title={text.activities}
        detail={
          latest
            ? text.lastActivity(
                text.kinds[latest.kind] ?? latest.kind,
                latest.actor.type === 'person' ? latest.actor.name : text.reziproq,
              )
            : activities.data
              ? text.noActivity
              : undefined
        }
        value={drafts > 0 ? <Badge variant="shared">{text.toReview(drafts)}</Badge> : undefined}
        // K2-c.7: Der Verlauf steht in der Akte, Nur für dich (E-K2-12)
        href={`/beziehungen/${relationshipId}?sicht=privat#verlauf`}
        renderLink={routerLink}
      />
      <Row
        title={text.plan}
        detail={
          plan
            ? join([
                text.planOf(plan.topics, plan.initiatives),
                ring && ring.commitments.due > 0
                  ? text.kept(ring.commitments.keptOnTime, ring.commitments.due)
                  : null,
              ])
            : text.planEmpty
        }
        value={
          overdue > 0 ? (
            <Badge variant="danger">{text.overdue(overdue)}</Badge>
          ) : plan ? (
            <Badge variant={plan.status === 'approved' ? 'success' : 'neutral'}>
              {text.planStatus[plan.status]}
            </Badge>
          ) : undefined
        }
        href={tabHref(relationshipId, 'plan')}
        renderLink={routerLink}
      />
      <Row
        title={text.relationship}
        detail={join([
          overview.head.sro ? text.sro(overview.head.sro.name) : text.noSro,
          team ? text.team(team.count) : null,
          rules ? text.rules(rules.version) : text.noRules,
        ])}
        href={`${base}/beziehung/team`}
        renderLink={routerLink}
      />
      <Row
        lead={<LockIcon aria-hidden className="size-4 text-muted-foreground" />}
        title={text.strategy}
        detail={join([
          segment
            ? text.segment(segment.current, segment.target)
            : target
              ? text.provisional(target.typeName)
              : text.unrated,
          conflicts > 0 && text.conflicts(conflicts),
          awards > 0 && text.awards(awards),
        ])}
        value={<VisibilityBadge visibility="internal" label={text.privateLabel} />}
        href={`${base}/strategie/segmentierung`}
        renderLink={routerLink}
      />
    </RowGroup>
  );
}

/** Diagrammkarte Leistung aus der Scorecard (JBP-09): Fortschritt je Kennzahl von der Basis zum Ziel */
export function PerformanceCard({ relationshipId }: { relationshipId: string }) {
  const text = useMessages(supplierMessages).performance;
  const { locale } = useLocale();
  const accessToken = useToken();
  const query = useQuery({
    ...scorecardQueryOptions(accessToken, `/suppliers/${relationshipId}`),
    enabled: accessToken !== '',
  });
  const scorecard = query.data;
  if (!scorecard?.hasPlan || scorecard.kpis.length === 0) return null;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const kpis = scorecard.kpis.slice(0, 5);
  const onTrack = scorecard.kpis.filter((kpi) => kpi.track === 'on_track').length;
  return (
    <ChartCard
      label={text.label}
      title={text.title(onTrack, scorecard.kpis.length)}
      source={text.source(scorecard.version, scorecard.status === 'signed')}
      link={{ label: text.link, href: `/lieferanten/${relationshipId}/plan/scorecard` }}
      renderLink={routerLink}
    >
      <ChartBars
        items={kpis.map((kpi) => {
          const latest = kpi.values.at(-1)?.value ?? null;
          const baseline = kpi.baseline ?? kpi.values[0]?.value ?? null;
          const share = progressFromBaseline(
            baseline === null ? null : Number(baseline),
            Number(kpi.target),
            latest === null ? null : Number(latest),
          );
          const target = number.format(Number(kpi.target));
          const value =
            latest === null
              ? text.noValue(target, kpi.unit)
              : text.value(number.format(Number(latest)), kpi.unit, target);
          return {
            key: kpi.id,
            label: kpi.name,
            share: share ?? 0,
            value: kpi.track ? `${value} · ${text.tracks[kpi.track]}` : value,
          };
        })}
      />
    </ChartCard>
  );
}

/**
 * Zusammengefasst von Reziproq (AW-01): Aussage zur Beziehung, größte Chance und größtes Risiko als
 * Punkte mit Status-Chip. Ohne Aussage und ohne Kandidat fehlt die Karte.
 */
export function SummaryCard({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = useMessages(supplierMessages).summary;
  const accessToken = useToken();
  const amount = useAmount();
  const hintWhy = useHintWhy();
  const [reported, setReported] = useState(false);
  const query = useQuery({
    ...supplierRingsQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  const data = query.data;
  if (!data) return null;
  const statement = data.statement ?? null;
  const points: SoWhatPoint[] = [];
  if (data.chance) {
    points.push({
      key: 'chance',
      status: text.chance,
      tone: 'success',
      text: text.chanceText(
        t.opportunities.templates[data.chance.templateKey] ?? data.chance.templateKey,
        amount(data.chance.low, data.currency),
        amount(data.chance.high, data.currency),
      ),
      href: `/lieferanten/${relationshipId}/wirkung/wertpotenziale#potenzial-${data.chance.opportunityId}`,
    });
  }
  if (data.risk) {
    points.push({
      key: 'risk',
      status: text.risk,
      tone: data.risk.severity === 'high' ? 'danger' : 'warning',
      text: hintWhy({ ruleKey: data.risk.ruleKey, detail: data.risk.detail }),
      href: `/warum/${data.risk.hintId}`,
    });
  }
  if (!statement && points.length === 0) return null;
  return (
    <SoWhat
      heading={text.label}
      statement={statement?.headline ?? text.title}
      points={points}
      {...(statement && statement.sources.length > 0
        ? { source: statement.sources.map((source) => source.label).join(', ') }
        : {})}
      {...(statement
        ? {
            action: reported ? (
              <span role="status" className="text-muted-foreground text-sm">
                {t.insights.reported}
              </span>
            ) : (
              <Button
                variant="ghost"
                onClick={async () => {
                  await reportStatement(accessToken, statement.id);
                  setReported(true);
                }}
              >
                {t.insights.report}
              </Button>
            ),
          }
        : {})}
      renderLink={routerLink}
    />
  );
}

/** Kennzahlen (NAV-10 1.1): Spend mit Veränderung, Anteil an der Warengruppe, größte Feedback-Lücke */
export function FiguresCard({
  figures,
  name,
}: {
  figures: OverviewFigures | undefined;
  name: string;
}) {
  const t = useT();
  const text = useMessages(supplierMessages).figures;
  const { locale } = useLocale();
  const percent = usePercent();
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const items = [
    figures?.spend && {
      key: 'spend',
      value: formatMoney(figures.spend.amount, locale, { compact: true }),
      label:
        figures.spend.changeBasisPoints === null
          ? text.spend(figures.spend.year)
          : `${text.spend(figures.spend.year)}, ${text.change(percent.change(figures.spend.changeBasisPoints))}`,
    },
    figures?.groupShare && {
      key: 'share',
      value: percent.share(figures.groupShare.basisPoints),
      label: text.share(figures.groupShare.group),
    },
    figures?.feedbackGap && {
      key: 'gap',
      value: decimal.format(Math.abs(figures.feedbackGap.delta)),
      label: text.gap(
        t.settings.survey.dimensions[figures.feedbackGap.dimension] ??
          figures.feedbackGap.dimension,
      ),
    },
  ].filter((item): item is { key: string; value: string; label: string } => Boolean(item));
  return (
    <ChartCard label={text.label} title={text.title(name)}>
      {items.length > 0 ? (
        <ChartFigures items={items} stacked />
      ) : (
        <p className="text-muted-foreground">{text.empty}</p>
      )}
    </ChartCard>
  );
}

/**
 * Ergebnisse gegen Ziel (AW-01): Ringpaar gesichertes EBIT gegen das freigegebene Ziel und
 * eingehaltene Zusagen; Ziel vorschlagen und freigeben bleiben hier (Zweitknöpfe).
 */
export function GoalCard({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = t.insights;
  const label = useMessages(supplierMessages).goal.label;
  const accessToken = useToken();
  const client = useQueryClient();
  const amount = useAmount();
  const [editing, setEditing] = useState(false);
  const query = useQuery({
    ...supplierRingsQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  const data = query.data;
  if (!data) return null;
  const approved = data.target?.approved ? data.target.ebitTargetCents : null;
  const refresh = () =>
    client.invalidateQueries({ queryKey: ['suppliers', relationshipId, 'ringe'] });
  return (
    <ChartCard
      label={label(data.fiscalYear)}
      title={text.supplierEvidence(amount(data.securedEbitCents, data.currency))}
      source={text.supplierSource(data.fiscalYear)}
    >
      <GoalRings
        compact
        result={{
          label: text.result,
          actual: data.securedEbitCents,
          target: approved,
          format: (value, target) =>
            target === null
              ? amount(value, data.currency)
              : text.moneyOf(amount(value, data.currency), amount(target, data.currency)),
        }}
        relationships={{
          label: text.commitments,
          actual: data.commitments.keptOnTime,
          target: data.commitments.due || null,
          format: (value, target) => text.commitmentsOf(value, target ?? 0),
        }}
      />
      {data.target && !data.target.approved && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            {text.targetPending(amount(data.target.ebitTargetCents, data.currency))}
          </span>
          {data.canApprove && (
            <Button
              variant="secondary"
              onClick={async () => {
                await approveSupplierTarget(accessToken, relationshipId, data.fiscalYear);
                await refresh();
              }}
            >
              {text.approveTarget}
            </Button>
          )}
        </div>
      )}
      {!approved && data.canPropose && !editing && (
        <Button variant="secondary" className="self-start" onClick={() => setEditing(true)}>
          {data.target ? text.proposeTarget : text.setGoal}
        </Button>
      )}
      {editing && (
        <AmountForm
          label={text.targetLabel(data.fiscalYear)}
          submitLabel={text.saveTarget}
          onCancel={() => setEditing(false)}
          onSubmit={async (cents) => {
            await proposeSupplierTarget(accessToken, relationshipId, {
              year: data.fiscalYear,
              amountCents: cents,
            });
            await refresh();
            setEditing(false);
          }}
        />
      )}
    </ChartCard>
  );
}

/** Termine und Fristen dieses Lieferanten aus `timeline_item`, sechs Wochen voraus */
export function DatesCard({ relationshipId }: { relationshipId: string }) {
  const text = useMessages(supplierMessages).dates;
  const rail = useMessages(timelineMessages);
  const { locale } = useLocale();
  const accessToken = useToken();
  const query = useQuery({
    ...timelineQueryOptions(accessToken, 42, relationshipId),
    enabled: accessToken !== '',
  });
  const items = query.data?.items ?? [];
  return (
    <ChartCard
      label={text.label}
      title={text.title}
      link={{ label: text.all, href: `/lieferanten/${relationshipId}/umsetzung/termine` }}
      renderLink={routerLink}
    >
      {items.length > 0 ? (
        <DateList
          locale={locale}
          label={text.title}
          renderLink={routerLink}
          items={items.slice(0, 5).map((item) => timelineDateItem(rail, item, locale))}
        />
      ) : (
        <p className="text-muted-foreground">{query.data ? text.empty : ''}</p>
      )}
    </ChartCard>
  );
}

/**
 * Kontakte beim Lieferanten aus den Kontaktpunkten (PLB-03): wer bei ihnen mit euch spricht, mit
 * Ebene und Takt; vereinbarte Formate ohne Kontaktpunkt als Lücke. Die Stärke der Verbindung und
 * Lücken zu Entscheidern kommen mit dem Beziehungsnetz (F-UX-02, Phase 4).
 */
export function ContactsCard({ relationshipId, name }: { relationshipId: string; name: string }) {
  const t = useT();
  const text = useMessages(supplierMessages).contacts;
  const { locale } = useLocale();
  const accessToken = useToken();
  const query = useQuery({
    ...touchpointsQueryOptions(accessToken, relationshipId, 'buyer'),
    enabled: accessToken !== '',
  });
  const data = query.data;
  if (!data) return null;
  const byContact = new Map<string, (typeof data.touchpoints)[number]>();
  for (const touchpoint of data.touchpoints) {
    if (!byContact.has(touchpoint.supplierName)) byContact.set(touchpoint.supplierName, touchpoint);
  }
  const contacts = [...byContact.values()];
  const shown = contacts.slice(0, 3);
  const gap = data.gaps[0];
  const gapTitle = gap ? gap.title[locale] : '';
  return (
    <ChartCard
      {...(contacts.length > 0 ? { label: text.label(shown.length, contacts.length) } : {})}
      title={text.title(name)}
      link={{ label: text.link, href: `/lieferanten/${relationshipId}/beziehung/kontaktpunkte` }}
      renderLink={routerLink}
    >
      {shown.length === 0 && !gap ? (
        <p className="text-muted-foreground">{text.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-row-line">
          {shown.map((touchpoint) => (
            <li key={touchpoint.id} className="flex min-h-14 items-center gap-3 py-2">
              <Monogram name={touchpoint.supplierName} />
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="truncate font-semibold text-ink text-row">
                  {touchpoint.supplierName}
                </b>
                <span className="truncate text-detail text-muted-foreground">
                  {`${t.touchpoints.levels[touchpoint.supplierLevel] ?? ''} · ${touchpoint.buyerName}`}
                </span>
              </span>
              <Badge variant="neutral">{t.playbook.cadences[touchpoint.cadence]}</Badge>
            </li>
          ))}
          {gap && (
            <li className="flex min-h-14 items-center gap-3 py-2">
              <span className="min-w-0 flex-1 text-detail text-muted-foreground">
                {text.gapText(gapTitle)}
              </span>
              <Badge variant="danger">{text.gap}</Badge>
            </li>
          )}
        </ul>
      )}
    </ChartCard>
  );
}
