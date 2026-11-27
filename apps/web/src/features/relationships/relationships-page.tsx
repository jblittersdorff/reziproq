import {
  displayNameOf,
  type RelationshipFilters,
  type RelationshipRow,
  type RelationshipsResponse,
  type RelationshipsSummary,
} from '@reziproq/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { FactoryIcon, LockIcon } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FilterChips } from '@/components/ui/filter-chips';
import { LoadingState } from '@/components/ui/loading-state';
import { MiniMirror } from '@/components/ui/mini-mirror';
import { Monogram } from '@/components/ui/monogram';
import { NativeSelect } from '@/components/ui/native-select';
import { PageTitle } from '@/components/ui/page-title';
import { Row, RowGroup, RowHead, RowHeads } from '@/components/ui/row-group';
import { SoWhat } from '@/components/ui/so-what';
import { Switch } from '@/components/ui/switch';
import { useMe } from '@/features/auth/use-me';
import { useCan } from '@/features/auth/use-permissions';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { useDocumentTitle } from '@/features/shell/page-header';
import { NextActionCard } from '@/features/start/next-action';
import {
  ApiError,
  doneQueryOptions,
  relationshipsNextQueryOptions,
  relationshipsQueryOptions,
} from '@/lib/api';
import { type Format, useFormat } from '@/lib/format';
import { useMessages, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { Messages } from '@/locales/de';
import {
  type ChipValue,
  chipCounts,
  chipRows,
  firstRows,
  moreFilterCount,
  moreFiltered,
  type RelationshipSearch,
  sortedRows,
  spendTotals,
  topSegmentKey,
} from './relationship-view';
import { RelationshipLenses, segmentsHref } from './lenses';
import { relationshipsMessages } from './relationships-messages';

type Text = (typeof relationshipsMessages)['de'];

/** Beträge wie in der Vorlage: „4,2 Mio. €“, „3,15 Mio. €“ */
const spendOf = (format: Format, spend: RelationshipRow['spend']) =>
  spend ? format.money(spend, { compact: true, fractionDigits: 2 }) : null;

/**
 * Seite Lieferanten, Linse Liste (BZ-01, K2-b.4, nach Vorlage Lieferanten und A-Lieferanten): Kopf
 * mit Zahl, Spend und Portfolio; Als Nächstes über alle Beziehungen; Das Wichtigste; Filter-Chips,
 * „Mehr Filter“ und Sortierung in der Adresse; Zeilen mit Monogramm, grauer Zeile, Segment-Chip und
 * Mini-Spiegel der Zusagequoten (ZQ-01). Gestrichen nach BZ-01: Gruppen „Brauchen dich“ und „Laufen
 * gut“, Ampelpunkt, Detailleiste und eigene Suche (Frag Reziproq übernimmt).
 */
export function RelationshipsPage() {
  const t = useT();
  const text = useMessages(relationshipsMessages);
  const format = useFormat();
  const accessToken = useToken();
  const me = useMe();
  const search = useSearch({ from: '/_app/beziehungen/' });
  const navigate = useNavigate({ from: '/beziehungen/' });
  const canEdit = useCan('lieferanten.bearbeiten');
  const allowed = me.data?.permissions.viewSuppliers === true;
  const enabled = accessToken !== '' && allowed;
  useDocumentTitle(t.suppliers.title);
  const list = useQuery({
    ...relationshipsQueryOptions(accessToken, {
      portfolio: search.portfolio === 1,
      ended: search.beendet === 1,
    }),
    enabled,
    // Beim Umschalten von Portfolio oder Beendete bleibt die Liste stehen, statt kurz zu laden
    placeholderData: keepPreviousData,
  });
  const next = useQuery({ ...relationshipsNextQueryOptions(accessToken), enabled });
  const done = useQuery({ ...doneQueryOptions(accessToken), enabled });
  // Filter und Sortierung ersetzen den Eintrag im Verlauf, statt für jeden Klick einen anzulegen
  const update = (patch: Partial<RelationshipSearch>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  const header = (where?: ReactNode) => (
    <div className="flex flex-col gap-5.5">
      <PageTitle title={t.suppliers.title} where={where} />
      <RelationshipLenses active="liste" />
    </div>
  );

  // Ohne Organisation steht der Hinweis schon über jeder Seite (App-Rahmen)
  if (me.data && !me.data.organization) return header();
  const denied =
    (me.data && !allowed) ||
    (list.error instanceof ApiError && list.error.code === 'keine_berechtigung');
  if (denied) {
    return (
      <div className="flex flex-col gap-5.5">
        {header()}
        <EmptyState
          size="lg"
          icon={<LockIcon aria-hidden />}
          title={t.suppliers.noPermissionTitle}
          description={t.suppliers.noPermissionDescription}
        />
      </div>
    );
  }
  if (list.isError || me.isError) {
    return (
      <div className="flex flex-col gap-5.5">
        {header()}
        <ErrorState title={t.suppliers.failed} />
      </div>
    );
  }
  const data = list.data;
  if (!data) {
    return (
      <div className="flex flex-col gap-5.5">
        {header()}
        <LoadingState label={t.suppliers.loading} />
      </div>
    );
  }

  const headSpend = data.head.spend[0] ? spendOf(format, data.head.spend[0]) : null;
  const where = (
    <>
      <span className="hidden shell:inline">
        {text.head(data.head.active, headSpend, data.year, data.head.portfolio)}
      </span>
      <span className="shell:hidden">{text.headPhone(data.head.active, headSpend)}</span>
    </>
  );

  if (data.head.portfolio === 0 && data.rows.length === 0) {
    return (
      <div className="flex flex-col gap-5.5">
        {header(where)}
        <EmptyState
          size="lg"
          icon={<FactoryIcon aria-hidden />}
          title={t.suppliers.emptyTitle}
          description={t.suppliers.emptyDescription}
        />
        <Tools canEdit={canEdit} text={text} />
      </div>
    );
  }

  const chip: ChipValue = search.filter ?? 'alle';
  const filtered = moreFiltered(data.rows, search, data.filters.materialGroups);
  const counts = chipCounts(filtered);
  const rows = sortedRows(chipRows(filtered, chip), search.sortierung ?? 'aufmerksamkeit');
  // Im Hintergrund (Vorlage): zugeordnete Mails seit gestern 18:00, aus Erledigt
  const since = done.data ? Date.parse(done.data.since) : Number.POSITIVE_INFINITY;
  const mails = (done.data?.rows ?? []).filter(
    (row) => row.action === 'mail_assign' && row.status === 'done' && Date.parse(row.at) >= since,
  ).length;

  return (
    <div className="flex flex-col gap-5.5">
      {header(where)}
      {/* Vorlage Lieferanten: Arbeit links, Kontext rechts in einer schmalen Spalte (rund 300 px) */}
      <div className="grid gap-5.5 wide:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-5.5">
          <NextActionCard next={next.data?.next} />
          <ListSummary summary={data.summary} text={text} format={format} />
          <ListControls
            search={search}
            update={update}
            counts={counts}
            data={data}
            text={text}
            t={t}
          />
          {rows.length === 0 ? (
            <p role="status" className="px-1 text-base text-muted-foreground">
              {text.noMatch}
            </p>
          ) : (
            <RelationshipRows
              rows={rows}
              filters={data.filters}
              group={data.filters.materialGroups.find((entry) => entry.id === search.wg) ?? null}
              text={text}
              t={t}
              format={format}
              // Mit Filter oder anderer Sortierung neu zählen: alle zeigen, die passen
              key={`${chip}-${search.sortierung ?? ''}-${moreFilterCount(search)}`}
            />
          )}
          <p className="px-1 text-muted-foreground text-sm">
            <span className="hidden shell:inline">{text.footnote(data.year)}</span>
            <span className="shell:hidden">{text.footnotePhone}</span>
          </p>
        </div>
        <aside className="flex min-w-0 flex-col gap-5.5">
          {mails > 0 && (
            <RowGroup label={text.aside.background}>
              <Row
                href="/erledigt"
                title={text.aside.mails(mails)}
                detail={text.aside.mailsSub}
                renderLink={routerLink}
              />
            </RowGroup>
          )}
          <Tools canEdit={canEdit} text={text} />
        </aside>
      </div>
    </div>
  );
}

/** Importieren und von Hand anlegen (PLT-03b), als Zeilen in einer Gruppe (Vorlage: Import) */
function Tools({ canEdit, text }: { canEdit: boolean; text: Text }) {
  return (
    <RowGroup label={text.aside.tools}>
      <Row
        href="/lieferanten/importieren"
        title={text.aside.import}
        detail={text.aside.importSub}
        renderLink={routerLink}
      />
      {canEdit && (
        <Row
          href="/lieferanten/neu"
          title={text.aside.add}
          detail={text.aside.addSub}
          renderLink={routerLink}
        />
      )}
    </RowGroup>
  );
}

/**
 * Das Wichtigste (Vorlage Lieferanten): ein Satz aus belegten Zahlen der API (G-6) und bis zu
 * drei Zeilen Hakt, Fehlt, Info. Ohne Aussage und ohne Zeile entfällt die Gruppe.
 */
function ListSummary({
  summary,
  text,
  format,
}: {
  summary: RelationshipsSummary;
  text: Text;
  format: Format;
}) {
  const sentence = [
    summary.keptBetter > 0 ? text.summary.keptBetter(summary.keptBetter) : null,
    summary.unrated
      ? summary.unrated.largest
        ? text.summary.unratedLargest(displayNameOf(summary.unrated.name).name)
        : text.summary.unrated(displayNameOf(summary.unrated.name).name)
      : null,
  ]
    .filter(Boolean)
    .join(' ');
  if (!sentence && summary.rows.length === 0) return null;
  const sources = [
    summary.keptBetter > 0 || summary.rows.some((row) => row.kind !== 'unrated')
      ? text.summary.sources.commitments
      : null,
    summary.rows.some((row) => row.kind === 'counterpart_low' && row.hint)
      ? text.summary.sources.hints
      : null,
    summary.unrated ? text.summary.sources.segments : null,
  ].filter((source): source is string => source !== null);
  return (
    <section aria-label={text.summary.label}>
      <SoWhat
        heading={text.summary.heading}
        statement={sentence}
        sources={sources}
        renderLink={routerLink}
      >
        {summary.rows.length > 0 && (
          <div className="flex flex-col divide-y divide-row-line overflow-hidden rounded-md border border-row-line">
            {summary.rows.map((row) => {
              const base = `/lieferanten/${row.relationshipId}`;
              switch (row.kind) {
                case 'counterpart_low': {
                  const what = row.hint?.metric
                    ? `${row.hint.metric} ${row.hint.value ?? ''}`.trim()
                    : (row.hint?.title ?? null);
                  return (
                    <Row
                      key={row.kind}
                      href={row.hint ? `/warum/${row.hint.id}` : base}
                      title={text.summary.counterpartLow(
                        displayNameOf(row.name).name,
                        row.kept,
                        row.due,
                      )}
                      detail={
                        what
                          ? text.summary.hintLine(what, row.hint?.status === 'in_progress')
                          : text.summary.noHint
                      }
                      value={<Badge variant="warning">{text.summary.chips.counterpart_low}</Badge>}
                      renderLink={routerLink}
                    />
                  );
                }
                case 'unrated':
                  return (
                    <Row
                      key={row.kind}
                      href={segmentsHref}
                      title={text.summary.unratedRow(displayNameOf(row.name).name)}
                      detail={spendOf(format, row.spend) ?? undefined}
                      value={<Badge variant="warning">{text.summary.chips.unrated}</Badge>}
                      renderLink={routerLink}
                    />
                  );
                case 'quota_gap':
                  return (
                    <Row
                      key={row.kind}
                      href={base}
                      title={text.summary.quotaGap(
                        displayNameOf(row.name).name,
                        row.own,
                        row.counterpart,
                      )}
                      detail={
                        row.overdue
                          ? text.summary.overdue(row.overdue.count, row.overdue.title)
                          : text.summary.noOverdue
                      }
                      value={<Badge variant="neutral">{text.summary.chips.quota_gap}</Badge>}
                      renderLink={routerLink}
                    />
                  );
                default:
                  return null;
              }
            })}
          </div>
        )}
      </SoWhat>
    </section>
  );
}

/** Filter-Chips, „Mehr Filter“ und Sortierung (Vorlage: „sortiert nach Aufmerksamkeit“) */
function ListControls({
  search,
  update,
  counts,
  data,
  text,
  t,
}: {
  search: RelationshipSearch;
  update: (patch: Partial<RelationshipSearch>) => void;
  counts: Record<ChipValue, number>;
  data: RelationshipsResponse;
  text: Text;
  t: Messages;
}) {
  const moreId = useId();
  const sortId = useId();
  const active = moreFilterCount(search);
  // Offen, solange ein Filter darunter gesetzt ist oder die Person ihn geöffnet hat
  const [open, setOpen] = useState(active > 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <FilterChips<ChipValue>
          label={text.chips.label}
          value={search.filter ?? 'alle'}
          onChange={(value) => update({ filter: value === 'alle' ? undefined : value })}
          options={[
            { value: 'alle', label: text.chips.all, count: counts.alle },
            { value: 'meine', label: text.chips.mine, count: counts.meine },
            { value: 'strategisch', label: text.chips.focus, count: counts.strategisch },
            { value: 'offene-zusagen', label: text.chips.open, count: counts['offene-zusagen'] },
          ]}
          more={{
            label: text.chips.more,
            expanded: open,
            active,
            onToggle: () => setOpen(!open),
            controls: moreId,
          }}
        />
        <div className="ml-auto flex items-center">
          <label htmlFor={sortId} className="sr-only">
            {text.sort.label}
          </label>
          <NativeSelect
            id={sortId}
            value={search.sortierung ?? 'aufmerksamkeit'}
            onChange={(event) =>
              update({ sortierung: event.target.value === 'spend' ? 'spend' : undefined })
            }
            className="h-11 rounded-full pl-4"
          >
            <option value="aufmerksamkeit">{text.sort.attention}</option>
            <option value="spend">{text.sort.spend}</option>
          </NativeSelect>
        </div>
      </div>
      {open && (
        <MoreFilters
          id={moreId}
          search={search}
          update={update}
          filters={data.filters}
          drafts={data.head.portfolio - data.head.active}
          text={text}
          t={t}
        />
      )}
    </div>
  );
}

/** „Mehr Filter“: Portfolio (E-K2-10), Beendete (PLT-03), Segment, Soll-Typ, Warengruppe, Business Unit */
function MoreFilters({
  id,
  search,
  update,
  filters,
  drafts,
  text,
  t,
}: {
  id: string;
  search: RelationshipSearch;
  update: (patch: Partial<RelationshipSearch>) => void;
  filters: RelationshipFilters;
  drafts: number;
  text: Text;
  t: Messages;
}) {
  const portfolioId = useId();
  const endedId = useId();
  const segmentId = useId();
  const typeId = useId();
  const groupId = useId();
  const unitId = useId();
  const selects: {
    id: string;
    key: 'segment' | 'typ' | 'wg' | 'bu';
    label: string;
    options: { value: string; label: string }[];
  }[] = [
    {
      id: segmentId,
      key: 'segment',
      label: text.more.segment,
      options: [
        ...filters.targetTypes.map((type) => ({ value: type.key, label: type.name })),
        { value: 'ohne', label: text.more.unrated },
        { value: 'strittig', label: text.more.disputed },
      ],
    },
    {
      id: typeId,
      key: 'typ',
      label: t.suppliers.filters.targetType,
      options: filters.targetTypes.map((type) => ({ value: type.key, label: type.name })),
    },
    {
      id: groupId,
      key: 'wg',
      label: t.suppliers.filters.materialGroup,
      options: filters.materialGroups.map((group) => ({
        value: group.id,
        label: group.parentId ? `– ${group.name}` : group.name,
      })),
    },
    {
      id: unitId,
      key: 'bu',
      label: t.suppliers.filters.businessUnit,
      options: filters.businessUnits.map((unit) => ({ value: unit.id, label: unit.name })),
    },
  ];
  return (
    <fieldset
      id={id}
      className="m-0 flex min-w-0 flex-col gap-4 rounded-lg border-0 bg-card p-4 shell:p-5"
    >
      <legend className="sr-only">{text.more.label}</legend>
      <div className="flex flex-col gap-3">
        {drafts > 0 && (
          <div className="flex min-h-11 items-center gap-3">
            <Switch
              id={portfolioId}
              checked={search.portfolio === 1}
              onCheckedChange={(checked) => update({ portfolio: checked ? 1 : undefined })}
            />
            <label htmlFor={portfolioId} className="text-base">
              {text.more.portfolio(drafts)}
            </label>
          </div>
        )}
        <div className="flex min-h-11 items-center gap-3">
          <Switch
            id={endedId}
            checked={search.beendet === 1}
            onCheckedChange={(checked) => update({ beendet: checked ? 1 : undefined })}
          />
          <label htmlFor={endedId} className="text-base">
            {t.suppliers.showEnded}
          </label>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {selects.map((select) => (
          <div key={select.key} className="flex min-w-0 flex-col gap-1">
            <label htmlFor={select.id} className="text-muted-foreground text-sm">
              {select.label}
            </label>
            <NativeSelect
              id={select.id}
              value={search[select.key] ?? ''}
              onChange={(event) => update({ [select.key]: event.target.value || undefined })}
              className="h-11 rounded-full pl-4"
            >
              <option value="">{t.suppliers.filters.all}</option>
              {select.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        ))}
      </div>
      {moreFilterCount(search) > 0 && (
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          onClick={() =>
            update({
              portfolio: undefined,
              beendet: undefined,
              segment: undefined,
              typ: undefined,
              wg: undefined,
              bu: undefined,
            })
          }
        >
          {t.suppliers.filters.reset}
        </Button>
      )}
    </fieldset>
  );
}

/**
 * Zeilen der Liste: die ersten acht, darunter „N weitere Beziehungen“ mit Namen und Spend; ein
 * Klick zeigt alle (Designsprache Regel 13: eingeklappt, was die Entscheidung nicht braucht).
 */
function RelationshipRows({
  rows,
  filters,
  group,
  text,
  t,
  format,
}: {
  rows: RelationshipRow[];
  filters: RelationshipFilters;
  /** WG-18: gefilterte Warengruppe; der Chip zeigt dann das Segment dort */
  group: { id: string; name: string } | null;
  text: Text;
  t: Messages;
  format: Format;
}) {
  const [all, setAll] = useState(rows.length <= firstRows + 1);
  const top = topSegmentKey(filters);
  const shown = all ? rows : rows.slice(0, firstRows);
  const rest = rows.slice(firstRows);
  const restSpend = spendTotals(rest)[0];
  return (
    <div data-slot="relationship-rows" className="flex flex-col gap-2">
      <RowHeads>
        <RowHead className="flex-1">{text.heads.relationship}</RowHead>
        <RowHead>
          {group ? t.suppliers.list.columnSegmentIn(group.name) : text.heads.segment}
        </RowHead>
        <RowHead className="w-50 text-center">{text.heads.quota}</RowHead>
        <span className="w-4" />
      </RowHeads>
      <RowGroup>
        {shown.map((row) => (
          <RelationshipLine
            key={row.relationshipId}
            row={row}
            top={top}
            group={group}
            text={text}
            t={t}
            format={format}
          />
        ))}
        {!all && rest.length > 0 && (
          <Row
            href="#weitere"
            title={text.rest.title(rest.length)}
            detail={text.rest.names(
              rest.slice(0, 3).map((row) => displayNameOf(row.name).name),
              Math.max(0, rest.length - 3),
              restSpend ? spendOf(format, restSpend) : null,
            )}
            renderLink={({ className, children }) => (
              <button
                type="button"
                aria-expanded={false}
                className={cn(className, 'w-full cursor-pointer border-0 bg-transparent text-left')}
                onClick={() => setAll(true)}
              >
                {children}
              </button>
            )}
          />
        )}
      </RowGroup>
    </div>
  );
}

/** Eine Zeile: Monogramm Petrol, Name, graue Zeile, Segment-Chip, Mini-Spiegel (ZQ-01) */
function RelationshipLine({
  row,
  top,
  group,
  text,
  t,
  format,
}: {
  row: RelationshipRow;
  top: string | null;
  group: { id: string; name: string } | null;
  text: Text;
  t: Messages;
  format: Format;
}) {
  // LS-01: Anzeigename ohne Rechtsform; „(Demo)“ wird zum Kennzeichen
  const shown = displayNameOf(row.name);
  // WG-18: mit Filter Warengruppe das Segment dort, sonst das gesamte
  const segment = group
    ? (row.categorySegments.find((entry) => entry.materialGroupId === group.id) ?? null)
    : row.segment;
  const reason = reasonText(row, text, t);
  const spend = spendOf(format, row.spend);
  const desktop = [
    row.materialGroup,
    row.country ? format.country(row.country) : null,
    spend,
    row.status === 'draft' ? text.row.draft : null,
    row.status === 'ended' ? text.row.ended : null,
    reason,
  ].filter(Boolean);
  // Telefon (Vorlage A-Lieferanten): Segment und Grund, ohne Bewertung statt Grund der Spend
  const phone = row.disputed
    ? [text.row.disputed]
    : [
        segment?.name ?? text.row.chipUnrated,
        row.reason && row.reason.kind !== 'unrated' ? reason : spend,
      ].filter(Boolean);
  const chip =
    row.disputed && !group ? (
      <Badge variant="warning">{text.row.chipDisputed}</Badge>
    ) : segment ? (
      <Badge variant={segment.key === top ? 'shared' : 'neutral'}>{segment.name}</Badge>
    ) : (
      <Badge variant="neutral">{text.row.chipUnrated}</Badge>
    );
  const mirror = (size: 'md' | 'sm') =>
    row.quota ? (
      <MiniMirror
        size={size}
        own={row.quota.own.percent}
        counterpart={row.quota.counterpart.percent}
        label={text.row.mirror(row.quota.own.percent, row.quota.counterpart.percent, shown.name)}
      />
    ) : null;
  return (
    <Row
      href={`/lieferanten/${row.relationshipId}`}
      lead={<Monogram name={shown.name} tone="petrol" />}
      title={
        shown.demo ? (
          <>
            {shown.name} <Badge variant="neutral">{t.suppliers.list.demo}</Badge>
          </>
        ) : (
          shown.name
        )
      }
      detail={
        <>
          <span className="hidden shell:inline">{desktop.join(' · ')}</span>
          <span className="shell:hidden">{phone.join(' · ')}</span>
        </>
      }
      value={
        <>
          <span className="hidden items-center gap-4 shell:flex">
            {chip}
            {mirror('md') ?? (
              <span className="w-50 text-center text-muted-foreground text-sm">
                {text.row.noCommitments}
              </span>
            )}
          </span>
          <span className="flex shell:hidden">{mirror('sm')}</span>
        </>
      }
      renderLink={routerLink}
    />
  );
}

/** Der wichtigste Grund als Text der grauen Zeile */
function reasonText(row: RelationshipRow, text: Text, t: Messages): string | null {
  const reason = row.reason;
  if (!reason) return null;
  switch (reason.kind) {
    case 'overdue':
      return text.row.overdue(reason.count);
    case 'disputed':
      return text.row.disputed;
    case 'unrated':
      return text.row.unrated;
    case 'hint': {
      const { metric, value, ruleKey, title } = reason.hint;
      if (metric && value) return `${metric} ${value}`;
      return t.hints.rules[ruleKey as keyof Messages['hints']['rules']] ?? title ?? ruleKey;
    }
  }
}
