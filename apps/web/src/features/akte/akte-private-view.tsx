import type { Segmentation, TouchpointList } from '@reziproq/shared';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Monogram } from '@/components/ui/monogram';
import { PrivateNote } from '@/components/ui/private-note';
import { Row, RowGroup } from '@/components/ui/row-group';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { NextActionCard } from '@/features/start/next-action';
import {
  ApiError,
  actionListQueryOptions,
  nextActionQueryOptions,
  securedResultsQueryOptions,
  segmentationQueryOptions,
  supplierCategoriesQueryOptions,
  supplierPlanQueryOptions,
  touchpointsQueryOptions,
  valueOpportunitiesQueryOptions,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useLocale, useMessages, useT } from '@/lib/i18n';
import { History } from './akte-history';
import { ebitPotential, networkFinding, openTasks, planFacts, segmentFacts } from './akte-private';
import { aktePrivateMessages } from './akte-private-messages';
import { oldPage } from './akte-view';

const denied = (error: unknown) => error instanceof ApiError && error.status === 403;

/** Zahl mit höchstens einer Nachkommastelle, z. B. „0,4“ oder „25“ */
function useNumber() {
  const { locale } = useLocale();
  return (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
}

/**
 * Sicht Nur für dich (AK-01, K2-c.3, Vorlage K2-Akte-Privat): was nur das eigene Team sieht. Links
 * Als Nächstes, Das Wichtigste als private Fläche, offene Aufgaben, Verlauf und Beziehungsnetz;
 * rechts Segment und Bewertung, Lieferantenplan, Warengruppen und Wert. Jeder Abschnitt liest seinen
 * bestehenden Endpunkt mit dessen Rechten und hat eigene Lade- und Fehlerzustände.
 */
export function PrivateView({ relationshipId, name }: { relationshipId: string; name: string }) {
  const accessToken = useToken();
  const enabled = accessToken !== '';
  const next = useQuery({ ...nextActionQueryOptions(accessToken, relationshipId), enabled });
  const segmentation = useQuery({
    ...segmentationQueryOptions(accessToken, relationshipId),
    enabled,
  });
  const network = useQuery({
    ...touchpointsQueryOptions(accessToken, relationshipId, 'buyer'),
    enabled,
  });
  return (
    // Vorlage K2-Akte-Privat: Arbeit links, Kontext rechts in einer schmalen Spalte (wie Gemeinsam)
    <div className="grid gap-5.5 wide:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-5.5">
        <NextActionCard next={next.data?.next} />
        <Summary name={name} segmentation={segmentation} network={network} />
        <Tasks relationshipId={relationshipId} />
        <History relationshipId={relationshipId} name={name} />
        <Network query={network} relationshipId={relationshipId} name={name} />
      </div>
      <aside className="flex min-w-0 flex-col gap-5.5">
        <Segment query={segmentation} relationshipId={relationshipId} name={name} />
        <Plan relationshipId={relationshipId} />
        <Categories
          relationshipId={relationshipId}
          gridSize={segmentation.data?.segmentation?.model.gridSize ?? 3}
        />
        <Value relationshipId={relationshipId} />
      </aside>
    </div>
  );
}

/** Das Wichtigste als private Fläche: Satz zum Segment und einer zum Beziehungsnetz (G-6) */
function Summary({
  name,
  segmentation,
  network,
}: {
  name: string;
  segmentation: UseQueryResult<Segmentation>;
  network: UseQueryResult<TouchpointList>;
}) {
  const text = useMessages(aktePrivateMessages).summary;
  const number = useNumber();
  const facts = segmentation.data ? segmentFacts(segmentation.data.segmentation) : undefined;
  const finding = networkFinding(network.data);
  const segmentSentence =
    facts === undefined
      ? null
      : facts === null
        ? text.unrated(name)
        : facts.distance === null
          ? text.plain(name, facts.name)
          : (facts.close ? text.close : text.distance)(
              name,
              facts.name,
              text.points(number(facts.distance), facts.distance === 1),
            );
  const networkSentence =
    finding === null
      ? null
      : finding.kind === 'gaps'
        ? text.gaps(finding.count)
        : finding.kind === 'empty'
          ? text.empty(name)
          : text.unpaired(finding.names, finding.more);
  const statement = [segmentSentence, networkSentence].filter(Boolean).join(' ');
  if (!statement) return null;
  return (
    <PrivateNote label={text.label} title={text.title} chip={text.chip} statement={statement} />
  );
}

/** Offene interne Aufgaben (T2-I22); nur, wenn es welche gibt */
function Tasks({ relationshipId }: { relationshipId: string }) {
  const text = useMessages(aktePrivateMessages).tasks;
  const format = useFormat();
  const accessToken = useToken();
  const query = useQuery({
    ...actionListQueryOptions(accessToken, `/suppliers/${relationshipId}`),
    enabled: accessToken !== '',
  });
  const tasks = query.data ? openTasks(query.data.actions) : [];
  if (tasks.length === 0) return null;
  return (
    <RowGroup label={text.label}>
      {tasks.map((task) => (
        <Row
          key={task.id}
          href={oldPage(relationshipId, `/umsetzung/massnahmen/${task.id}`)}
          lead={<Monogram name={task.ownerName} tone="ink" />}
          title={task.title}
          detail={text.detail(task.ownerName, format.date(task.dueDate))}
          value={
            <Badge variant={task.overdue ? 'danger' : 'neutral'}>
              {task.overdue
                ? text.chips.overdue
                : text.chips[task.status === 'in_progress' ? 'in_progress' : 'open']}
            </Badge>
          }
          wrap
          renderLink={routerLink}
        />
      ))}
    </RowGroup>
  );
}

/**
 * Beziehungsnetz (AK-01: Funktionen und Gesprächspaare, keine Haltung je Person, E-K0-21): die
 * Kontaktpunkte (PLB-06) und die Formate der Spielregeln ohne Gesprächspaar. Geteilte Paare sieht
 * das Gegenüber auch; sie tragen den Chip „geteilt“.
 */
function Network({
  query,
  relationshipId,
  name,
}: {
  query: UseQueryResult<TouchpointList>;
  relationshipId: string;
  name: string;
}) {
  const t = useT();
  const all = useMessages(aktePrivateMessages);
  const text = all.network;
  const { locale } = useLocale();
  const base = oldPage(relationshipId, '/beziehung/kontaktpunkte');
  const data = query.data;
  return (
    <div className="flex flex-col gap-2">
      <RowGroup id="netz" label={text.label}>
        {query.isError ? (
          <Row title={all.failed} />
        ) : !data ? (
          <Row title={all.loading} />
        ) : data.touchpoints.length === 0 && data.gaps.length === 0 ? (
          <Row
            href={data.canEdit ? `${base}/neu` : base}
            title={text.empty}
            detail={text.emptyText(name)}
            wrap
            renderLink={routerLink}
          />
        ) : (
          <>
            {data.touchpoints.map((touchpoint) => (
              <Row
                key={touchpoint.id}
                href={`${base}/${touchpoint.id}`}
                title={touchpoint.format}
                detail={[
                  text.pair(touchpoint.buyerName, touchpoint.supplierName),
                  t.touchpoints.cadences[touchpoint.cadence],
                  touchpoint.notes,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                value={
                  touchpoint.visibility === 'shared' ? (
                    <Badge variant="shared">{text.shared}</Badge>
                  ) : undefined
                }
                wrap
                renderLink={routerLink}
              />
            ))}
            {data.gaps.map((gap) => (
              <Row
                key={`luecke-${gap.title.de}`}
                href={base}
                title={gap.title[locale]}
                detail={text.gap}
                value={<Badge variant="warning">{text.gapChip}</Badge>}
                wrap
                renderLink={routerLink}
              />
            ))}
          </>
        )}
      </RowGroup>
      {data && <p className="px-1 text-muted-foreground text-sm">{text.footnote(name)}</p>}
    </div>
  );
}

/** Segment und Bewertung (T2-I13): Segment mit Abstand zur Grenze, Runde, Kriterien und Spanne */
function Segment({
  query,
  relationshipId,
  name,
}: {
  query: UseQueryResult<Segmentation>;
  relationshipId: string;
  name: string;
}) {
  const all = useMessages(aktePrivateMessages);
  const text = all.segment;
  const format = useFormat();
  const number = useNumber();
  if (denied(query.error)) return null;
  const href = oldPage(relationshipId, '/strategie/segmentierung');
  const facts = query.data ? segmentFacts(query.data.segmentation) : undefined;
  const widest = facts?.criteria.reduce<(typeof facts.criteria)[number] | null>(
    (max, criterion) => (max === null || criterion.spread > max.spread ? criterion : max),
    null,
  );
  const line = (axis: 'impact' | 'quality') =>
    (facts?.criteria ?? [])
      .filter((criterion) => criterion.axis === axis)
      .map((criterion) => `${criterion.name} ${number(criterion.mean)}`)
      .join(' · ');
  return (
    <RowGroup id="segment" label={text.label}>
      {query.isError ? (
        <Row title={all.failed} />
      ) : facts === undefined ? (
        <Row title={all.loading} />
      ) : facts === null ? (
        <Row
          href={href}
          title={text.none}
          detail={text.noneText(name)}
          wrap
          renderLink={routerLink}
        />
      ) : (
        <>
          <Row
            href={href}
            title={text.title(
              facts.name,
              facts.distance === null
                ? null
                : all.summary.points(number(facts.distance), facts.distance === 1),
            )}
            detail={[
              `${facts.roundName}, ${text.ratings(facts.ratings)}`,
              facts.decidedAt ? text.decided(format.date(facts.decidedAt)) : text.provisional,
            ].join(' · ')}
            value={
              facts.close ? (
                <Badge variant="warning">{text.close}</Badge>
              ) : facts.provisional ? (
                <Badge variant="neutral">{text.provisional}</Badge>
              ) : undefined
            }
            wrap
            renderLink={routerLink}
          />
          {facts.criteria.length > 0 && (
            <Row
              title={line('quality') || line('impact')}
              detail={[
                line('quality') ? line('impact') : null,
                widest && widest.spread > 0
                  ? text.spread(number(widest.spread), widest.name)
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              wrap
            />
          )}
        </>
      )}
    </RowGroup>
  );
}

/** Lieferantenplan (T2-I23): Version und Freigabe, Themen fürs JBP, Ziele, die intern bleiben */
function Plan({ relationshipId }: { relationshipId: string }) {
  const all = useMessages(aktePrivateMessages);
  const text = all.plan;
  const format = useFormat();
  const accessToken = useToken();
  const query = useQuery({
    ...supplierPlanQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  if (denied(query.error)) return null;
  const href = oldPage(relationshipId, '/strategie/lieferantenplan');
  const plan = query.data?.plan;
  const facts = plan ? planFacts(plan) : null;
  return (
    <RowGroup id="plan" label={text.label}>
      {query.isError ? (
        <Row title={all.failed} />
      ) : !query.data ? (
        <Row title={all.loading} />
      ) : !plan || !facts ? (
        <Row href={href} title={text.none} detail={text.noneText} wrap renderLink={routerLink} />
      ) : (
        <>
          <Row
            href={href}
            title={text.version(plan.version, text.statuses[plan.status])}
            detail={[
              facts.approvedBy && facts.approvedAt
                ? text.approved(facts.approvedBy, format.date(facts.approvedAt))
                : null,
              plan.contributions.total > 0
                ? text.contributions(plan.contributions.done, plan.contributions.total)
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            value={
              plan.status === 'approved' ? (
                <Badge variant="success">{text.current}</Badge>
              ) : undefined
            }
            wrap
            renderLink={routerLink}
          />
          {facts.topics.length > 0 && (
            <Row title={text.topics(facts.topics.length)} detail={facts.topics.join(' · ')} wrap />
          )}
          {facts.internal.length > 0 && (
            <Row
              title={text.internal(facts.internal.length)}
              detail={facts.internal.slice(0, 3).join(' · ')}
              wrap
            />
          )}
        </>
      )}
    </RowGroup>
  );
}

/** Stärke der Beziehung aus dem Segment Ist; bei 2 × 2 gibt es nur schwach und stark */
function qualityIndex(level: number, gridSize: 2 | 3): number {
  if (gridSize === 2) return level <= 1 ? 0 : 2;
  return level - 1;
}

/**
 * Warengruppen (T2-I12, Bestand nach G-9): je Warengruppe Spend, Lead, Stärke, Absicht und Stand
 * der Strategie; ein offener Widerspruch (WG-20) trägt den Chip „widerspricht“
 */
function Categories({ relationshipId, gridSize }: { relationshipId: string; gridSize: 2 | 3 }) {
  const t = useT();
  const words = t.supplierCategories;
  const all = useMessages(aktePrivateMessages);
  const text = all.groups;
  const format = useFormat();
  const accessToken = useToken();
  const query = useQuery({
    ...supplierCategoriesQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  if (denied(query.error)) return null;
  const href = oldPage(relationshipId, '/strategie/warengruppen');
  const data = query.data;
  return (
    <RowGroup id="warengruppen" label={text.label}>
      {query.isError ? (
        <Row title={all.failed} />
      ) : !data ? (
        <Row title={all.loading} />
      ) : data.rows.length === 0 ? (
        <Row title={text.none} />
      ) : (
        data.rows.map((row) => {
          const spend =
            row.amountCents > 0
              ? format.money(
                  { amountCents: row.amountCents, currency: data.currency },
                  { compact: true },
                )
              : null;
          const intent =
            row.sollType?.kind === 'ended'
              ? text.ended
              : row.sollType && row.segmentIst
                ? row.sollType.qualityLevel > row.segmentIst.qualityLevel
                  ? text.up
                  : row.sollType.qualityLevel < row.segmentIst.qualityLevel
                    ? text.down
                    : null
                : null;
          const conflict = data.conflicts.some(
            (entry) =>
              entry.status === 'open' && entry.groups.some((group) => group.id === row.groupId),
          );
          return (
            <Row
              key={row.groupId}
              href={href}
              title={text.title(row.groupName, spend)}
              detail={[
                row.lead ? words.lead(row.lead.name) : words.noLead,
                row.qualityLevel ? words.qualities[qualityIndex(row.qualityLevel, gridSize)] : null,
                intent,
                row.strategy ? text.strategy(words.states[row.strategy.status] ?? '') : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              value={conflict ? <Badge variant="warning">{text.conflict}</Badge> : undefined}
              wrap
              renderLink={routerLink}
            />
          );
        })
      )}
    </RowGroup>
  );
}

/**
 * Wert (Wertkonto-Zeile, T2-I06): gesicherte EBIT-Wirkung des Jahres gegen das Ziel (AW-01) und
 * Potenzial nur als EBIT (KI-11). Ohne Recht auf Wirkung fehlt der Abschnitt.
 */
function Value({ relationshipId }: { relationshipId: string }) {
  const all = useMessages(aktePrivateMessages);
  const text = all.value;
  const format = useFormat();
  const accessToken = useToken();
  const enabled = accessToken !== '';
  const secured = useQuery({ ...securedResultsQueryOptions(accessToken, relationshipId), enabled });
  const opportunities = useQuery({
    ...valueOpportunitiesQueryOptions(accessToken, relationshipId),
    enabled,
  });
  if (denied(secured.error)) return null;
  const data = secured.data;
  const money = (cents: number) =>
    format.money({ amountCents: cents, currency: data?.currency ?? 'EUR' }, { compact: true });
  const potential = opportunities.data ? ebitPotential(opportunities.data.totals) : null;
  const counts = opportunities.data?.counts;
  return (
    <RowGroup label={text.label}>
      {secured.isError ? (
        <Row title={all.failed} />
      ) : !data ? (
        <Row title={all.loading} />
      ) : (
        <>
          <Row
            href={oldPage(relationshipId, '/wirkung/bruecke')}
            title={text.results(data.fiscalYear)}
            detail={[
              data.securedEbitCents > 0 || data.target
                ? text.secured(
                    money(data.securedEbitCents),
                    data.target ? money(data.target.ebitTargetCents) : null,
                  )
                : text.nothing,
              potential ? text.potential(money(potential.low), money(potential.high)) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            wrap
            renderLink={routerLink}
          />
          {/* K2-c.7 (E-K2-12): Ziel vorschlagen und freigeben hat bis K4-c nur der bisherige
              Überblick (Zielkarte, AW-01); ein freigegebenes Ziel steht schon in der Zeile oben */}
          {!data.target?.approved && (
            <Row
              href={oldPage(relationshipId, '')}
              title={text.target(data.fiscalYear)}
              detail={
                data.target
                  ? text.targetProposed(money(data.target.ebitTargetCents))
                  : text.targetMissing
              }
              wrap
              renderLink={routerLink}
            />
          )}
          {counts && counts.new + counts.adopted > 0 && (
            <Row
              href={oldPage(relationshipId, '/wirkung/wertpotenziale')}
              title={text.opportunities}
              detail={text.opportunitiesDetail(counts.new, counts.adopted)}
              wrap
              renderLink={routerLink}
            />
          )}
        </>
      )}
    </RowGroup>
  );
}
