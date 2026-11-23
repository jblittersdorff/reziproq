import type {
  CategoryInitiative,
  CategoryScorecard,
  InitiativeRequest,
  StrategyContext,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { PlusIcon, XIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { CheckboxGroup, FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { MeterBar } from '@/components/ui/meter-bar';
import { NativeSelect } from '@/components/ui/native-select';
import { StatusLine } from '@/components/ui/status-line';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import {
  categoryReviewQueryOptions,
  categoryScorecardQueryOptions,
  holdCategoryReview,
  newStrategyVersion,
  removeInitiative,
  reportInitiativeProgress,
  saveInitiative,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';

const horizonOrder = ['short', 'mid', 'long', 'none'] as const;

function useScorecardSave(strategyId: string) {
  const accessToken = useToken();
  const client = useQueryClient();
  const text = useT().categoryScorecard;
  const [failure, setFailure] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const run = async (work: (token: string) => Promise<CategoryScorecard>) => {
    setFailure(null);
    setMessage(null);
    try {
      client.setQueryData(
        categoryScorecardQueryOptions(accessToken, strategyId).queryKey,
        await work(accessToken),
      );
      setMessage(text.saved);
      return true;
    } catch (error) {
      const code = (error as { body?: { code?: string } }).body?.code;
      setFailure((code && text.errors[code]) || text.saveFailed);
      return false;
    }
  };
  return { run, failure, message, clear: () => setMessage(null) };
}

/**
 * WG-12 Schritt 7 (nach Regeln, Muster der Ziele in Schritt 2): Initiativen je gewähltem Hebel,
 * gruppiert nach kurz-, mittel- und langfristig. Ein gewählter Hebel ohne Initiative wird genannt und
 * verweist auf Schritt 6. Darunter die Quartals-Reviews.
 */
export function ScorecardSection({
  groupId,
  context,
  editable,
}: {
  groupId: string;
  context: StrategyContext;
  editable: boolean;
}) {
  const t = useT();
  const text = t.categoryScorecard;
  const format = useFormat();
  const { locale } = useLocale();
  const accessToken = useToken();
  const strategyId = context.strategy.id;
  const query = useQuery({
    ...categoryScorecardQueryOptions(accessToken, strategyId),
    enabled: accessToken !== '',
  });
  const save = useScorecardSave(strategyId);
  const [form, setForm] = useState<CategoryInitiative | 'new' | null>(null);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  if (query.isError) return <ErrorState title={text.failed} />;
  const data = query.data;
  if (!data) return <LoadingState label={text.loading} />;
  const canEdit = data.canEdit && editable;
  const goalOf = (id: string) => data.goals.find((goal) => goal.id === id);
  const choiceOf = (id: string) => data.choices.find((choice) => choice.id === id);
  const missing = data.choices.filter((choice) => data.missingChoiceIds.includes(choice.id));
  const value = (amount: number | null) => (amount === null ? '–' : number.format(amount));

  return (
    <section aria-labelledby="wg-scorecard" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="wg-scorecard" className="font-semibold text-lg">
          {text.title}
        </h2>
        {canEdit && form === null && (
          <Button variant="secondary" size="sm" onClick={() => setForm('new')}>
            <PlusIcon aria-hidden />
            {text.add}
          </Button>
        )}
      </div>
      {save.message && <StatusLine message={save.message} onHidden={save.clear} />}
      {save.failure && <StatusLine message={save.failure} tone="warning" />}
      {missing.length > 0 && (
        <p role="status" className="flex flex-wrap items-center gap-x-2 text-sm">
          <span>
            {text.missing(
              missing.map((choice) => `${choice.pairing} ${choice.leverName}`).join(', '),
            )}
          </span>
          {routerLink({
            href: `/warengruppen/${groupId}/strategie/6`,
            className: 'font-semibold text-petrol underline',
            children: text.toStep6,
          })}
        </p>
      )}
      {form !== null && (
        <InitiativeForm
          data={data}
          initiative={form === 'new' ? null : form}
          strategyYear={context.strategy.year}
          onSave={async (request, id) => {
            if (await save.run((token) => saveInitiative(token, strategyId, request, id)))
              setForm(null);
          }}
          onCancel={() => setForm(null)}
        />
      )}
      {data.initiatives.length === 0 ? (
        <p className="text-muted-foreground">{text.empty}</p>
      ) : (
        horizonOrder.map((horizon) => {
          const rows = data.initiatives.filter(
            (initiative) => (initiative.horizon ?? 'none') === horizon,
          );
          if (rows.length === 0) return null;
          return (
            <div key={horizon} className="flex flex-col gap-2">
              <h3 className="font-semibold">{text.horizons[horizon]}</h3>
              <div className="overflow-x-auto">
                <Table>
                  <caption className="sr-only">{text.horizons[horizon]}</caption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{text.columns.goal}</TableHead>
                      <TableHead>{text.columns.lever}</TableHead>
                      <TableHead>{text.columns.initiative}</TableHead>
                      <TableHead>{text.columns.effect}</TableHead>
                      <TableHead className="text-right">{text.columns.actual}</TableHead>
                      <TableHead className="text-right">{text.columns.target}</TableHead>
                      <TableHead>{text.columns.owner}</TableHead>
                      <TableHead>{text.columns.due}</TableHead>
                      <TableHead>{text.columns.progress}</TableHead>
                      {canEdit && <TableHead className="sr-only">{text.editShort}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((initiative) => (
                      <TableRow key={initiative.id}>
                        <TableCell>{goalOf(initiative.goalId)?.text ?? '–'}</TableCell>
                        <TableCell>
                          {choiceOf(initiative.leverChoiceId)?.leverName ?? '–'}
                          <span className="block text-muted-foreground text-sm">
                            {choiceOf(initiative.leverChoiceId)?.pairing}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {initiative.name}
                          {initiative.suppliers.length > 0 && (
                            <span className="block font-normal text-muted-foreground text-sm">
                              {initiative.suppliers.map((entry) => entry.name).join(', ')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{initiative.effect || '–'}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {value(initiative.actual)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {value(initiative.target)}
                        </TableCell>
                        <TableCell>{initiative.ownerName ?? '–'}</TableCell>
                        <TableCell className="tabular-nums">
                          {initiative.targetYear
                            ? `${initiative.targetQuarter ? `Q${initiative.targetQuarter}/` : ''}${initiative.targetYear}`
                            : '–'}
                        </TableCell>
                        <TableCell>
                          {initiative.canReport ? (
                            <NativeSelect
                              aria-label={text.progressLabel(initiative.name)}
                              value={initiative.progress}
                              onChange={(event) =>
                                void save.run((token) =>
                                  reportInitiativeProgress(
                                    token,
                                    strategyId,
                                    initiative.id,
                                    Number(event.target.value),
                                  ),
                                )
                              }
                            >
                              {Array.from({ length: 11 }, (_, index) => index * 10).map((n) => (
                                <option key={n} value={n}>
                                  {text.percent(n)}
                                </option>
                              ))}
                            </NativeSelect>
                          ) : (
                            text.percent(initiative.progress)
                          )}
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <span className="flex flex-wrap gap-1">
                              <Button
                                size="sm"
                                variant="secondary"
                                aria-label={text.edit(initiative.name)}
                                onClick={() => setForm(initiative)}
                              >
                                {text.editShort}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={text.remove(initiative.name)}
                                onClick={() =>
                                  void save.run((token) =>
                                    removeInitiative(token, strategyId, initiative.id),
                                  )
                                }
                              >
                                <XIcon aria-hidden />
                              </Button>
                            </span>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          );
        })
      )}
      <section
        aria-labelledby="wg-reviews"
        className="flex flex-col gap-2 rounded-lg bg-card p-5 shadow-card"
      >
        <h3 id="wg-reviews" className="font-semibold">
          {text.reviewsTitle}
        </h3>
        {data.reviews.length === 0 ? (
          <p className="text-muted-foreground text-sm">{text.reviewsNone}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {data.reviews.map((review) => (
              <li key={review.id} className="flex flex-wrap items-center gap-2 text-sm">
                {routerLink({
                  href: `/warengruppen/${groupId}/review/${review.id}`,
                  className:
                    'inline-flex min-h-11 items-center font-semibold text-petrol underline',
                  children: text.reviewDue(format.date(review.dueOn)),
                })}
                <span className="text-muted-foreground">
                  {review.heldAt ? text.reviewHeld : text.reviewOpen}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function InitiativeForm({
  data,
  initiative,
  strategyYear,
  onSave,
  onCancel,
}: {
  data: CategoryScorecard;
  initiative: CategoryInitiative | null;
  strategyYear: number;
  onSave: (request: InitiativeRequest, id?: string) => void;
  onCancel: () => void;
}) {
  const text = useT().categoryScorecard;
  const [goalId, setGoalId] = useState(initiative?.goalId ?? '');
  const [leverChoiceId, setLeverChoiceId] = useState(initiative?.leverChoiceId ?? '');
  const [name, setName] = useState(initiative?.name ?? '');
  const [effect, setEffect] = useState(initiative?.effect ?? '');
  const [actual, setActual] = useState(initiative?.actual?.toString() ?? '');
  const [target, setTarget] = useState(initiative?.target?.toString() ?? '');
  const [ownerUserId, setOwner] = useState(initiative?.ownerUserId ?? '');
  const [quarter, setQuarter] = useState(initiative?.targetQuarter?.toString() ?? '');
  const [year, setYear] = useState(initiative?.targetYear?.toString() ?? String(strategyYear));
  const [suppliers, setSuppliers] = useState<string[]>(
    initiative?.suppliers.map((entry) => entry.relationshipId) ?? [],
  );
  const numberOrNull = (input: string) =>
    input.trim() === '' ? null : Number(input.replace(',', '.'));
  return (
    <form
      aria-label={text.formTitle}
      className="flex flex-col gap-4 rounded-lg bg-card p-5 shadow-card"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSave(
          {
            goalId,
            leverChoiceId,
            name,
            effect,
            actual: numberOrNull(actual),
            target: numberOrNull(target),
            ownerUserId: ownerUserId || null,
            targetQuarter: quarter ? Number(quarter) : null,
            targetYear: year ? Number(year) : null,
            supplierIds: suppliers,
          },
          initiative?.id,
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={text.goal}>
          {(field) => (
            <NativeSelect
              {...field}
              value={goalId}
              onChange={(event) => setGoalId(event.target.value)}
            >
              <option value="">{text.choose}</option>
              {data.goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.text} ({goal.kpiName})
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField label={text.lever}>
          {(field) => (
            <NativeSelect
              {...field}
              value={leverChoiceId}
              onChange={(event) => setLeverChoiceId(event.target.value)}
            >
              <option value="">{text.choose}</option>
              {data.choices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.pairing} · {choice.leverName}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </div>
      <FormField label={text.name}>
        {(field) => (
          <Input
            {...field}
            maxLength={200}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        )}
      </FormField>
      <FormField label={text.effect}>
        {(field) => (
          <Textarea
            {...field}
            rows={2}
            maxLength={500}
            value={effect}
            onChange={(event) => setEffect(event.target.value)}
          />
        )}
      </FormField>
      <div className="flex flex-wrap gap-3">
        <FormField label={text.actual} className="basis-28">
          {(field) => (
            <Input
              {...field}
              inputMode="decimal"
              value={actual}
              onChange={(event) => setActual(event.target.value)}
            />
          )}
        </FormField>
        <FormField label={text.target} className="basis-28">
          {(field) => (
            <Input
              {...field}
              inputMode="decimal"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
          )}
        </FormField>
        <FormField label={text.owner} className="min-w-0 flex-1 basis-48">
          {(field) => (
            <NativeSelect
              {...field}
              value={ownerUserId}
              onChange={(event) => setOwner(event.target.value)}
            >
              <option value="">{text.nobody}</option>
              {data.people.map((person) => (
                <option key={person.userId} value={person.userId}>
                  {person.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField label={text.quarter} className="basis-28">
          {(field) => (
            <NativeSelect
              {...field}
              value={quarter}
              onChange={(event) => setQuarter(event.target.value)}
            >
              <option value="">–</option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  Q{n}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField label={text.year} className="basis-28">
          {(field) => (
            <Input
              {...field}
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(event) => setYear(event.target.value)}
            />
          )}
        </FormField>
      </div>
      {data.suppliers.length === 0 ? (
        <p className="text-muted-foreground text-sm">{text.noSuppliers}</p>
      ) : (
        <CheckboxGroup
          legend={text.suppliers}
          options={data.suppliers.map((entry) => ({
            value: entry.relationshipId,
            label: entry.name,
          }))}
          value={suppliers}
          onChange={setSuppliers}
        />
      )}
      <FormActions>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {text.cancel}
        </Button>
        <Button type="submit">{text.save}</Button>
      </FormActions>
    </form>
  );
}

/**
 * WG-12 Quartals-Review (`/warengruppen/<id>/review/<id>`, nach Regeln): Fortschritt je Initiative,
 * offene Zusagen und Maßnahmen bei Lieferanten der Warengruppe, Abschluss mit Zusammenfassung.
 */
export function CategoryReviewPage({ groupId, reviewId }: { groupId: string; reviewId: string }) {
  const t = useT();
  const text = t.categoryScorecard.review;
  const format = useFormat();
  const accessToken = useToken();
  const client = useQueryClient();
  const options = categoryReviewQueryOptions(accessToken, reviewId);
  const query = useQuery({ ...options, enabled: accessToken !== '' });
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const navigate = useNavigate();
  const data = query.data;
  const trail = [
    { label: t.materialGroupsPage.title, href: '/warengruppen' },
    ...(data
      ? [
          { label: data.groupName, href: `/warengruppen/${groupId}` },
          { label: t.categoryScorecard.title, href: `/warengruppen/${groupId}/strategie/7` },
        ]
      : []),
  ];
  return (
    <>
      <PagePath trail={trail} current={data ? text.title(format.date(data.dueOn)) : text.loading} />
      <PageHeader
        size="work"
        title={data ? text.title(format.date(data.dueOn)) : text.loading}
        purpose={data ? text.purpose(data.groupName, data.year) : ''}
      />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !data ? (
        <LoadingState label={text.loading} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <section
              aria-labelledby="review-initiatives"
              className="flex flex-col gap-3 rounded-lg bg-card p-5 shadow-card"
            >
              <h2 id="review-initiatives" className="font-semibold text-lg">
                {text.initiatives}
              </h2>
              {data.initiatives.length === 0 ? (
                <p className="text-muted-foreground text-sm">{text.noInitiatives}</p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {data.initiatives.map((initiative) => (
                    <li key={initiative.id} className="flex flex-col gap-1">
                      <span className="flex flex-wrap justify-between gap-2">
                        <span className="font-semibold">{initiative.name}</span>
                        <span className="tabular-nums">{initiative.progress} %</span>
                      </span>
                      <MeterBar
                        value={initiative.progress / 100}
                        label={text.progress(initiative.name, initiative.progress)}
                      />
                      <span className="text-muted-foreground text-sm">
                        {text.goalLever(initiative.goal, initiative.lever)}
                        {initiative.ownerName ? ` · ${initiative.ownerName}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section
              aria-labelledby="review-commitments"
              className="flex flex-col gap-2 rounded-lg bg-card p-5 shadow-card"
            >
              <h2 id="review-commitments" className="font-semibold text-lg">
                {text.commitments}
              </h2>
              {data.commitments.length === 0 ? (
                <p className="text-muted-foreground text-sm">{text.noCommitments}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line-soft">
                  {data.commitments.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-wrap justify-between gap-2 py-2 text-sm"
                    >
                      <span>
                        <span className="font-semibold">{entry.supplier}</span> · {entry.title}
                      </span>
                      <span className="text-muted-foreground">
                        {text.sides[entry.side]} · {text.due(format.date(entry.dueOn))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section
              aria-labelledby="review-actions"
              className="flex flex-col gap-2 rounded-lg bg-card p-5 shadow-card"
            >
              <h2 id="review-actions" className="font-semibold text-lg">
                {text.actions}
              </h2>
              {data.actions.length === 0 ? (
                <p className="text-muted-foreground text-sm">{text.noActions}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line-soft">
                  {data.actions.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-wrap justify-between gap-2 py-2 text-sm"
                    >
                      <span>
                        <span className="font-semibold">{entry.supplier}</span> · {entry.title}
                      </span>
                      {entry.dueDate && (
                        <span className="text-muted-foreground">
                          {text.due(format.date(entry.dueDate))}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <aside className="flex min-w-0 flex-col gap-4">
            <section
              aria-labelledby="review-summary"
              className="flex flex-col gap-3 rounded-lg bg-card p-5 shadow-card"
            >
              <h2 id="review-summary" className="font-semibold text-lg">
                {text.closeTitle}
              </h2>
              {data.heldAt ? (
                <>
                  <StatusLine message={text.held(format.date(data.heldAt), data.heldBy)} />
                  <p className="whitespace-pre-wrap text-sm">{data.summary}</p>
                </>
              ) : data.canHold ? (
                <form
                  className="flex flex-col gap-3"
                  onSubmit={async (event: FormEvent) => {
                    event.preventDefault();
                    if (!summary.trim()) return;
                    setBusy(true);
                    setFailure(null);
                    try {
                      client.setQueryData(
                        options.queryKey,
                        await holdCategoryReview(accessToken, reviewId, summary.trim()),
                      );
                    } catch {
                      setFailure(t.categoryScorecard.saveFailed);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {failure && <StatusLine message={failure} tone="warning" />}
                  <FormField label={text.summary} hint={text.summaryHint}>
                    {(field) => (
                      <Textarea
                        {...field}
                        rows={4}
                        maxLength={2000}
                        value={summary}
                        onChange={(event) => setSummary(event.target.value)}
                      />
                    )}
                  </FormField>
                  <Button
                    type="submit"
                    className="self-start"
                    loading={busy}
                    disabled={!summary.trim()}
                  >
                    {text.hold}
                  </Button>
                </form>
              ) : (
                <p className="text-muted-foreground text-sm">{text.summaryHint}</p>
              )}
              {/* WG-16: Anpassen beginnt eine neue Version der Strategie im Entwurf */}
              <p className="text-muted-foreground text-sm">{text.adapt}</p>
              {data.canHold && (
                <Button
                  variant="secondary"
                  className="self-start"
                  onClick={async () => {
                    setFailure(null);
                    try {
                      await newStrategyVersion(accessToken, data.strategyId);
                      await client.invalidateQueries({ queryKey: ['warengruppen'] });
                      await navigate({
                        to: '/warengruppen/$id/strategie/$step',
                        params: { id: groupId, step: '1' },
                      });
                    } catch (error) {
                      const code = (error as { body?: { code?: string } }).body?.code;
                      setFailure(
                        (code && t.strategyApproval.errors[code]) || t.strategyApproval.saveFailed,
                      );
                    }
                  }}
                >
                  {t.strategyApproval.adapt}
                </Button>
              )}
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
