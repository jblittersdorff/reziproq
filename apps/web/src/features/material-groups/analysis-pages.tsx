import {
  type AnalysisComputed,
  type AnalysisStep,
  type AnalysisViewKey,
  analysisViewQuestionKey,
  type StrategyContext,
  type StrategyStep,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { GuideQuestions } from '@/components/ui/guide-questions';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { RowsEditor, type RowsEditorColumn } from '@/components/ui/rows-editor';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ShareRows } from '@/components/ui/share-rows';
import { StatusLine } from '@/components/ui/status-line';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import {
  ApiError,
  addCandidate,
  analysisStepQueryOptions,
  candidateToSupplier,
  removeCandidate,
  saveAnalysis,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import type { Messages } from '@/locales/de';
import { CategorySegmentsCard, segmentationPagePath } from './segmentation-pages';
import { NoteForm } from './strategy-pages';
import { ViewTeamPanel } from './view-team';

type Row = Record<string, string>;
type Text = Messages['analysis'];
type Data = Record<string, unknown>;

const list = (data: Data, key: string) => (Array.isArray(data[key]) ? (data[key] as Data[]) : []);
const str = (value: unknown) => (value === null || value === undefined ? '' : String(value));
/** Zahl in der Schreibweise der Sprache, z. B. 98,5 */
const localNumber = (value: unknown, locale: string) =>
  typeof value === 'number' ? new Intl.NumberFormat(locale).format(value) : str(value);
/** Monat 2027-08 als 08/2027 */
const localMonth = (value: unknown) => {
  const [year, month] = str(value).split('-');
  return year && month ? `${month}/${year}` : str(value);
};
const num = (value: string) => (value.trim() === '' ? null : Number(value.replace(',', '.')));
const filled = (row: Row) => Object.values(row).some((value) => value.trim() !== '');

interface ListSpec {
  key: string;
  legend: string;
  columns: RowsEditorColumn[];
  toRows: (data: Data) => Row[];
  fromRows: (rows: Row[]) => unknown[];
}

/** Welche Listen eine Sicht pflegt; Umsatzwerte sind nie dabei (sie kommen aus dem Spend). */
function listsOf(view: AnalysisViewKey, text: Text, step: AnalysisStep): ListSpec[] {
  const supplierOptions = step.suppliers.map((entry) => ({
    value: entry.relationshipId,
    label: entry.name,
  }));
  const simple = (key: string, legend: string): ListSpec => ({
    key,
    legend,
    columns: [{ key: 'value', label: text.volume.entry, span: 3 }],
    toRows: (data) => list(data, key).map((value) => ({ value: str(value) })),
    fromRows: (rows) => rows.map((row) => row.value?.trim() ?? ''),
  });
  const plain = (
    key: string,
    legend: string,
    columns: RowsEditorColumn[],
    numbers: string[] = [],
  ): ListSpec => ({
    key,
    legend,
    columns,
    toRows: (data) =>
      list(data, key).map((entry) =>
        Object.fromEntries(columns.map((column) => [column.key, str(entry[column.key])])),
      ),
    fromRows: (rows) =>
      rows.map((row) =>
        Object.fromEntries(
          columns.map((column) => [
            column.key,
            numbers.includes(column.key)
              ? num(row[column.key] ?? '')
              : (row[column.key] ?? '').trim(),
          ]),
        ),
      ),
  });
  switch (view) {
    case 'volume':
      return [
        simple('minRequirements', text.volume.minRequirements),
        simple('differentiators', text.volume.differentiators),
        {
          key: 'forecast',
          legend: text.volume.forecastRows,
          columns: [
            {
              key: 'businessUnitId',
              label: text.volume.unit,
              type: 'select',
              options: step.businessUnits.map((unit) => ({ value: unit.id, label: unit.name })),
            },
            { key: 'year', label: text.volume.year, type: 'number', span: 1 },
            { key: 'amount', label: text.volume.amount, type: 'number' },
          ],
          toRows: (data) =>
            list(data, 'forecast').map((entry) => ({
              businessUnitId: str(entry.businessUnitId),
              year: str(entry.year),
              amount: str(Number(entry.amountCents ?? 0) / 100),
            })),
          fromRows: (rows) =>
            rows.map((row) => ({
              businessUnitId: row.businessUnitId || null,
              year: num(row.year ?? ''),
              amountCents: Math.round((num(row.amount ?? '') ?? 0) * 100),
            })),
        },
      ];
    case 'supply_chain':
      return [
        plain(
          'stages',
          text.supply_chain.stages,
          [
            { key: 'name', label: text.supply_chain.stage },
            { key: 'description', label: text.supply_chain.description, span: 3 },
            { key: 'valueSharePct', label: text.supply_chain.share, type: 'number', span: 1 },
          ],
          ['valueSharePct'],
        ),
        plain(
          'countries',
          text.supply_chain.countries,
          [
            { key: 'country', label: text.supply_chain.country },
            { key: 'sharePct', label: text.supply_chain.countryShare, type: 'number' },
          ],
          ['sharePct'],
        ),
      ];
    case 'cost':
      return [
        plain(
          'costTypes',
          text.cost.title,
          [
            { key: 'name', label: text.cost.costType, span: 3 },
            { key: 'own', label: text.cost.own, type: 'number', span: 1 },
            { key: 'target', label: text.cost.target, type: 'number', span: 1 },
            { key: 'market', label: text.cost.market, type: 'number', span: 1 },
          ],
          ['own', 'target', 'market'],
        ),
      ];
    case 'technology':
      return [
        {
          key: 'technologies',
          legend: text.technology.title,
          columns: [
            { key: 'name', label: text.technology.name },
            { key: 'startsOn', label: text.technology.startsOn, type: 'month', span: 1 },
            { key: 'products', label: text.technology.products, span: 3 },
            { key: 'rampUp', label: text.technology.rampUp, span: 3 },
          ],
          toRows: (data) =>
            list(data, 'technologies').map((entry) => ({
              name: str(entry.name),
              startsOn: str(entry.startsOn),
              products: str(entry.products),
              rampUp: (Array.isArray(entry.rampUp) ? (entry.rampUp as Data[]) : [])
                .map((point) => `${str(point.year)} ${str(point.pct)}`)
                .join('; '),
            })),
          fromRows: (rows) =>
            rows.map((row) => ({
              name: (row.name ?? '').trim(),
              startsOn: row.startsOn ?? '',
              products: (row.products ?? '').trim(),
              rampUp: (row.rampUp ?? '')
                .split(';')
                .map((part) => part.trim().split(/\s+/))
                .filter((part) => part.length === 2)
                .map(([year, pct]) => ({ year: Number(year), pct: num(pct ?? '') ?? 0 })),
            })),
        },
      ];
    case 'revenue_finance':
      return [
        plain('stability', text.revenue_finance.byStability, [
          {
            key: 'relationshipId',
            label: text.revenue_finance.supplier,
            type: 'select',
            options: supplierOptions,
            span: 3,
          },
          {
            key: 'rating',
            label: text.revenue_finance.stability,
            type: 'select',
            options: (['ok', 'watch', 'critical'] as const).map((value) => ({
              value,
              label: text.revenue_finance.ratings[value] ?? value,
            })),
          },
        ]),
        plain(
          'callOff',
          text.revenue_finance.callOff,
          [
            {
              key: 'relationshipId',
              label: text.revenue_finance.supplier,
              type: 'select',
              options: supplierOptions,
              span: 3,
            },
            { key: 'year', label: text.revenue_finance.year, type: 'number', span: 1 },
            { key: 'deviationPct', label: text.revenue_finance.deviation, type: 'number' },
          ],
          ['year', 'deviationPct'],
        ),
      ];
    case 'quality':
      return [
        plain('ratings', text.quality.byRating, [
          {
            key: 'relationshipId',
            label: text.quality.supplier,
            type: 'select',
            options: supplierOptions,
            span: 3,
          },
          {
            key: 'rating',
            label: text.quality.rating,
            type: 'select',
            options: ['A', 'B', 'C'].map((value) => ({ value, label: value })),
          },
        ]),
        plain(
          'defects',
          text.quality.defects,
          [
            {
              key: 'relationshipId',
              label: text.quality.supplier,
              type: 'select',
              options: supplierOptions,
              span: 3,
            },
            { key: 'year', label: text.quality.year, type: 'number', span: 1 },
            { key: 'ppm', label: text.quality.ppm, type: 'number', span: 1 },
          ],
          ['year', 'ppm'],
        ),
        plain('audits', text.quality.audits, [
          { key: 'site', label: text.quality.site, span: 3 },
          { key: 'result', label: text.quality.result, span: 3 },
        ]),
      ];
    case 'footprint':
      return [
        plain(
          'recipients',
          text.footprint.recipients,
          [
            { key: 'country', label: text.footprint.country },
            { key: 'sharePct', label: text.footprint.share, type: 'number' },
          ],
          ['sharePct'],
        ),
      ];
  }
}

function usePercent() {
  const { locale } = useLocale();
  const format = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  return (share: number) => format.format(share);
}

/** Kurzfassung einer Sicht: ihr wichtigstes Ergebnis in einer Zeile (WG-07 Ablauf 3). */
function summaryOf(
  view: AnalysisViewKey,
  data: Data,
  computed: AnalysisComputed,
  text: Text,
  percent: (share: number) => string,
  country: (code: string | null) => string,
  locale: string,
): string {
  const first = (key: string) => list(data, key)[0];
  switch (view) {
    case 'volume': {
      const top = computed.productGroups[0];
      return top ? `${top.name || text.none} ${percent(top.share)}` : text.noData;
    }
    case 'supply_chain': {
      const stage = [...list(data, 'stages')].sort(
        (a, b) => Number(b.valueSharePct) - Number(a.valueSharePct),
      )[0];
      return stage ? `${str(stage.name)} ${str(stage.valueSharePct)} %` : text.noData;
    }
    case 'cost': {
      const row = first('costTypes');
      return row
        ? text.cost.summary(
            localNumber(row.own, locale) || '–',
            localNumber(row.target, locale) || '–',
            localNumber(row.market, locale) || '–',
          )
        : text.noData;
    }
    case 'technology': {
      const row = first('technologies');
      return row
        ? `${str(row.name)} ${text.technology.from(localMonth(row.startsOn))}`
        : text.noData;
    }
    case 'revenue_finance': {
      const top = computed.bySegment[0];
      return top
        ? `${top.name || text.revenue_finance.noSegment} ${percent(top.share)}`
        : text.noData;
    }
    case 'quality': {
      const top = computed.byQualityRating.find((entry) => entry.key !== 'none');
      return top ? `${text.quality.ratingName(top.name)} ${percent(top.share)}` : text.noData;
    }
    case 'footprint': {
      const top = computed.bySupplierCountry[0];
      return top
        ? `${country(top.key === 'none' ? null : top.key)} ${percent(top.share)}`
        : text.noData;
    }
  }
}

/**
 * Schritte 3 und 4 (WG-07, nach WG-Intern.dc.html und WG-Lieferanten.dc.html): Umschalter der
 * Sichten mit Stand, links das Ergebnis der gewählten Sicht, rechts Leitfragen und Beobachtung,
 * darunter die anderen Sichten als Kurzfassung.
 */
export function AnalysisSection({
  groupId,
  context,
  content,
  editable,
}: {
  groupId: string;
  context: StrategyContext;
  content: StrategyStep;
  editable: boolean;
}) {
  const all = useT();
  const text = all.analysis;
  const accessToken = useToken();
  const query = useQuery({
    ...analysisStepQueryOptions(accessToken, context.strategy.id, content.step),
    enabled: accessToken !== '',
  });
  const [selected, setSelected] = useState<AnalysisViewKey | null>(null);
  const percent = usePercent();
  const format = useFormat();
  const { locale } = useLocale();

  if (query.isError) return <ErrorState title={text.failed} />;
  if (!query.data) return <LoadingState label={text.loading} />;
  const step = query.data;
  const view = selected ?? step.views[0]?.view ?? 'volume';
  const current = step.views.find((entry) => entry.view === view) ?? step.views[0];
  if (!current) return null;
  const others = step.views.filter((entry) => entry.view !== current.view);
  const questions = content.questions
    .filter(
      (question) =>
        question.view === null || question.view === analysisViewQuestionKey[current.view],
    )
    .map((question) => question.text);

  return (
    <div className="flex flex-col gap-6">
      <SegmentedControl
        className="self-start"
        label={text.viewLabel}
        value={current.view}
        options={step.views.map((entry) => ({
          value: entry.view,
          label: text.viewOption(text.views[entry.view], text.states[entry.state]),
        }))}
        onChange={(value) => setSelected(value)}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <ViewResult groupId={groupId} step={step} view={current.view} data={current.data} />
          {step.canEdit && (
            <ViewEditor
              key={`${current.view}-${current.updatedAt ?? ''}`}
              strategyId={context.strategy.id}
              step={step}
              view={current.view}
              data={current.data}
            />
          )}
          {current.view === 'footprint' && (
            <CandidatesSection strategyId={context.strategy.id} step={step} />
          )}
        </div>
        <aside className="flex min-w-0 flex-col gap-4">
          {questions.length > 0 && (
            <GuideQuestions
              title={`${all.strategy.guide} · ${text.views[current.view]}`}
              questions={questions}
            />
          )}
          <NoteForm
            key={current.view}
            context={context}
            step={content.step}
            view={current.view}
            title={all.strategy.note}
            hint={text.noteHint}
            note={content.notes.find((entry) => entry.view === current.view)}
            editable={editable}
          />
          <ViewTeamPanel
            key={`team-${current.view}-${current.assignees.map((entry) => entry.userId).join(',')}`}
            strategyId={context.strategy.id}
            step={step}
            view={current.view}
          />
        </aside>
      </div>
      {content.step === 4 && (
        <p className="text-sm">
          {step.round.decided
            ? text.roundDone
            : step.round.exists
              ? text.roundOpen
              : text.roundNone}
          {' · '}
          {routerLink({
            href: segmentationPagePath(groupId),
            className: 'font-semibold text-petrol underline',
            children: text.toRound,
          })}
        </p>
      )}
      {others.length > 0 && (
        <section aria-labelledby="analysis-others" className="flex flex-col gap-3">
          <h2 id="analysis-others" className="font-semibold text-lg">
            {text.others(others.length)}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((entry) => (
              <li
                key={entry.view}
                className="flex flex-col gap-2 rounded-lg bg-card p-4 shadow-card"
              >
                <span className="text-chip text-muted-foreground">
                  {text.views[entry.view]} · {text.states[entry.state]}
                </span>
                <strong className="font-semibold">
                  {summaryOf(
                    entry.view,
                    entry.data,
                    step.computed,
                    text,
                    percent,
                    format.country,
                    locale,
                  )}
                </strong>
                <Button
                  variant="secondary"
                  size="sm"
                  className="self-start"
                  aria-label={`${text.open}: ${text.views[entry.view]}`}
                  onClick={() => setSelected(entry.view)}
                >
                  {text.open}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-card p-5 shadow-card">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-lg">{title}</h2>
        {hint && <p className="text-muted-foreground text-sm">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Ergebnis einer Sicht: berechnete Umsatzwerte und die Eingaben des Teams, nur lesend. */
function ViewResult({
  groupId,
  step,
  view,
  data,
}: {
  groupId: string;
  step: AnalysisStep;
  view: AnalysisViewKey;
  data: Data;
}) {
  const text = useT().analysis;
  const { locale } = useLocale();
  const percent = usePercent();
  const format = useFormat();
  const computed = step.computed;
  const money = (cents: number) =>
    formatMoney({ amountCents: cents, currency: computed.currency }, locale, { compact: true });
  const shareRows = (
    entries: { key: string; name: string; share: number; amountCents: number }[],
    label: (entry: { key: string; name: string }) => string,
  ) =>
    entries.length === 0 ? (
      <p className="text-muted-foreground text-sm">{text.noData}</p>
    ) : (
      <ShareRows
        rows={entries.map((entry) => ({
          key: entry.key,
          label: label(entry),
          share: entry.share,
          value: percent(entry.share),
          ...(entry.amountCents > 0 ? { note: money(entry.amountCents) } : {}),
          srLabel: `${label(entry)}: ${percent(entry.share)}`,
        }))}
      />
    );
  const nameOf = (id: unknown) =>
    step.suppliers.find((entry) => entry.relationshipId === id)?.name ?? '–';
  const simpleTable = (headers: string[], rows: string[][]) =>
    rows.length === 0 ? (
      <p className="text-muted-foreground text-sm">{text.noData}</p>
    ) : (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Zeilen ohne eigene Id
              <TableRow key={index}>
                {row.map((cell, column) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: Spalten ohne eigene Id
                  <TableCell key={column} className="tabular-nums">
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  const bullets = (items: unknown[]) =>
    items.length === 0 ? (
      <p className="text-muted-foreground text-sm">{text.noData}</p>
    ) : (
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
        {items.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Einträge ohne eigene Id
          <li key={index}>{str(item)}</li>
        ))}
      </ul>
    );

  switch (view) {
    case 'volume': {
      const forecast = list(data, 'forecast');
      const forecastYears = [...new Set(forecast.map((entry) => Number(entry.year)))]
        .filter((year) => year > computed.spendYear)
        .sort();
      const forecastOf = (unitId: string | null, year: number) =>
        forecast
          .filter(
            (entry) => (entry.businessUnitId ?? null) === unitId && Number(entry.year) === year,
          )
          .reduce((sum, entry) => sum + Number(entry.amountCents ?? 0), 0);
      return (
        <>
          <Card
            title={text.volume.productGroups(computed.spendYear)}
            hint={`${text.volume.productGroupsHint}. ${text.computedHint(computed.spendYear)}`}
          >
            {shareRows(
              [
                ...computed.productGroups,
                ...(computed.productGroupRestShare > 0
                  ? [
                      {
                        key: 'rest',
                        name: text.rest,
                        share: computed.productGroupRestShare,
                        amountCents: 0,
                      },
                    ]
                  : []),
              ].map((entry) => ({ ...entry, name: entry.name || text.none })),
              (entry) => entry.name,
            )}
          </Card>
          <Card title={text.volume.byUnit}>
            {simpleTable(
              [
                text.volume.unit,
                ...computed.years.map(String),
                ...forecastYears.map((year) => text.volume.forecast(year)),
              ],
              computed.byBusinessUnit.map((entry) => [
                entry.businessUnit?.name ?? text.volume.total,
                ...entry.years.map((value) => money(value.amountCents)),
                ...forecastYears.map((year) => {
                  const value = forecastOf(entry.businessUnit?.id ?? null, year);
                  return value ? money(value) : '–';
                }),
              ]),
            )}
          </Card>
          <div className="grid gap-6 sm:grid-cols-2">
            <Card title={text.volume.minRequirements} hint={text.volume.minRequirementsHint}>
              {bullets(list(data, 'minRequirements'))}
            </Card>
            <Card title={text.volume.differentiators} hint={text.volume.differentiatorsHint}>
              {bullets(list(data, 'differentiators'))}
            </Card>
          </div>
        </>
      );
    }
    case 'supply_chain':
      return (
        <>
          <Card title={text.supply_chain.stages}>
            {shareRows(
              list(data, 'stages').map((entry, index) => ({
                key: String(index),
                name: str(entry.name),
                share: Number(entry.valueSharePct ?? 0) / 100,
                amountCents: 0,
              })),
              (entry) => entry.name,
            )}
          </Card>
          <Card title={text.supply_chain.countries}>
            {simpleTable(
              [text.supply_chain.country, text.supply_chain.countryShare],
              list(data, 'countries').map((entry) => [
                format.country(str(entry.country) || null),
                `${str(entry.sharePct)} %`,
              ]),
            )}
          </Card>
        </>
      );
    case 'cost':
      return (
        <>
          {/* WG-07 Ablauf 5: dauerhafter Hinweis zum Kartellrecht */}
          <StatusLine message={text.cost.antitrust} tone="warning" />
          <Card title={text.cost.title}>
            {simpleTable(
              [text.cost.costType, text.cost.own, text.cost.target, text.cost.market],
              list(data, 'costTypes').map((entry) => [
                str(entry.name),
                localNumber(entry.own, locale) || '–',
                localNumber(entry.target, locale) || '–',
                localNumber(entry.market, locale) || '–',
              ]),
            )}
          </Card>
        </>
      );
    case 'technology':
      return (
        <Card title={text.technology.title}>
          {simpleTable(
            [
              text.technology.name,
              text.technology.startsOn,
              text.technology.products,
              text.technology.rampUpLabel,
            ],
            list(data, 'technologies').map((entry) => [
              str(entry.name),
              localMonth(entry.startsOn),
              str(entry.products) || '–',
              (Array.isArray(entry.rampUp) ? (entry.rampUp as Data[]) : [])
                .map((point) => `${str(point.year)}: ${str(point.pct)} %`)
                .join(', ') || '–',
            ]),
          )}
        </Card>
      );
    case 'revenue_finance':
      return (
        <>
          {/* WG-Lieferanten.dc.html: Segmente in der Warengruppe aus der Runde (WG-18) */}
          <CategorySegmentsCard groupId={groupId} />
          <Card title={text.revenue_finance.topSuppliers}>
            {simpleTable(
              [text.revenue_finance.supplier, ...computed.years.map(String)],
              computed.topSuppliers.map((entry) => [
                entry.name,
                ...entry.shares.map((value) => percent(value.share)),
              ]),
            )}
          </Card>
          <Card title={text.revenue_finance.byStability}>
            {shareRows(computed.byStability, (entry) =>
              entry.key === 'none'
                ? text.none
                : (text.revenue_finance.ratings[entry.key] ?? entry.key),
            )}
          </Card>
          <Card title={text.revenue_finance.callOff}>
            {simpleTable(
              [
                text.revenue_finance.supplier,
                text.revenue_finance.year,
                text.revenue_finance.deviation,
              ],
              list(data, 'callOff').map((entry) => [
                nameOf(entry.relationshipId),
                str(entry.year),
                `${str(entry.deviationPct)} %`,
              ]),
            )}
          </Card>
        </>
      );
    case 'quality':
      return (
        <>
          <Card title={text.quality.byRating} hint={text.computedHint(computed.spendYear)}>
            {shareRows(computed.byQualityRating, (entry) =>
              entry.key === 'none' ? text.none : text.quality.ratingName(entry.key),
            )}
          </Card>
          <Card title={text.quality.defects}>
            {simpleTable(
              [text.quality.supplier, text.quality.year, text.quality.ppm],
              list(data, 'defects').map((entry) => [
                nameOf(entry.relationshipId),
                str(entry.year),
                str(entry.ppm),
              ]),
            )}
          </Card>
          <Card title={text.quality.audits}>
            {simpleTable(
              [text.quality.site, text.quality.result],
              list(data, 'audits').map((entry) => [str(entry.site), str(entry.result)]),
            )}
          </Card>
        </>
      );
    case 'footprint':
      return (
        <>
          <Card
            title={text.footprint.bySupplierCountry}
            hint={text.computedHint(computed.spendYear)}
          >
            {shareRows(computed.bySupplierCountry, (entry) =>
              entry.key === 'none' ? text.none : format.country(entry.key),
            )}
          </Card>
          <Card title={text.footprint.recipients}>
            {shareRows(
              list(data, 'recipients').map((entry, index) => ({
                key: String(index),
                name: format.country(str(entry.country) || null),
                share: Number(entry.sharePct ?? 0) / 100,
                amountCents: 0,
              })),
              (entry) => entry.name,
            )}
          </Card>
        </>
      );
  }
}

function useAnalysisSave(strategyId: string, stepNumber: number) {
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const text = useT().analysis;
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (
    work: (token: string) => Promise<AnalysisStep>,
    errors?: Record<string, string>,
  ) => {
    setBusy(true);
    setFailure(null);
    setMessage(null);
    try {
      queryClient.setQueryData(
        analysisStepQueryOptions(accessToken, strategyId, stepNumber).queryKey,
        await work(accessToken),
      );
      await queryClient.invalidateQueries({ queryKey: ['warengruppen'], refetchType: 'none' });
      setMessage(text.saved);
      return true;
    } catch (error) {
      const code =
        error instanceof ApiError ? (error.body as { code?: string } | null)?.code : undefined;
      setFailure((code && errors?.[code]) || text.failedSave);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { run, message, failure, busy, clear: () => setMessage(null) };
}

/** Eingaben einer Sicht pflegen: je Liste ein Zeilen-Editor, ein Knopf speichert alles. */
function ViewEditor({
  strategyId,
  step,
  view,
  data,
}: {
  strategyId: string;
  step: AnalysisStep;
  view: AnalysisViewKey;
  data: Data;
}) {
  const text = useT().analysis;
  const specs = listsOf(view, text, step);
  const save = useAnalysisSave(strategyId, step.step);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, Row[]>>(() =>
    Object.fromEntries(specs.map((spec) => [spec.key, spec.toRows(data)])),
  );
  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        {save.message && <StatusLine message={save.message} onHidden={save.clear} />}
        <Button variant="secondary" className="self-start" onClick={() => setOpen(true)}>
          {text.edit}: {text.views[view]}
        </Button>
      </div>
    );
  }
  return (
    <form
      aria-label={`${text.edit}: ${text.views[view]}`}
      className="flex flex-col gap-5 rounded-lg bg-card p-5 shadow-card"
      onSubmit={async (event: FormEvent) => {
        event.preventDefault();
        const payload = Object.fromEntries(
          specs.map((spec) => [spec.key, spec.fromRows((rows[spec.key] ?? []).filter(filled))]),
        );
        if (await save.run((token) => saveAnalysis(token, strategyId, view, payload))) {
          setOpen(false);
        }
      }}
    >
      {save.failure && <StatusLine message={save.failure} tone="warning" />}
      {specs.map((spec) => (
        <RowsEditor
          key={spec.key}
          legend={spec.legend}
          columns={spec.columns}
          rows={rows[spec.key] ?? []}
          onChange={(next) => setRows((current) => ({ ...current, [spec.key]: next }))}
          addLabel={text.add}
          removeLabel={(index) => text.remove(index + 1)}
        />
      ))}
      <FormActions>
        <Button type="submit" loading={save.busy}>
          {text.save}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {text.cancel}
        </Button>
      </FormActions>
    </form>
  );
}

/** Footprint: weitere verfügbare Lieferanten, mit einem Klick als Lieferant im Entwurf anlegen. */
function CandidatesSection({ strategyId, step }: { strategyId: string; step: AnalysisStep }) {
  const text = useT().analysis.footprint;
  const { locale } = useLocale();
  const save = useAnalysisSave(strategyId, 4);
  const [draft, setDraft] = useState({ name: '', site: '', country: '', revenue: '', comment: '' });
  const [created, setCreated] = useState<string | null>(null);
  const field = (key: keyof typeof draft, label: string) => (
    <FormField label={label}>
      {(props) => (
        <Input
          {...props}
          value={draft[key]}
          required={key === 'name'}
          onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
        />
      )}
    </FormField>
  );
  return (
    <Card title={text.candidates} hint={text.candidatesHint}>
      {created && <StatusLine message={created} onHidden={() => setCreated(null)} />}
      {save.failure && <StatusLine message={save.failure} tone="warning" />}
      {step.candidates.length === 0 ? (
        <p className="text-muted-foreground text-sm">{text.candidatesEmpty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft">
          {step.candidates.map((candidate) => (
            <li key={candidate.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="flex min-w-0 grow basis-60 flex-col">
                <strong className="font-semibold">{candidate.name}</strong>
                <span className="text-muted-foreground text-sm">
                  {[
                    candidate.site,
                    candidate.country,
                    candidate.revenueCents !== null
                      ? formatMoney(
                          { amountCents: candidate.revenueCents, currency: candidate.currency },
                          locale,
                          { compact: true },
                        )
                      : null,
                    candidate.comment,
                    candidate.isSupplier ? text.isSupplier : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              {step.canEdit && !candidate.isSupplier && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`${text.toSupplier}: ${candidate.name}`}
                    onClick={async () => {
                      const ok = await save.run(
                        async (token) =>
                          (await candidateToSupplier(token, strategyId, candidate.id)).step,
                        { country_missing: text.countryMissing },
                      );
                      if (ok) setCreated(text.created);
                    }}
                  >
                    {text.toSupplier}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void save.run((token) => removeCandidate(token, strategyId, candidate.id))
                    }
                  >
                    {text.removeCandidate(candidate.name)}
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {step.canEdit && (
        <form
          aria-label={text.addCandidate}
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={async (event: FormEvent) => {
            event.preventDefault();
            const revenue = num(draft.revenue);
            const ok = await save.run((token) =>
              addCandidate(token, strategyId, {
                name: draft.name,
                site: draft.site.trim() || null,
                country: draft.country.trim().toUpperCase() || null,
                revenueCents: revenue === null ? null : Math.round(revenue * 100),
                comment: draft.comment.trim() || null,
              }),
            );
            if (ok) setDraft({ name: '', site: '', country: '', revenue: '', comment: '' });
          }}
        >
          {field('name', text.name)}
          {field('site', text.site)}
          {field('country', text.country)}
          {field('revenue', text.revenue)}
          <div className="sm:col-span-2">{field('comment', text.comment)}</div>
          <div className="sm:col-span-2">
            <FormActions>
              <Button type="submit" variant="secondary" loading={save.busy}>
                {text.addCandidate}
              </Button>
            </FormActions>
          </div>
        </form>
      )}
    </Card>
  );
}
