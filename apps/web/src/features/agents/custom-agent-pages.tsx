import type {
  CustomAgent,
  CustomAgentDetail,
  CustomAgentOptions,
  CustomAgentTool,
  CustomAgentTrigger,
  SaveCustomAgent,
} from '@reziproq/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { type FormEvent, useEffect, useState } from 'react';
import { AiDraft } from '@/components/ui/ai-draft';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { ErrorState } from '@/components/ui/error-state';
import { CheckboxGroup, FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ListCard, ListCardHeader } from '@/components/ui/list-card';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { NextStep, NextStepArrow } from '@/components/ui/next-step';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatusLine } from '@/components/ui/status-line';
import { StepRing } from '@/components/ui/step-ring';
import { Textarea } from '@/components/ui/textarea';
import { useToken } from '@/features/ratings/use-rating';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import {
  activateCustomAgent,
  agentRunQueryOptions,
  createCustomAgent,
  customAgentOptionsQueryOptions,
  customAgentQueryOptions,
  customAgentResultsQueryOptions,
  customAgentsQueryOptions,
  decideCustomAgentResult,
  deleteCustomAgent,
  pauseCustomAgent,
  reviewCustomAgent,
  startCustomAgent,
  updateCustomAgent,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';

/**
 * KI-09 Eigene Agenten (nach Vorlage docs/design/referenz/KI-Agenten.dc.html für die Liste, nach
 * Regeln für Anlegen und Seite des Agenten): fünf nummerierte Abschnitte, Testlauf mit echten
 * Daten, danach Aktivieren oder zur Freigabe senden. Ergebnisse sind Entwürfe von Reziproq und
 * zählen erst nach dem Übernehmen.
 */

// NAV-10 2.0: Die Liste der Agenten steht bis K1-f unter Mein Agent.
const home = '/mein-agent';
const pendingStatus = (status?: string) => status === 'queued' || status === 'running';
const codeOf = (error: unknown) => (error as { body?: { code?: string } } | null)?.body?.code;

function useCustomText() {
  const messages = useT();
  return { messages, t: messages.agents.custom };
}

/** Auslöser in einem Satz, z. B. „Montags 07:00“ */
function useTriggerText() {
  const { t } = useCustomText();
  return (trigger: CustomAgentTrigger): string => {
    if (trigger.kind === 'manual') return t.triggers.manual ?? '';
    if (trigger.kind === 'event') return t.events[trigger.event] ?? trigger.event;
    const schedule = trigger.schedule;
    return schedule.every === 'week'
      ? t.weekly_at(t.weekdays[schedule.weekday - 1] ?? '', schedule.time)
      : t.monthly_at(schedule.day, schedule.time);
  };
}

function statusVariant(status: CustomAgent['status']) {
  if (status === 'active') return 'success' as const;
  if (status === 'pending_approval') return 'warning' as const;
  return 'neutral' as const;
}

function AgentRow({ agent }: { agent: CustomAgent }) {
  const { messages, t } = useCustomText();
  const triggerText = useTriggerText();
  const meta = [
    triggerText(agent.config.trigger),
    agent.ownerName,
    agent.status === 'pending_approval' || agent.status === 'draft'
      ? agent.testPassed
        ? t.testPassed
        : t.testNone
      : messages.agents.runCount(agent.runCount),
  ].filter(Boolean);
  return (
    <li>
      <Link
        to="/einstellungen/ki/agenten/eigene/$id"
        params={{ id: agent.id }}
        className="flex min-h-11 flex-col gap-2 px-5 py-4 hover:bg-line-soft"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{agent.name}</span>
          <Badge>{t.own}</Badge>
          <Badge variant={statusVariant(agent.status)}>{t.status[agent.status]}</Badge>
        </span>
        <span className="line-clamp-2 text-muted-foreground text-sm">
          {agent.config.instructions}
        </span>
        <span className="flex flex-wrap gap-1.5">
          {agent.config.tools.map((tool) => (
            <Badge key={tool} variant="plain" className="bg-line-soft">
              {t.toolNames[tool]}
            </Badge>
          ))}
        </span>
        <span className="text-muted-foreground text-sm">{meta.join(' · ')}</span>
      </Link>
    </li>
  );
}

/** Abschnitt „Eure Agenten“ auf der Seite Agenten, darunter die Freigaben für Admins */
export function CustomAgentsSection() {
  const { t } = useCustomText();
  const token = useToken();
  const query = useQuery({ ...customAgentsQueryOptions(token), enabled: token !== '' });
  if (query.isError) return null;
  if (!query.data) return <LoadingState label={t.title} />;
  const { agents, canCreate, pendingApproval } = query.data;
  return (
    <>
      {pendingApproval.length > 0 && (
        <ListCard aria-label={t.pendingTitle}>
          <ListCardHeader title={t.pendingTitle} />
          <ul className="divide-y divide-line">
            {pendingApproval.map((agent) => (
              <AgentRow key={agent.id} agent={agent} />
            ))}
          </ul>
        </ListCard>
      )}
      <ListCard aria-label={t.title}>
        <ListCardHeader
          title={agents.length ? t.titleCount(agents.length) : t.title}
          action={
            canCreate && (
              <Link
                to="/einstellungen/ki/agenten/neu"
                className={buttonVariants({ variant: 'secondary' })}
              >
                {t.create}
              </Link>
            )
          }
        />
        {agents.length === 0 ? (
          <p className="px-5 pb-5 text-muted-foreground">{t.empty}</p>
        ) : (
          <ul className="divide-y divide-line">
            {agents.map((agent) => (
              <AgentRow key={agent.id} agent={agent} />
            ))}
          </ul>
        )}
      </ListCard>
    </>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <ListCard aria-label={title}>
      <ListCardHeader
        headingAs="h2"
        title={
          <span className="flex items-center gap-3">
            <StepRing size="sm" state="progress" number={number} doneLabel="" />
            {title}
          </span>
        }
      />
      <div className="flex flex-col gap-4 px-5 pb-5">{children}</div>
    </ListCard>
  );
}

const blank = (options: CustomAgentOptions, task?: string): SaveCustomAgent => ({
  name: '',
  instructions: task ?? '',
  tools: options.tools.slice(0, 1),
  trigger: { kind: 'manual' },
  scope: { kind: 'focus' },
  output: 'task',
  reviewer: 'me',
  budgetCents: Math.min(100, options.maxBudgetCents),
});

function AgentForm({
  options,
  initial,
  showStart,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  options: CustomAgentOptions;
  initial: SaveCustomAgent;
  showStart: boolean;
  busy: boolean;
  error: string | null;
  onSubmit: (value: SaveCustomAgent) => void;
  onCancel: () => void;
}) {
  const { t } = useCustomText();
  const format = useFormat();
  const [value, setValue] = useState(initial);
  const [budget, setBudget] = useState(String(initial.budgetCents / 100));
  const [start, setStart] = useState('');
  const set = (patch: Partial<SaveCustomAgent>) =>
    setValue((current) => ({ ...current, ...patch }));
  const trigger = value.trigger;
  const scope = value.scope;
  const budgetCents = Math.round(Number(budget.replace(',', '.')) * 100);
  const budgetOk = Number.isFinite(budgetCents) && budgetCents >= 1;
  const scopeOk =
    scope.kind === 'focus' ||
    (scope.kind === 'supplier' && scope.relationshipId !== '') ||
    (scope.kind === 'category' && scope.materialGroupId !== '');
  const valid =
    value.name.trim() !== '' && value.instructions.trim() !== '' && value.tools.length > 0;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid && budgetOk && scopeOk) onSubmit({ ...value, budgetCents });
  };
  return (
    <form className="flex min-w-0 flex-col gap-6" onSubmit={submit}>
      {error && <StatusLine message={error} tone="warning" />}
      <Section number={1} title={t.sections.task}>
        {showStart && options.templates.length > 0 && (
          <FormField label={t.startFrom}>
            {(props) => (
              <NativeSelect
                {...props}
                value={start}
                onChange={(event) => {
                  const template = options.templates.find(
                    (entry) => entry.key === event.target.value,
                  );
                  setStart(event.target.value);
                  set(
                    template
                      ? { name: template.name, instructions: template.instructions.slice(0, 2000) }
                      : { name: '', instructions: '' },
                  );
                }}
              >
                <option value="">{t.startBlank}</option>
                {options.templates.map((template) => (
                  <option key={template.key} value={template.key}>
                    {t.startTemplate(template.name)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
        )}
        <FormField label={t.name}>
          {(props) => (
            <Input
              {...props}
              value={value.name}
              maxLength={80}
              required
              onChange={(event) => set({ name: event.target.value })}
            />
          )}
        </FormField>
        <FormField label={t.instructions} hint={t.instructionsHint}>
          {(props) => (
            <Textarea
              {...props}
              rows={6}
              value={value.instructions}
              maxLength={2000}
              required
              onChange={(event) => set({ instructions: event.target.value })}
            />
          )}
        </FormField>
      </Section>

      <Section number={2} title={t.sections.data}>
        <CheckboxGroup<CustomAgentTool>
          legend={t.toolsLegend}
          options={options.tools.map((tool) => ({ value: tool, label: t.toolNames[tool] ?? tool }))}
          value={value.tools}
          onChange={(tools) => set({ tools })}
        />
        <p className="text-muted-foreground text-sm">{t.toolsHint}</p>
        <FormField label={t.scope}>
          {(props) => (
            <NativeSelect
              {...props}
              value={scope.kind}
              onChange={(event) => {
                const kind = event.target.value;
                set({
                  scope:
                    kind === 'supplier'
                      ? { kind, relationshipId: '' }
                      : kind === 'category'
                        ? { kind, materialGroupId: '' }
                        : { kind: 'focus' },
                });
              }}
            >
              {(['focus', 'supplier', 'category'] as const).map((kind) => (
                <option key={kind} value={kind}>
                  {t.scopes[kind]}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        {scope.kind === 'supplier' && (
          <FormField label={t.supplier}>
            {(props) => (
              <NativeSelect
                {...props}
                value={scope.relationshipId}
                onChange={(event) =>
                  set({ scope: { kind: 'supplier', relationshipId: event.target.value } })
                }
              >
                <option value="">{t.pickSupplier}</option>
                {options.suppliers.map((supplier) => (
                  <option key={supplier.relationshipId} value={supplier.relationshipId}>
                    {supplier.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
        )}
        {scope.kind === 'category' && (
          <FormField label={t.category}>
            {(props) => (
              <NativeSelect
                {...props}
                value={scope.materialGroupId}
                onChange={(event) =>
                  set({ scope: { kind: 'category', materialGroupId: event.target.value } })
                }
              >
                <option value="">{t.pickCategory}</option>
                {options.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
        )}
      </Section>

      <Section number={3} title={t.sections.trigger}>
        <SegmentedControl
          label={t.triggerLabel}
          value={trigger.kind}
          options={(['manual', 'schedule', 'event'] as const).map((kind) => ({
            value: kind,
            label: t.triggers[kind] ?? kind,
          }))}
          onChange={(kind) =>
            set({
              trigger:
                kind === 'manual'
                  ? { kind }
                  : kind === 'schedule'
                    ? { kind, schedule: { every: 'week', weekday: 1, time: '07:00' } }
                    : { kind, event: 'feedback_revealed' },
            })
          }
        />
        {trigger.kind === 'schedule' && (
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label={t.every}>
              {(props) => (
                <NativeSelect
                  {...props}
                  value={trigger.schedule.every}
                  onChange={(event) =>
                    set({
                      trigger: {
                        kind: 'schedule',
                        schedule:
                          event.target.value === 'month'
                            ? { every: 'month', day: 1, time: trigger.schedule.time }
                            : { every: 'week', weekday: 1, time: trigger.schedule.time },
                      },
                    })
                  }
                >
                  <option value="week">{t.weekly}</option>
                  <option value="month">{t.monthly}</option>
                </NativeSelect>
              )}
            </FormField>
            {trigger.schedule.every === 'week' ? (
              <FormField label={t.weekday}>
                {(props) => (
                  <NativeSelect
                    {...props}
                    value={trigger.schedule.every === 'week' ? trigger.schedule.weekday : 1}
                    onChange={(event) =>
                      set({
                        trigger: {
                          kind: 'schedule',
                          schedule: {
                            every: 'week',
                            weekday: Number(event.target.value),
                            time: trigger.schedule.time,
                          },
                        },
                      })
                    }
                  >
                    {t.weekdays.map((day, index) => (
                      <option key={day} value={index + 1}>
                        {day}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            ) : (
              <FormField label={t.dayOfMonth}>
                {(props) => (
                  <NativeSelect
                    {...props}
                    value={trigger.schedule.every === 'month' ? trigger.schedule.day : 1}
                    onChange={(event) =>
                      set({
                        trigger: {
                          kind: 'schedule',
                          schedule: {
                            every: 'month',
                            day: Number(event.target.value),
                            time: trigger.schedule.time,
                          },
                        },
                      })
                    }
                  >
                    {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}.
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            )}
            <FormField label={t.time}>
              {(props) => (
                <Input
                  {...props}
                  type="time"
                  value={trigger.schedule.time}
                  required
                  onChange={(event) =>
                    set({
                      trigger: {
                        kind: 'schedule',
                        schedule: { ...trigger.schedule, time: event.target.value },
                      },
                    })
                  }
                />
              )}
            </FormField>
          </div>
        )}
        {trigger.kind === 'event' && (
          <FormField label={t.event}>
            {(props) => (
              <NativeSelect
                {...props}
                value={trigger.event}
                onChange={(event) =>
                  set({
                    trigger: {
                      kind: 'event',
                      event: event.target.value as typeof trigger.event,
                    },
                  })
                }
              >
                {Object.entries(t.events).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
        )}
        {trigger.kind !== 'manual' && options.approvalRequired && (
          <p className="text-muted-foreground text-sm">{t.approvalNote}</p>
        )}
      </Section>

      <Section number={4} title={t.sections.output}>
        <FormField label={t.outputLabel}>
          {(props) => (
            <NativeSelect
              {...props}
              value={value.output}
              onChange={(event) => set({ output: event.target.value as SaveCustomAgent['output'] })}
            >
              {(['task', 'action', 'note'] as const).map((output) => (
                <option key={output} value={output}>
                  {t.outputs[output]}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </Section>

      <Section number={5} title={t.sections.review}>
        <FormField label={t.reviewer}>
          {(props) => (
            <NativeSelect
              {...props}
              value={value.reviewer}
              onChange={(event) =>
                set({ reviewer: event.target.value as SaveCustomAgent['reviewer'] })
              }
            >
              <option value="me">{t.reviewers.me}</option>
              <option value="sro">{t.reviewers.sro}</option>
            </NativeSelect>
          )}
        </FormField>
        <FormField
          label={t.budget}
          hint={t.budgetHint(
            format.money({ amountCents: options.maxBudgetCents, currency: 'EUR' }),
          )}
        >
          {(props) => (
            <Input
              {...props}
              inputMode="decimal"
              value={budget}
              required
              onChange={(event) => setBudget(event.target.value)}
            />
          )}
        </FormField>
      </Section>

      <FormActions>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t.cancel}
        </Button>
        <Button type="submit" loading={busy} disabled={!valid || !budgetOk || !scopeOk}>
          {t.saveAndTest}
        </Button>
      </FormActions>
    </form>
  );
}

function TestIntro() {
  const { t } = useCustomText();
  return (
    <ListCard aria-label={t.testTitle}>
      <ListCardHeader title={t.testTitle} />
      <p className="px-5 pb-5 text-muted-foreground">{t.testIntro}</p>
    </ListCard>
  );
}

/** /einstellungen/ki/agenten/neu: Leer, aus einer Vorlage oder aus einer Frage (?aufgabe=) */
export function CustomAgentNewPage({ task }: { task?: string | undefined }) {
  const { messages, t } = useCustomText();
  const token = useToken();
  const navigate = useNavigate();
  const client = useQueryClient();
  const options = useQuery({ ...customAgentOptionsQueryOptions(token), enabled: token !== '' });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async (input: SaveCustomAgent) => {
      const agent = await createCustomAgent(token, input);
      // Gesperrte Aufgaben (Personenbewertung) speichern, aber nicht testen
      if (!agent.blockedReason) await startCustomAgent(token, agent.id, true).catch(() => null);
      return agent;
    },
    onSuccess: (agent) => {
      void client.invalidateQueries({ queryKey: ['ki', 'eigene-agenten'] });
      void navigate({ to: '/einstellungen/ki/agenten/eigene/$id', params: { id: agent.id } });
    },
    onError: (failure) => setError(t.errors[codeOf(failure) ?? ''] ?? t.saveFailed),
  });
  return (
    <>
      <PagePath
        trail={[
          { label: messages.aiSettings.navTitle, href: '/einstellungen/ki' },
          { label: messages.agents.title, href: home },
        ]}
        current={t.create}
      />
      <PageHeader title={t.newTitle} purpose={t.newPurpose} />
      {options.isError ? (
        <ErrorState title={t.errors.keine_berechtigung ?? messages.agents.failed} />
      ) : !options.data ? (
        <LoadingState label={messages.agents.loading} />
      ) : (
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <AgentForm
              options={options.data}
              initial={blank(options.data, task?.slice(0, 2000))}
              showStart
              busy={save.isPending}
              error={error}
              onSubmit={(input) => {
                setError(null);
                save.mutate(input);
              }}
              onCancel={() => void navigate({ to: home })}
            />
          </div>
          <aside className="flex min-w-0 flex-col gap-6">
            <TestIntro />
          </aside>
        </div>
      )}
    </>
  );
}

/** Ergebnisse eines Laufs als Entwürfe von Reziproq; außerhalb von Testläufen übernehmen/verwerfen */
export function CustomRunResults({ runId, headingAs }: { runId: string; headingAs?: 'h2' | 'h3' }) {
  const { messages, t } = useCustomText();
  const token = useToken();
  const client = useQueryClient();
  const options = customAgentResultsQueryOptions(token, runId);
  const query = useQuery({ ...options, enabled: token !== '' });
  const decide = useMutation({
    mutationFn: ({ draftId, accept }: { draftId: string; accept: boolean }) =>
      decideCustomAgentResult(token, draftId, accept),
    onSuccess: () => client.invalidateQueries({ queryKey: options.queryKey }),
  });
  if (query.isError) return <ErrorState title={messages.agents.failed} />;
  if (!query.data) return <LoadingState label={messages.agents.loading} />;
  const results = query.data.results;
  return (
    <section aria-label={t.results} className="flex min-w-0 flex-col gap-4">
      {headingAs === 'h2' && (
        <h2 className="font-display font-semibold text-section tracking-section">{t.results}</h2>
      )}
      {decide.isError && (
        <StatusLine message={t.errors[codeOf(decide.error) ?? ''] ?? t.saveFailed} tone="warning" />
      )}
      {results.length === 0 ? (
        <p className="text-muted-foreground">{t.noResults}</p>
      ) : (
        results.map((result) => (
          <AiDraft
            key={result.draftId ?? result.relationshipId}
            heading={t.resultHeading(result.supplier)}
            sourcesLabel={messages.agents.sources}
            sources={[
              {
                key: result.relationshipId,
                label: result.supplier,
                href: `/lieferanten/${result.relationshipId}`,
              },
            ]}
            confirmed={result.status === 'accepted'}
            actions={
              query.data.canAccept && result.draftId && result.status === 'draft' ? (
                <>
                  <Button
                    disabled={decide.isPending}
                    onClick={() =>
                      result.draftId && decide.mutate({ draftId: result.draftId, accept: true })
                    }
                  >
                    {t.accept}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={decide.isPending}
                    onClick={() =>
                      result.draftId && decide.mutate({ draftId: result.draftId, accept: false })
                    }
                  >
                    {t.discard}
                  </Button>
                </>
              ) : result.status && result.status !== 'draft' ? (
                <Badge variant={result.status === 'accepted' ? 'success' : 'neutral'}>
                  {result.status === 'accepted' ? t.accepted : t.discarded}
                </Badge>
              ) : null
            }
          >
            <p className="font-semibold">{result.title}</p>
            <p className="whitespace-pre-wrap">{result.text}</p>
          </AiDraft>
        ))
      )}
    </section>
  );
}

function TestPanel({ agent, runId }: { agent: CustomAgentDetail; runId: string | null }) {
  const { messages, t } = useCustomText();
  const format = useFormat();
  const token = useToken();
  const client = useQueryClient();
  const run = useQuery({
    ...agentRunQueryOptions(token, runId ?? ''),
    enabled: token !== '' && runId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.run.status;
      if (pendingStatus(status)) return 1500;
      return false;
    },
  });
  const status = run.data?.run.status;
  const finished = runId !== null && status !== undefined && !pendingStatus(status);
  // Nach dem Ende des Testlaufs den Stand des Agenten (Testlauf bestanden) neu laden
  useEffect(() => {
    if (finished) void client.invalidateQueries({ queryKey: ['ki', 'eigene-agenten'] });
  }, [finished, client]);
  return (
    <ListCard aria-label={t.testTitle}>
      <ListCardHeader
        title={t.testTitle}
        action={agent.testPassed && <Badge variant="success">{t.testPassed}</Badge>}
      />
      <div className="flex flex-col gap-4 px-5 pb-5">
        {!runId ? (
          <p className="text-muted-foreground">{t.testNone}</p>
        ) : !run.data || pendingStatus(status) ? (
          <LoadingState label={t.testRunning} />
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              <Link
                to="/einstellungen/ki/agenten/laeufe/$id"
                params={{ id: runId }}
                className="font-semibold text-petrol underline"
              >
                {messages.agents.status[run.data.run.status]}
              </Link>{' '}
              ·{' '}
              {t.costs(
                format.money({ amountCents: run.data.run.costCents, currency: 'EUR' }),
                messages.agents.stepCount(run.data.run.stepsUsed),
              )}
            </p>
            {status === 'done' ? (
              <CustomRunResults runId={runId} />
            ) : (
              <StatusLine message={t.testFailed} tone="warning" />
            )}
          </>
        )}
      </div>
    </ListCard>
  );
}

/** Die eine Hauptaktion je Stand des Agenten */
function AgentNextStep({
  agent,
  busy,
  onTest,
  onActivate,
  onApprove,
  onRun,
  onEdit,
}: {
  agent: CustomAgent;
  busy: boolean;
  onTest: () => void;
  onActivate: () => void;
  onApprove: () => void;
  onRun: () => void;
  onEdit: () => void;
}) {
  const { messages, t } = useCustomText();
  const hero = (label: string, onClick: () => void) => (
    <Button variant="mint" size="hero" loading={busy} onClick={onClick}>
      {label}
      <NextStepArrow />
    </Button>
  );
  const eyebrow = messages.agents.nextStep;
  if (agent.canApprove)
    return (
      <NextStep
        eyebrow={eyebrow}
        title={t.next.review}
        text={t.next.reviewText(agent.ownerName)}
        action={hero(t.approve, onApprove)}
      />
    );
  if (agent.status === 'pending_approval')
    return <NextStep eyebrow={eyebrow} title={t.next.waiting} />;
  if (agent.status === 'active')
    return agent.canStart ? (
      <NextStep
        eyebrow={eyebrow}
        title={t.next.run}
        text={t.next.runText}
        action={hero(t.runNow, onRun)}
      />
    ) : null;
  if (!agent.isOwn) return null;
  if (agent.blockedReason)
    return (
      <NextStep
        eyebrow={eyebrow}
        title={t.next.fix}
        text={agent.blockedReason}
        action={hero(t.edit, onEdit)}
      />
    );
  if (!agent.testPassed)
    return (
      <NextStep
        eyebrow={eyebrow}
        title={t.next.test}
        text={t.next.testText}
        action={hero(t.startTest, onTest)}
      />
    );
  return agent.needsApproval ? (
    <NextStep
      eyebrow={eyebrow}
      title={t.next.submit}
      text={t.next.submitText}
      action={hero(t.submit, onActivate)}
    />
  ) : (
    <NextStep
      eyebrow={eyebrow}
      title={t.next.activate}
      text={agent.status === 'paused' ? t.next.pausedText : t.next.activateText}
      action={hero(t.activate, onActivate)}
    />
  );
}

function ConfigSummary({
  agent,
  options,
}: {
  agent: CustomAgent;
  options?: CustomAgentOptions | undefined;
}) {
  const { t } = useCustomText();
  const format = useFormat();
  const triggerText = useTriggerText();
  const scope = agent.config.scope;
  const scopeText: string =
    scope.kind === 'focus'
      ? (t.scopes.focus ?? '')
      : scope.kind === 'supplier'
        ? (options?.suppliers.find((entry) => entry.relationshipId === scope.relationshipId)
            ?.name ??
          t.scopes.supplier ??
          '')
        : (options?.categories.find((entry) => entry.id === scope.materialGroupId)?.name ??
          t.scopes.category ??
          '');
  const rows: [string, string][] = [
    [t.toolsLegend, agent.config.tools.map((tool) => t.toolNames[tool] ?? tool).join(', ')],
    [t.scope, scopeText],
    [t.triggerLabel, triggerText(agent.config.trigger)],
    [t.outputLabel, t.outputs[agent.config.output] ?? agent.config.output],
    [t.reviewer, t.reviewers[agent.config.reviewer] ?? agent.config.reviewer],
    [t.budget, format.money({ amountCents: agent.config.budgetCents, currency: 'EUR' })],
    [t.owner, agent.ownerName],
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-muted-strong text-sm">{t.instructions}</p>
        <p className="whitespace-pre-wrap break-words">{agent.config.instructions}</p>
      </div>
      <dl className="flex flex-col">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col gap-1 border-line-soft border-t py-2.5 sm:flex-row sm:justify-between sm:gap-4"
          >
            <dt className="shrink-0 font-semibold text-muted-strong text-sm">{label}</dt>
            <dd className="min-w-0 whitespace-pre-wrap break-words sm:text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** /einstellungen/ki/agenten/eigene/$id */
export function CustomAgentPage({ id }: { id: string }) {
  const { messages, t } = useCustomText();
  const format = useFormat();
  const token = useToken();
  const client = useQueryClient();
  const navigate = useNavigate();
  const options = customAgentQueryOptions(token, id);
  const query = useQuery({ ...options, enabled: token !== '' });
  const choices = useQuery({
    ...customAgentOptionsQueryOptions(token),
    enabled: token !== '' && query.data?.isOwn === true,
  });
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState('');
  const [testRun, setTestRun] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const refresh = () => client.invalidateQueries({ queryKey: ['ki', 'eigene-agenten'] });
  const act = useMutation({
    mutationFn: async (
      work:
        | { kind: 'test' | 'run' | 'activate' | 'pause' | 'approve' | 'delete' }
        | { kind: 'return'; comment: string }
        | { kind: 'save'; input: SaveCustomAgent },
    ) => {
      switch (work.kind) {
        case 'test':
          return { test: (await startCustomAgent(token, id, true)).runId };
        case 'run':
          return { run: (await startCustomAgent(token, id, false)).runId };
        case 'activate':
          return { agent: await activateCustomAgent(token, id) };
        case 'pause':
          return { agent: await pauseCustomAgent(token, id) };
        case 'approve':
          return { agent: await reviewCustomAgent(token, id, { decision: 'approve' }) };
        case 'return':
          return {
            agent: await reviewCustomAgent(token, id, {
              decision: 'return',
              comment: work.comment,
            }),
          };
        case 'delete':
          await deleteCustomAgent(token, id);
          return { deleted: true };
        case 'save': {
          const agent = await updateCustomAgent(token, id, work.input);
          const test = agent.blockedReason
            ? undefined
            : await startCustomAgent(token, id, true).then(
                (started) => started.runId,
                () => undefined,
              );
          return { agent, test };
        }
      }
    },
    onMutate: () => setMessage(null),
    onSuccess: (result) => {
      if ('deleted' in result) {
        void refresh();
        void navigate({ to: home });
        return;
      }
      if ('run' in result && result.run) {
        void navigate({ to: '/einstellungen/ki/agenten/laeufe/$id', params: { id: result.run } });
        return;
      }
      if ('test' in result && result.test) setTestRun(result.test);
      if ('agent' in result) setEditing(false);
      setComment('');
      void refresh();
    },
    onError: (failure) => setMessage(t.errors[codeOf(failure) ?? ''] ?? t.saveFailed),
  });
  const agent = query.data;
  const latestTest =
    testRun ?? agent?.runs.find((run) => run.isTest && run.version === agent.version)?.id ?? null;
  return (
    <>
      <PagePath
        trail={[
          { label: messages.aiSettings.navTitle, href: '/einstellungen/ki' },
          { label: messages.agents.title, href: home },
        ]}
        current={agent?.name ?? t.own}
      />
      {query.isError ? (
        <>
          <PageHeader title={t.own} />
          <ErrorState title={t.notFound} />
        </>
      ) : !agent ? (
        <LoadingState label={messages.agents.loading} />
      ) : (
        <>
          <PageHeader
            title={editing ? t.editTitle(agent.name) : agent.name}
            purpose={`${t.own} · ${agent.ownerName} · ${messages.agents.version(agent.version)}`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(agent.status)}>{t.status[agent.status]}</Badge>
            {agent.testPassed && <Badge variant="success">{t.testPassed}</Badge>}
          </div>
          {message && <StatusLine message={message} tone="warning" />}
          {agent.blockedReason && (
            <StatusLine message={t.blocked(agent.blockedReason)} tone="warning" />
          )}
          {agent.reviewComment && agent.status === 'draft' && (
            <StatusLine message={t.returned(agent.reviewComment)} tone="warning" />
          )}
          {agent.status === 'paused' && agent.pausedReason && (
            <StatusLine
              message={t.pausedReasons[agent.pausedReason] ?? agent.pausedReason}
              tone="warning"
            />
          )}
          {!editing && (
            <AgentNextStep
              agent={agent}
              busy={act.isPending}
              onTest={() => act.mutate({ kind: 'test' })}
              onActivate={() => act.mutate({ kind: 'activate' })}
              onApprove={() => act.mutate({ kind: 'approve' })}
              onRun={() => act.mutate({ kind: 'run' })}
              onEdit={() => setEditing(true)}
            />
          )}
          {editing && choices.data ? (
            <div className="grid min-w-0 items-start gap-6 lg:grid-cols-3">
              <div className="min-w-0 lg:col-span-2">
                <AgentForm
                  options={choices.data}
                  initial={agent.config}
                  showStart={false}
                  busy={act.isPending}
                  error={null}
                  onSubmit={(input) => act.mutate({ kind: 'save', input })}
                  onCancel={() => setEditing(false)}
                />
              </div>
              <aside className="flex min-w-0 flex-col gap-6">
                <TestIntro />
              </aside>
            </div>
          ) : (
            <div className="grid min-w-0 items-start gap-6 lg:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                <ListCard aria-label={t.settings}>
                  <ListCardHeader title={t.settings} />
                  <div className="flex flex-col gap-4 px-5 pb-5">
                    <ConfigSummary agent={agent} options={choices.data} />
                    <div className="flex flex-wrap gap-2">
                      {agent.canEdit && (
                        <Button variant="secondary" onClick={() => setEditing(true)}>
                          {t.edit}
                        </Button>
                      )}
                      {agent.isOwn && agent.testPassed && agent.status === 'active' && (
                        <Button
                          variant="secondary"
                          disabled={act.isPending}
                          onClick={() => act.mutate({ kind: 'test' })}
                        >
                          {t.testAgain}
                        </Button>
                      )}
                      {(agent.status === 'active' || agent.status === 'pending_approval') &&
                        (agent.isOwn || agent.canApprove) && (
                          <Button
                            variant="secondary"
                            disabled={act.isPending}
                            onClick={() => act.mutate({ kind: 'pause' })}
                          >
                            {t.pause}
                          </Button>
                        )}
                      {agent.isOwn && (
                        <ConfirmButton
                          question={t.removeQuestion}
                          confirmLabel={t.removeConfirm}
                          cancelLabel={t.cancel}
                          variant="destructive"
                          onConfirm={() => act.mutate({ kind: 'delete' })}
                        >
                          {t.remove}
                        </ConfirmButton>
                      )}
                    </div>
                  </div>
                </ListCard>
                {agent.canApprove && (
                  <ListCard aria-label={t.giveBack}>
                    <ListCardHeader title={t.giveBack} />
                    <form
                      className="flex flex-col gap-3 px-5 pb-5"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (comment.trim()) act.mutate({ kind: 'return', comment: comment.trim() });
                      }}
                    >
                      <FormField label={t.comment}>
                        {(props) => (
                          <Textarea
                            {...props}
                            rows={3}
                            maxLength={1000}
                            value={comment}
                            onChange={(event) => setComment(event.target.value)}
                          />
                        )}
                      </FormField>
                      <Button
                        type="submit"
                        variant="secondary"
                        className="self-start"
                        disabled={!comment.trim() || act.isPending}
                      >
                        {t.giveBack}
                      </Button>
                    </form>
                  </ListCard>
                )}
                <ListCard aria-label={t.runs}>
                  <ListCardHeader title={t.runs} />
                  {agent.runs.length === 0 ? (
                    <p className="px-5 pb-5 text-muted-foreground">{t.noRuns}</p>
                  ) : (
                    <ul className="divide-y divide-line">
                      {agent.runs.map((run) => (
                        <li key={run.id}>
                          <Link
                            to="/einstellungen/ki/agenten/laeufe/$id"
                            params={{ id: run.id }}
                            className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-line-soft"
                          >
                            <span className="font-medium">
                              {messages.agents.version(run.version)}{' '}
                              <span className="text-muted-foreground text-sm">
                                {format.dateTime(run.createdAt)}
                                {run.startedBy ? ` · ${run.startedBy}` : ''}
                              </span>
                            </span>
                            <span className="flex flex-wrap gap-2">
                              {run.isTest && <Badge>{t.testBadge}</Badge>}
                              <Badge>
                                {messages.agents.status[
                                  run.status as keyof typeof messages.agents.status
                                ] ?? run.status}
                              </Badge>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </ListCard>
              </div>
              <aside className="flex min-w-0 flex-col gap-6">
                {agent.isOwn && <TestPanel agent={agent} runId={latestTest} />}
              </aside>
            </div>
          )}
        </>
      )}
    </>
  );
}
