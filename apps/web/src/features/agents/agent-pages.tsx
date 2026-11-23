import type { AgentRun } from '@reziproq/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { ListCard, ListCardHeader } from '@/components/ui/list-card';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { NextStep, NextStepArrow } from '@/components/ui/next-step';
import { Textarea } from '@/components/ui/textarea';
import { UsageCard } from '@/features/ai-gateway/ai-settings-page';
import { useToken } from '@/features/ratings/use-rating';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { useSuppliers } from '@/features/suppliers/use-suppliers';
import {
  activateAgent,
  actOnAgentRun,
  agentQueryOptions,
  agentRunQueryOptions,
  agentsQueryOptions,
  meetingListQueryOptions,
  startAgent,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { CustomAgentsSection, CustomRunResults } from './custom-agent-pages';

const home = '/einstellungen/ki/agenten';
const pending = (run?: AgentRun) => run?.status === 'queued' || run?.status === 'running';

function AgentRunList({ title, runs }: { title: string; runs: AgentRun[] }) {
  const t = useT().agents;
  const format = useFormat();
  return (
    <ListCard aria-label={title}>
      <ListCardHeader title={title} />
      {runs.length === 0 ? (
        <p className="px-5 pb-5 text-muted-foreground">{t.noRuns}</p>
      ) : (
        <ul className="divide-y divide-line">
          {runs.map((run) => (
            <li key={run.id}>
              <Link
                to="/einstellungen/ki/agenten/laeufe/$id"
                params={{ id: run.id }}
                className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-line-soft"
              >
                <span className="font-medium">
                  {run.custom ? run.agentName : t.qbrName}{' '}
                  <span className="text-muted-foreground text-sm">
                    {format.date(run.createdAt)}
                  </span>
                </span>
                <Badge>{t.status[run.status]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ListCard>
  );
}

export function AgentsPage() {
  const messages = useT();
  const t = messages.agents;
  const token = useToken();
  const query = useQuery({ ...agentsQueryOptions(token), enabled: token !== '' });
  return (
    <>
      <PagePath
        trail={[{ label: messages.aiSettings.navTitle, href: '/einstellungen/ki' }]}
        current={t.title}
      />
      <PageHeader title={t.title} purpose={t.purpose} />
      {query.isError ? (
        <ErrorState title={t.failed} />
      ) : !query.data ? (
        <LoadingState label={t.loading} />
      ) : (
        <>
          {query.data.nextRunId && (
            <NextStep
              eyebrow={t.nextStep}
              title={t.openDraft}
              action={
                <Link
                  to="/einstellungen/ki/agenten/laeufe/$id"
                  params={{ id: query.data.nextRunId }}
                  className={buttonVariants({ variant: 'mint', size: 'hero' })}
                >
                  {t.run}
                  <NextStepArrow />
                </Link>
              }
            />
          )}
          <div className="grid min-w-0 items-start gap-6 lg:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
              <ListCard aria-label={t.builtin}>
                <ListCardHeader title={t.builtin} />
                <ul className="divide-y divide-line">
                  {query.data.agents.map((agent) => (
                    <li key={agent.id}>
                      <Link
                        to="/einstellungen/ki/agenten/$id"
                        params={{ id: agent.id }}
                        className="flex min-h-11 flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-line-soft"
                      >
                        <div>
                          <p className="font-semibold">{t.qbrName}</p>
                          <p className="text-muted-foreground text-sm">{t.qbrDescription}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>{t.runCount(agent.runCount)}</span>
                          <Badge>{agent.enabled ? t.enabled : t.disabled}</Badge>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </ListCard>
              <CustomAgentsSection />
            </div>
            <aside className="flex min-w-0 flex-col gap-6">
              <AgentRunList title={t.recent} runs={query.data.recentRuns} />
              <UsageCard />
            </aside>
          </div>
        </>
      )}
    </>
  );
}

function StartForm({ id, token }: { id: string; token: string }) {
  const t = useT().agents;
  const format = useFormat();
  const suppliers = useSuppliers();
  const [relationshipId, setRelationship] = useState('');
  const [meetingId, setMeeting] = useState('');
  const navigate = useNavigate();
  const meetings = useQuery({
    ...meetingListQueryOptions(token, `/suppliers/${relationshipId}`),
    enabled: relationshipId !== '' && token !== '',
  });
  // KI-07: Das Termin-Briefing bereitet jeden Termin mit Lieferant vor, nicht nur den QBR.
  const qbrs = [...(meetings.data?.upcoming ?? []), ...(meetings.data?.past ?? [])];
  const run = useMutation({
    mutationFn: (isTest: boolean) => startAgent(token, id, { relationshipId, meetingId, isTest }),
    onSuccess: ({ run }) =>
      navigate({ to: '/einstellungen/ki/agenten/laeufe/$id', params: { id: run.id } }),
  });
  return (
    <ListCard aria-label={t.start}>
      <ListCardHeader title={t.start} />
      <div className="flex flex-col gap-4 px-5 pb-5">
        {suppliers.isError || meetings.isError || run.isError ? (
          <ErrorState title={t.startFailed} />
        ) : null}
        <FormField label={t.supplier}>
          {(props) => (
            <NativeSelect
              {...props}
              value={relationshipId}
              onChange={(event) => {
                setRelationship(event.target.value);
                setMeeting('');
                run.reset();
              }}
            >
              <option value="">{t.pickSupplier}</option>
              {suppliers.data?.suppliers
                .filter((supplier) => supplier.status !== 'ended')
                .map((supplier) => (
                  <option key={supplier.relationshipId} value={supplier.relationshipId}>
                    {supplier.name}
                  </option>
                ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField label={t.meeting}>
          {(props) => (
            <NativeSelect
              {...props}
              value={meetingId}
              disabled={!relationshipId || meetings.isPending}
              onChange={(event) => {
                setMeeting(event.target.value);
                run.reset();
              }}
            >
              <option value="">
                {relationshipId && meetings.data && !qbrs.length ? t.noMeetings : t.pickMeeting}
              </option>
              {qbrs.map((meeting) => (
                <option key={meeting.id} value={meeting.id}>
                  {meeting.title} · {format.date(meeting.startsAt)}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!meetingId || run.isPending} onClick={() => run.mutate(false)}>
            {t.start}
          </Button>
          <Button
            disabled={!meetingId || run.isPending}
            variant="secondary"
            onClick={() => run.mutate(true)}
          >
            {t.test}
          </Button>
        </div>
      </div>
    </ListCard>
  );
}

export function AgentPage({ id }: { id: string }) {
  const t = useT().agents;
  const token = useToken();
  const client = useQueryClient();
  const options = agentQueryOptions(token, id);
  const query = useQuery({ ...options, enabled: token !== '' });
  const change = useMutation({
    mutationFn: (enabled: boolean) => activateAgent(token, id, enabled),
    onSuccess: (data) => {
      client.setQueryData(options.queryKey, data);
      void client.invalidateQueries({ queryKey: ['agents'] });
    },
  });
  return (
    <>
      <PagePath trail={[{ label: t.title, href: home }]} current={t.qbrName} />
      <PageHeader title={t.qbrName} purpose={t.qbrDescription} />
      {query.isError ? (
        <ErrorState title={t.failed} />
      ) : !query.data ? (
        <LoadingState label={t.loading} />
      ) : (
        <>
          <ListCard aria-label={t.settings}>
            <ListCardHeader title={t.settings} />
            <div className="flex flex-col gap-3 px-5 pb-5">
              <p>
                {t.version(query.data.agent.version)} · {t.trigger[query.data.trigger]}
              </p>
              <p>
                {t.tools} ·{' '}
                {query.data.tools
                  .map((key) =>
                    key === 'qbr_facts'
                      ? t.qbrFacts
                      : key === 'supplier_context'
                        ? t.supplierContext
                        : key,
                  )
                  .join(', ')}
              </p>
              <p>{query.data.agent.enabled ? t.enabled : t.disabled}</p>
              {change.isError && <ErrorState title={t.failed} />}
              {query.data.canManage && (
                <Button
                  className="self-start"
                  variant="secondary"
                  disabled={change.isPending}
                  onClick={() => change.mutate(!query.data?.agent.enabled)}
                >
                  {query.data.agent.enabled ? t.disable : t.enable}
                </Button>
              )}
            </div>
          </ListCard>
          {query.data.agent.enabled && <StartForm id={id} token={token} />}
          <AgentRunList title={t.recent} runs={query.data.runs} />
        </>
      )}
    </>
  );
}

export function AgentRunPage({ id }: { id: string }) {
  const t = useT().agents;
  const format = useFormat();
  const token = useToken();
  const client = useQueryClient();
  const options = agentRunQueryOptions(token, id);
  const query = useQuery({
    ...options,
    enabled: token !== '',
    refetchInterval: (query) => (pending(query.state.data?.run) ? 2000 : false),
  });
  const [answer, setAnswer] = useState('');
  const action = useMutation({
    mutationFn: ({ value, reply }: { value: 'abbrechen' | 'fortsetzen'; reply?: string }) =>
      actOnAgentRun(token, id, value, reply ? { answer: reply } : {}),

    onSuccess: (data) => {
      client.setQueryData(options.queryKey, data);
      setAnswer('');
    },
  });
  const data = query.data;
  return (
    <>
      <PagePath trail={[{ label: t.title, href: home }]} current={t.run} />
      <PageHeader title={t.run} purpose={data?.run.custom ? data.run.agentName : t.qbrName} />
      {query.isError ? (
        <ErrorState title={t.failed} />
      ) : !data ? (
        <LoadingState label={t.loading} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Badge>{t.status[data.run.status]}</Badge>
            {data.run.isTest && <Badge>{t.test}</Badge>}
            {data.run.startedBy && <span>{data.run.startedBy}</span>}
            <span>{format.dateTime(data.run.createdAt)}</span>
            {data.run.isOwn && (pending(data.run) || data.run.status === 'waiting_input') && (
              <Button
                variant="secondary"
                disabled={action.isPending || data.run.cancellationPending}
                onClick={() => action.mutate({ value: 'abbrechen' })}
              >
                {data.run.cancellationPending ? t.cancelling : t.cancel}
              </Button>
            )}
            {data.run.canResume && data.run.status !== 'waiting_input' && (
              <Button
                disabled={action.isPending}
                onClick={() => action.mutate({ value: 'fortsetzen' })}
              >
                {t.resume}
              </Button>
            )}
            {data.customAgentId && (
              <Link
                to="/einstellungen/ki/agenten/eigene/$id"
                params={{ id: data.customAgentId }}
                className={buttonVariants({ variant: 'secondary' })}
              >
                {t.custom.toAgent}
              </Link>
            )}
            {data.draftHref && (
              <a href={data.draftHref} className={buttonVariants()}>
                {t.openDraft}
              </a>
            )}
          </div>
          {data.question && data.run.canResume && (
            <ListCard aria-label={t.question}>
              <ListCardHeader title={t.question} />
              <form
                className="flex flex-col gap-3 px-5 pb-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (answer.trim()) action.mutate({ value: 'fortsetzen', reply: answer.trim() });
                }}
              >
                <FormField label={data.question}>
                  {(props) => (
                    <Textarea
                      {...props}
                      value={answer}
                      maxLength={2000}
                      onChange={(event) => setAnswer(event.target.value)}
                    />
                  )}
                </FormField>
                <Button
                  type="submit"
                  disabled={action.isPending || !answer.trim()}
                  className="self-start"
                >
                  {t.continueWithAnswer}
                </Button>
              </form>
            </ListCard>
          )}
          {action.isError && <ErrorState title={t.failed} />}
          <div className="grid items-start gap-6 lg:grid-cols-3">
            <ListCard aria-label={t.trace} className="lg:col-span-2">
              <ListCardHeader title={t.trace} />
              {!data.detailsAllowed ? (
                <p className="px-5 pb-5">{t.metadataOnly}</p>
              ) : data.steps.length === 0 ? (
                <p className="px-5 pb-5">{t.noSteps}</p>
              ) : (
                <ol className="divide-y divide-line">
                  {data.steps.map((step) => (
                    <li
                      key={step.seq}
                      className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
                    >
                      <span>
                        {(data.customAgentId ? t.custom.step : t.step)[step.key]}{' '}
                        {step.finishedAt && (
                          <span className="text-muted-foreground text-sm">
                            {format.dateTime(step.finishedAt)}
                          </span>
                        )}
                      </span>
                      <Badge>{t.status[step.status]}</Badge>
                    </li>
                  ))}
                </ol>
              )}
            </ListCard>
            <aside className="flex min-w-0 flex-col gap-6">
              <ListCard aria-label={t.usage}>
                <ListCardHeader title={t.usage} />
                <p className="px-5 pb-5">
                  {format.money({ amountCents: data.run.costCents, currency: 'EUR' })} ·{' '}
                  {t.stepCount(data.run.stepsUsed)}
                </p>
              </ListCard>
              {data.sourceHref && (
                <ListCard aria-label={t.sources}>
                  <ListCardHeader title={t.sources} />
                  <a
                    className="mx-5 mb-5 inline-flex min-h-11 items-center underline"
                    href={data.sourceHref}
                  >
                    {t.meeting}
                  </a>
                </ListCard>
              )}
              {!!data.outboundQueries?.length && (
                <ListCard aria-label={t.outbound}>
                  <ListCardHeader title={t.outbound} />
                  <ul className="divide-y divide-line">
                    {data.outboundQueries.map((entry) => (
                      <li key={entry.id} className="px-5 py-3">
                        <p className="break-words">{entry.text}</p>
                        <p className="text-muted-foreground text-sm">
                          {entry.provider} · {format.dateTime(entry.sentAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </ListCard>
              )}
            </aside>
          </div>
          {data.customAgentId && data.detailsAllowed && data.run.status === 'done' && (
            <CustomRunResults runId={id} headingAs="h2" />
          )}
          {data.testResult && (
            <ListCard aria-label={t.result}>
              <ListCardHeader title={t.result} />
              <p className="px-5 pb-5">{data.testResult}</p>
            </ListCard>
          )}
        </>
      )}
    </>
  );
}
