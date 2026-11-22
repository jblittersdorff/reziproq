import {
  type GoalRequest,
  goalRequestSchema,
  type StrategyContext,
  type StrategyGoal,
  type StrategyStep,
  strategyStepCount,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { GroupBar } from '@/components/ui/group-bar';
import { GuideQuestions } from '@/components/ui/guide-questions';
import { Input } from '@/components/ui/input';
import { ListCard, ListCardHeader, ListRow, ListRowText } from '@/components/ui/list-card';
import { LoadingState } from '@/components/ui/loading-state';
import { Monogram } from '@/components/ui/monogram';
import { NativeSelect } from '@/components/ui/native-select';
import { NextStep, NextStepArrow } from '@/components/ui/next-step';
import { StatusLine } from '@/components/ui/status-line';
import { StepDots } from '@/components/ui/step-dots';
import { StepProgress } from '@/components/ui/step-progress';
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
import { InLocalBarSlot } from '@/features/shell/local-bar-slot';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import {
  ApiError,
  addStrategyMilestone,
  createStrategy,
  materialGroupDetailQueryOptions,
  materialGroupOverviewQueryOptions,
  removeStrategyGoal,
  removeStrategyMilestone,
  saveStrategyGoal,
  saveStrategyNote,
  strategyContextQueryOptions,
  strategyOverviewQueryOptions,
  strategyStepQueryOptions,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { AnalysisSection } from './analysis-pages';
import { AssessmentSection } from './assessment-pages';
import { MarketSection } from './market-pages';
import { ProductGroupsSection, TeamSection } from './material-groups-pages';

const strategyPath = (groupId: string, step?: number) =>
  `/warengruppen/${groupId}/strategie${step ? `/${step}` : ''}`;

function useMoney() {
  const { locale } = useLocale();
  return (spend: { amountCents: number; currency: string } | null) =>
    spend ? formatMoney(spend, locale, { compact: true }) : null;
}

const statusTone = (status: string | undefined) =>
  status === 'approved'
    ? ('success' as const)
    : status
      ? ('warning' as const)
      : ('neutral' as const);

/**
 * Warengruppen (WG-04, nach WG-Uebersicht.dc.html): oben die eine nächste Aufgabe, darunter der
 * Zusammenhang und je Warengruppe Umsatz, Lieferanten, Lead, Fortschritt als zehn Ringe und Stand.
 */
export function StrategyOverviewPage() {
  const t = useT();
  const text = t.strategy;
  const groupsText = t.materialGroupsPage;
  const accessToken = useToken();
  const money = useMoney();
  const overview = useQuery({
    ...strategyOverviewQueryOptions(accessToken),
    enabled: accessToken !== '',
  });
  const groups = useQuery({
    ...materialGroupOverviewQueryOptions(accessToken),
    enabled: accessToken !== '',
  });
  const data = overview.data;
  const manage = groups.data?.canManage ?? false;
  const actions = manage ? (
    <div className="flex flex-wrap gap-2">
      {routerLink({
        href: '/einstellungen/warengruppen/neu',
        className: buttonVariants(),
        children: (
          <>
            <PlusIcon aria-hidden />
            {groupsText.create}
          </>
        ),
      })}
      {routerLink({
        href: '/einstellungen/warengruppen/import',
        className: buttonVariants({ variant: 'secondary' }),
        children: groupsText.import,
      })}
    </div>
  ) : null;

  return (
    <>
      <PageHeader size="list" title={groupsText.title} purpose={text.overviewPurpose} />
      {overview.isError || groups.isError ? (
        <ErrorState title={groupsText.failed} />
      ) : !data || !groups.data ? (
        <LoadingState label={groupsText.loading} />
      ) : data.groups.length === 0 ? (
        <EmptyState
          size="lg"
          title={groupsText.emptyTitle}
          description={manage ? groupsText.emptyText : groupsText.emptyReadOnly}
          action={actions ?? undefined}
        />
      ) : (
        <>
          {actions}
          {data.next && (
            <NextStep
              eyebrow={
                data.next.step
                  ? text.nextEyebrow(data.next.name, data.next.step, strategyStepCount)
                  : text.nextCreateEyebrow(data.next.name)
              }
              title={
                data.next.step
                  ? (text.stepTitles[data.next.step - 1] ?? '')
                  : text.nextCreateTitle(data.year)
              }
              text={data.next.step ? text.nextStepText : text.nextCreateText}
              action={
                <Button variant="mint" size="hero" asChild>
                  {routerLink({
                    href: strategyPath(data.next.materialGroupId, data.next.step ?? undefined),
                    className: '',
                    children: (
                      <>
                        {text.open}
                        <NextStepArrow />
                      </>
                    ),
                  })}
                </Button>
              }
            />
          )}
          <section aria-labelledby="wg-relation" className="flex flex-col gap-3">
            <h2 id="wg-relation" className="font-semibold text-lg">
              {text.relationTitle}
            </h2>
            <ol className="grid gap-3 md:grid-cols-3">
              {text.relation.map(([title, body], index) => (
                <li key={title} className="flex gap-3 rounded-lg bg-card p-5 shadow-card">
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-petrol font-display font-semibold text-petrol-dark text-sm"
                  >
                    {index + 1}
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <strong className="font-semibold">{title}</strong>
                    <span className="text-muted-foreground text-sm">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
          {groups.data.unassignedSpendRows > 0 && (
            <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground text-sm">
              {groupsText.unassigned(groups.data.unassignedSpendRows)}
            </p>
          )}
          <ListCard aria-label={text.yearTitle(data.year)}>
            <ListCardHeader
              title={text.yearTitle(data.year)}
              action={
                <span className="text-muted-foreground text-sm">
                  {text.approvedCount(data.approvedCount, data.groups.length)}
                </span>
              }
            />
            <ul>
              {data.groups.map((group) => {
                const steps = group.strategy?.steps;
                const done = steps?.filter((state) => state === 'done').length ?? 0;
                const status = group.strategy
                  ? text.statuses[group.strategy.status]
                  : group.hidden
                    ? text.hidden
                    : text.notStarted;
                return (
                  <li key={group.id}>
                    <ListRow asChild>
                      {routerLink({
                        href: strategyPath(group.id),
                        className: '',
                        children: (
                          <>
                            <span className="flex min-w-0 flex-1 items-center gap-3.5">
                              <Monogram name={group.code} tone="ink" />
                              <ListRowText
                                title={group.name}
                                detail={text.rowLine(
                                  money(group.spend),
                                  group.supplierCount,
                                  group.lead?.name ?? null,
                                )}
                              />
                            </span>
                            <span className="flex flex-wrap items-center gap-3">
                              {steps && (
                                <StepDots states={steps} label={text.progressLabel(done)} />
                              )}
                              <Badge variant={statusTone(group.strategy?.status)}>{status}</Badge>
                            </span>
                          </>
                        ),
                      })}
                    </ListRow>
                  </li>
                );
              })}
            </ul>
          </ListCard>
        </>
      )}
    </>
  );
}

/** Warengruppen-Leiste über der Strategie (GroupBar.dc.html) mit dem Stand als Chip */
function StrategyGroupBar({ context }: { context: StrategyContext }) {
  const text = useT().strategy;
  const money = useMoney();
  const { group, strategy } = context;
  return (
    <InLocalBarSlot>
      <GroupBar
        label={text.groupBarLabel}
        name={group.name}
        code={group.code}
        href={`/warengruppen/${group.id}`}
        subtitle={text.groupLine(money(group.spend), group.supplierCount, group.lead?.name ?? null)}
        status={text.statusChip(strategy.year, text.statuses[strategy.status])}
        statusTone={statusTone(strategy.status)}
        renderLink={routerLink}
      />
    </InLocalBarSlot>
  );
}

/**
 * Einstieg in die Strategie einer Warengruppe: gibt es sie, zum ersten offenen Schritt; sonst
 * anlegen (Lead und Commodity Manager) oder der Hinweis, dass sie noch ein Entwurf ist.
 */
export function StrategyEntryPage({ groupId }: { groupId: string }) {
  const t = useT();
  const text = t.strategy;
  const accessToken = useToken();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const options = strategyContextQueryOptions(accessToken, groupId);
  const query = useQuery({ ...options, enabled: accessToken !== '' });
  const group = useQuery({
    ...materialGroupDetailQueryOptions(accessToken, groupId),
    enabled: accessToken !== '',
  });
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const context = query.data?.context;

  useEffect(() => {
    if (!context) return;
    const steps = context.strategy.steps;
    const first = context.editableSteps.find((step) => steps[step - 1] !== 'done') ?? 1;
    void navigate({
      to: '/warengruppen/$id/strategie/$step',
      params: { id: groupId, step: String(first) },
      replace: true,
    });
  }, [context, groupId, navigate]);

  const title = group.data?.group.name ?? t.materialGroupsPage.title;
  return (
    <>
      <PageHeader
        title={title}
        purpose={query.data ? text.noStrategy(query.data.year) : text.loading}
      />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data || context ? (
        <LoadingState label={text.loading} />
      ) : (
        <div className="flex max-w-3xl flex-col gap-4">
          {failure && <StatusLine message={failure} tone="warning" />}
          {query.data.hidden ? (
            <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
              {text.hiddenText}
            </p>
          ) : query.data.canCreate ? (
            <Button
              className="self-start"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setFailure(null);
                try {
                  queryClient.setQueryData(
                    options.queryKey,
                    await createStrategy(
                      accessToken,
                      groupId,
                      query.data?.year ?? new Date().getFullYear() + 1,
                    ),
                  );
                  await queryClient.invalidateQueries({ queryKey: ['warengruppen', 'strategien'] });
                } catch {
                  setFailure(text.failedSave);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {text.create(query.data.year)}
            </Button>
          ) : (
            <p className="text-muted-foreground">{text.createHint}</p>
          )}
          {routerLink({
            href: `/warengruppen/${groupId}`,
            className: buttonVariants({ variant: 'secondary', className: 'self-start' }),
            children: text.toGroup,
          })}
        </div>
      )}
    </>
  );
}

/** Ein Schritt der Strategie: Warengruppen-Leiste, Ablauf-Leiste und der Inhalt des Schritts. */
export function StrategyStepPage({ groupId, step }: { groupId: string; step: number }) {
  const t = useT();
  const text = t.strategy;
  const accessToken = useToken();
  const contextQuery = useQuery({
    ...strategyContextQueryOptions(accessToken, groupId),
    enabled: accessToken !== '',
  });
  const context = contextQuery.data?.context;
  const stepQuery = useQuery({
    ...strategyStepQueryOptions(accessToken, context?.strategy.id ?? '', step),
    enabled: accessToken !== '' && Boolean(context),
  });
  const valid = Number.isInteger(step) && step >= 1 && step <= strategyStepCount;
  const title = valid ? (text.stepTitles[step - 1] ?? '') : text.failed;

  if (contextQuery.isError || !valid) {
    return (
      <>
        <PageHeader size="work" title={title} />
        <ErrorState title={text.failed} />
      </>
    );
  }
  if (!contextQuery.data) {
    return (
      <>
        <PageHeader size="work" title={title} />
        <LoadingState label={text.loading} />
      </>
    );
  }
  if (!context) return <StrategyEntryPage groupId={groupId} />;
  const editable = context.editableSteps.includes(step);
  return (
    <>
      <StrategyGroupBar context={context} />
      <div className="flex flex-col gap-6">
        <StepProgress
          chip={text.flowChip}
          title={text.flowTitle}
          current={step}
          total={strategyStepCount}
          label={text.stepOf}
          steps={text.stepNames}
          stepTitle={text.stepNames[step - 1] ?? ''}
          stepStates={context.strategy.steps}
          stateLabels={text.states}
          hrefOf={(n) => strategyPath(groupId, n)}
          renderLink={routerLink}
          doneLabel={text.doneLabel}
          doneWhen={{ label: text.doneWhenLabel, text: text.doneWhen[step - 1] ?? '' }}
          actions={
            <>
              {step > 1 &&
                routerLink({
                  href: strategyPath(groupId, step - 1),
                  className: buttonVariants({ variant: 'secondary', size: 'sm' }),
                  children: text.back,
                })}
              {routerLink({
                href: step < strategyStepCount ? strategyPath(groupId, step + 1) : '/warengruppen',
                className: buttonVariants({ size: 'sm' }),
                children: step < strategyStepCount ? text.next : text.toOverview,
              })}
            </>
          }
        />
        <PageHeader size="work" title={title} purpose={text.stepPurposes[step - 1] ?? ''} />
        {!editable && (
          <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground text-sm">
            {text.readOnly}
          </p>
        )}
        {stepQuery.isError ? (
          <ErrorState title={text.failed} />
        ) : !stepQuery.data ? (
          <LoadingState label={text.loading} />
        ) : (
          <StepContent
            groupId={groupId}
            context={context}
            content={stepQuery.data}
            editable={editable}
          />
        )}
      </div>
    </>
  );
}

function useStepSave(context: StrategyContext, step: number) {
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const text = useT().strategy;
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (
    work: (token: string) => Promise<StrategyStep>,
    errors?: Record<string, string>,
  ) => {
    setBusy(true);
    setFailure(null);
    setMessage(null);
    try {
      queryClient.setQueryData(
        strategyStepQueryOptions(accessToken, context.strategy.id, step).queryKey,
        await work(accessToken),
      );
      await queryClient.invalidateQueries({
        queryKey: ['warengruppen', context.group.id, 'strategie'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['warengruppen', 'strategien'],
        exact: true,
      });
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

function StepContent({
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
  const text = useT().strategy;
  const views = [...new Set(content.questions.map((question) => question.view ?? ''))];
  const guide = (
    <div className="flex flex-col gap-4">
      {views.map((view) => (
        <GuideQuestions
          key={view || 'general'}
          title={view ? `${text.guide} · ${view}` : text.guide}
          questions={content.questions
            .filter((question) => (question.view ?? '') === view)
            .map((question) => question.text)}
        />
      ))}
    </div>
  );
  const note = (view = '', title = text.note, hint = text.noteHint) => (
    <NoteForm
      key={view}
      context={context}
      step={content.step}
      view={view}
      title={title}
      hint={hint}
      note={content.notes.find((entry) => entry.view === view)}
      editable={editable}
    />
  );
  // WG-10: Schritt 6 zeigt Profil, Paarungen und Hebelkatalog.
  if (content.step === 6) {
    return (
      <AssessmentSection
        groupId={groupId}
        context={context}
        content={content}
        editable={editable}
      />
    );
  }
  // WG-09: Schritt 5 zeigt die sechs Marktkräfte und die Zusammenschau.
  if (content.step === 5) {
    return <MarketSection context={context} content={content} editable={editable} />;
  }
  // WG-07: Schritte 3 und 4 zeigen die Sichten mit eigener Beobachtung je Sicht.
  if (content.step === 3 || content.step === 4) {
    return (
      <AnalysisSection groupId={groupId} context={context} content={content} editable={editable} />
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {/* WG-Ziele.dc.html: die Tabelle der Ziele über die ganze Breite, darunter Text und Leitfragen */}
      {content.step === 2 && <GoalsStep context={context} content={content} editable={editable} />}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {content.step === 1 && (
            <SetupStep groupId={groupId} context={context} content={content} editable={editable} />
          )}
          {content.step === 2 ? note('', text.goals.reasonTitle, text.goals.reasonHint) : note()}
          {content.step === 2 && note('beobachtung')}
        </div>
        <aside className="flex min-w-0 flex-col gap-4">
          {guide}
          {content.step === 2 && (
            <section className="rounded-lg bg-card p-5 shadow-card">
              <h2 className="font-semibold">{text.goals.fewTitle}</h2>
              <p className="text-muted-foreground text-sm">{text.goals.fewText}</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

export function NoteForm({
  context,
  step,
  view,
  title,
  hint,
  note,
  editable,
}: {
  context: StrategyContext;
  step: number;
  view: string;
  title: string;
  hint: string;
  note: StrategyStep['notes'][number] | undefined;
  editable: boolean;
}) {
  const text = useT().strategy;
  const save = useStepSave(context, step);
  const [value, setValue] = useState(note?.text ?? '');
  const [notApplicable, setNotApplicable] = useState(note?.notApplicable ?? false);
  const id = `note-${step}-${view || 'main'}`;
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-3 rounded-lg bg-card p-5 shadow-card"
    >
      <h2 id={id} className="font-semibold text-lg">
        {title}
      </h2>
      {!editable ? (
        <p className="whitespace-pre-line text-sm">{note?.text || '–'}</p>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void save.run((token) =>
              saveStrategyNote(token, context.strategy.id, step, {
                view,
                text: value,
                notApplicable,
              }),
            );
          }}
        >
          {save.message && <StatusLine message={save.message} onHidden={save.clear} />}
          {save.failure && <StatusLine message={save.failure} tone="warning" />}
          <FormField
            label={title}
            hint={notApplicable ? text.notApplicableHint : hint}
            className="[&>label]:sr-only"
          >
            {(field) => (
              <Textarea
                {...field}
                rows={5}
                maxLength={5000}
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            )}
          </FormField>
          {/* WG-07: auch je Sicht „nicht anwendbar“ mit Begründung */}
          {/* WG-09: Die Zusammenschau in Schritt 5 ist Pflicht, ohne „trifft nicht zu“ */}
          {step > 2 && step < 10 && view !== 'beobachtung' && !(step === 5 && view === '') && (
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="size-5 accent-petrol"
                checked={notApplicable}
                onChange={(event) => setNotApplicable(event.target.checked)}
              />
              {text.notApplicable}
            </label>
          )}
          <Button type="submit" variant="secondary" className="self-start" loading={save.busy}>
            {text.saveNote}
          </Button>
        </form>
      )}
    </section>
  );
}

/** Schritt 1 Aufsetzen (WG-Aufsetzen.dc.html): Team, Produktgruppen und nächste Meilensteine. */
function SetupStep({
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
  const text = useT().strategy;
  const format = useFormat();
  const accessToken = useToken();
  const group = useQuery({
    ...materialGroupDetailQueryOptions(accessToken, groupId),
    enabled: accessToken !== '',
  });
  const save = useStepSave(context, 1);
  const [milestone, setMilestone] = useState({ title: '', dueOn: '' });
  return (
    <>
      <p className="text-muted-foreground text-sm">{text.leadHint}</p>
      {content.leadSuggestion && (
        <p role="status" className="rounded-lg bg-mint-soft px-4 py-3 text-petrol-dark text-sm">
          {text.leadSuggestion(content.leadSuggestion.name, content.leadSuggestion.businessUnit)}
        </p>
      )}
      {group.data && <TeamSection data={group.data} />}
      {group.data && <ProductGroupsSection data={group.data} />}
      <p className="text-muted-foreground text-sm">{text.productHint}</p>
      <section aria-labelledby="wg-milestones" className="flex flex-col gap-3">
        <h2 id="wg-milestones" className="font-semibold text-lg">
          {text.milestones}
        </h2>
        {save.failure && <StatusLine message={save.failure} tone="warning" />}
        {content.milestones.length === 0 ? (
          <p className="text-muted-foreground">{text.milestonesEmpty}</p>
        ) : (
          <ListCard>
            <ul>
              {content.milestones.map((entry) => (
                <li key={entry.id}>
                  <ListRow>
                    <ListRowText title={entry.title} detail={format.date(entry.dueOn)} />
                    {editable && (
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={text.removeMilestone(entry.title)}
                        onClick={() =>
                          void save.run((token) =>
                            removeStrategyMilestone(token, context.strategy.id, entry.id),
                          )
                        }
                      >
                        ×
                      </Button>
                    )}
                  </ListRow>
                </li>
              ))}
            </ul>
          </ListCard>
        )}
        {editable && (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={async (event: FormEvent) => {
              event.preventDefault();
              const done = await save.run((token) =>
                addStrategyMilestone(token, context.strategy.id, milestone),
              );
              if (done) setMilestone({ title: '', dueOn: '' });
            }}
          >
            <FormField label={text.milestoneTitle} className="min-w-0 flex-1 basis-56">
              {(field) => (
                <Input
                  {...field}
                  value={milestone.title}
                  maxLength={200}
                  onChange={(event) => setMilestone({ ...milestone, title: event.target.value })}
                />
              )}
            </FormField>
            <FormField label={text.milestoneDate} className="basis-40">
              {(field) => (
                <Input
                  {...field}
                  type="date"
                  value={milestone.dueOn}
                  onChange={(event) => setMilestone({ ...milestone, dueOn: event.target.value })}
                />
              )}
            </FormField>
            <Button
              type="submit"
              variant="secondary"
              disabled={!milestone.title.trim() || !milestone.dueOn}
              loading={save.busy}
            >
              {text.addMilestone}
            </Button>
          </form>
        )}
      </section>
    </>
  );
}

const emptyGoal = (): GoalRequest => ({ kpiId: '', text: '', deferred: false, deferredReason: '' });

/** Schritt 2 Ziele (WG-Ziele.dc.html): Tabelle über fünf Dimensionen, Ziel hinzufügen, zurückstellen. */
function GoalsStep({
  context,
  content,
  editable,
}: {
  context: StrategyContext;
  content: StrategyStep;
  editable: boolean;
}) {
  const t = useT();
  const text = t.strategy.goals;
  const { locale } = useLocale();
  const save = useStepSave(context, 2);
  const [form, setForm] = useState<{ goal: GoalRequest; id?: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const kpi = (id: string) => content.kpis.find((entry) => entry.id === id);
  const dimensionName = (key: string) =>
    content.dimensions.find((entry) => entry.key === key)?.name ?? key;
  const value = (amount: number | null, unit: string | null | undefined) =>
    amount === null ? '–' : unit === '%' ? `${number.format(amount)} %` : number.format(amount);
  const ordered = content.dimensions.flatMap((dimension) =>
    content.goals.filter((goal) => goal.dimension === dimension.key),
  );
  const missing = content.dimensions.filter(
    (dimension) => !content.goals.some((goal) => goal.dimension === dimension.key),
  );
  const nextYear = context.strategy.year;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    const parsed = goalRequestSchema.safeParse(form.goal);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            text.errors[issue.message] ?? issue.message,
          ]),
        ),
      );
      return;
    }
    setErrors({});
    const done = await save.run(
      (token) => saveStrategyGoal(token, context.strategy.id, form.goal, form.id),
      text.errors,
    );
    if (done) setForm(null);
  };
  const edit = (goal: StrategyGoal) =>
    setForm({
      id: goal.id,
      goal: {
        kpiId: goal.kpiId,
        text: goal.text,
        actual: goal.actual,
        targetNextYear: goal.targetNextYear,
        targetFinal: goal.targetFinal,
        targetQuarter: goal.targetQuarter,
        targetYear: goal.targetYear,
        deferred: goal.deferred,
        deferredReason: goal.deferredReason ?? '',
      },
    });
  const numberField = (key: 'actual' | 'targetNextYear' | 'targetFinal', label: string) => (
    <FormField label={label} className="basis-32">
      {(field) => (
        <Input
          {...field}
          type="number"
          step="any"
          inputMode="decimal"
          value={form?.goal[key] ?? ''}
          onChange={(event) =>
            form &&
            setForm({
              ...form,
              goal: {
                ...form.goal,
                [key]: event.target.value === '' ? null : Number(event.target.value),
              },
            })
          }
        />
      )}
    </FormField>
  );

  return (
    <section aria-labelledby="wg-goals" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="wg-goals" className="font-semibold text-lg">
          {t.strategy.stepNames[1]}
        </h2>
        {editable && !form && (
          <Button variant="secondary" size="sm" onClick={() => setForm({ goal: emptyGoal() })}>
            <PlusIcon aria-hidden />
            {text.add}
          </Button>
        )}
      </div>
      {save.message && <StatusLine message={save.message} onHidden={save.clear} />}
      {save.failure && <StatusLine message={save.failure} tone="warning" />}
      {ordered.length === 0 ? (
        <p className="text-muted-foreground">{text.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <caption className="sr-only">{t.strategy.stepNames[1]}</caption>
            <TableHeader>
              <TableRow>
                <TableHead>{text.columns.dimension}</TableHead>
                <TableHead>{text.columns.goal}</TableHead>
                <TableHead>{text.columns.kpi}</TableHead>
                <TableHead className="text-right">{text.columns.actual}</TableHead>
                <TableHead className="text-right">{text.columns.nextYear(nextYear)}</TableHead>
                <TableHead className="text-right">{text.columns.final}</TableHead>
                <TableHead>{text.columns.due}</TableHead>
                {editable && <TableHead className="sr-only">{text.edit}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordered.map((goal) => {
                const unit = kpi(goal.kpiId)?.unit;
                return (
                  <TableRow
                    key={goal.id}
                    className={goal.deferred ? 'text-muted-foreground' : undefined}
                  >
                    <TableCell className="font-medium">{dimensionName(goal.dimension)}</TableCell>
                    {goal.deferred ? (
                      <TableCell colSpan={6}>
                        <Badge variant="neutral">{text.deferred}</Badge>{' '}
                        {`${kpi(goal.kpiId)?.name ?? ''} · ${goal.deferredReason ?? ''}`}
                      </TableCell>
                    ) : (
                      <>
                        <TableCell>{goal.text}</TableCell>
                        <TableCell>{kpi(goal.kpiId)?.name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {value(goal.actual, unit)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {value(goal.targetNextYear, unit)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {value(goal.targetFinal, unit)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {goal.targetYear
                            ? `${goal.targetQuarter ? `Q${goal.targetQuarter}/` : ''}${goal.targetYear}`
                            : '–'}
                        </TableCell>
                      </>
                    )}
                    {editable && (
                      <TableCell>
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={`${text.edit}: ${goal.deferred ? (kpi(goal.kpiId)?.name ?? '') : goal.text}`}
                          onClick={() => edit(goal)}
                        >
                          {text.edit}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {missing.length > 0 && ordered.length > 0 && (
        <p role="status" className="text-muted-foreground text-sm">
          {text.missing(missing.map((dimension) => dimension.name).join(', '))}
        </p>
      )}
      <p className="text-muted-foreground text-sm">{text.actualHint}</p>
      {form && (
        <form
          noValidate
          onSubmit={(event) => void submit(event)}
          className="flex flex-col gap-4 rounded-lg bg-card p-5 shadow-card"
        >
          <h3 className="font-semibold">{text.formTitle}</h3>
          <FormField label={text.kpi} hint={text.kpiHint} error={errors.kpiId}>
            {(field) => (
              <NativeSelect
                {...field}
                value={form.goal.kpiId}
                onChange={(event) =>
                  setForm({ ...form, goal: { ...form.goal, kpiId: event.target.value } })
                }
              >
                <option value="">{text.chooseKpi}</option>
                {content.dimensions.map((dimension) => (
                  <optgroup key={dimension.key} label={dimension.name}>
                    {content.kpis
                      .filter(
                        (entry) =>
                          entry.dimension === dimension.key &&
                          (entry.active || entry.id === form.goal.kpiId),
                      )
                      .map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              className="size-5 accent-petrol"
              checked={form.goal.deferred ?? false}
              onChange={(event) =>
                setForm({ ...form, goal: { ...form.goal, deferred: event.target.checked } })
              }
            />
            {text.defer}
          </label>
          {form.goal.deferred ? (
            <FormField label={text.deferredReason} error={errors.deferredReason}>
              {(field) => (
                <Textarea
                  {...field}
                  rows={2}
                  maxLength={1000}
                  value={form.goal.deferredReason ?? ''}
                  onChange={(event) =>
                    setForm({ ...form, goal: { ...form.goal, deferredReason: event.target.value } })
                  }
                />
              )}
            </FormField>
          ) : (
            <>
              <FormField label={text.text} error={errors.text}>
                {(field) => (
                  <Input
                    {...field}
                    maxLength={500}
                    value={form.goal.text ?? ''}
                    onChange={(event) =>
                      setForm({ ...form, goal: { ...form.goal, text: event.target.value } })
                    }
                  />
                )}
              </FormField>
              <div className="flex flex-wrap gap-3">
                {numberField('actual', text.actual)}
                {numberField('targetNextYear', text.targetNextYear)}
                {numberField('targetFinal', text.targetFinal)}
              </div>
              <div className="flex flex-wrap gap-3">
                <FormField label={text.quarter} className="basis-28">
                  {(field) => (
                    <NativeSelect
                      {...field}
                      value={form.goal.targetQuarter ?? ''}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          goal: {
                            ...form.goal,
                            targetQuarter: event.target.value ? Number(event.target.value) : null,
                          },
                        })
                      }
                    >
                      <option value="">–</option>
                      {[1, 2, 3, 4].map((quarter) => (
                        <option key={quarter} value={quarter}>
                          {`Q${quarter}`}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>
                <FormField label={text.year} className="basis-32">
                  {(field) => (
                    <Input
                      {...field}
                      type="number"
                      min={2000}
                      max={2100}
                      value={form.goal.targetYear ?? ''}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          goal: {
                            ...form.goal,
                            targetYear: event.target.value ? Number(event.target.value) : null,
                          },
                        })
                      }
                    />
                  )}
                </FormField>
              </div>
            </>
          )}
          <FormActions>
            {form.id && (
              <ConfirmButton
                question={text.removeQuestion}
                confirmLabel={text.remove}
                cancelLabel={text.cancel}
                onConfirm={async () => {
                  const id = form.id as string;
                  const done = await save.run((token) =>
                    removeStrategyGoal(token, context.strategy.id, id),
                  );
                  if (done) setForm(null);
                }}
              >
                {text.remove}
              </ConfirmButton>
            )}
            <Button type="button" variant="secondary" onClick={() => setForm(null)}>
              {text.cancel}
            </Button>
            <Button type="submit" loading={save.busy}>
              {text.save}
            </Button>
          </FormActions>
        </form>
      )}
    </section>
  );
}
