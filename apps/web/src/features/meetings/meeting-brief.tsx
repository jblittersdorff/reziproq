import {
  agendaMinutes,
  agendaText,
  type BriefContent,
  type BriefPart,
  briefContentSchemas,
  type AiDraft as Draft,
  type MeetingBrief,
  withStartTimes,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AiDraft, type DraftSource } from '@/components/ui/ai-draft';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Monogram } from '@/components/ui/monogram';
import { NextStep } from '@/components/ui/next-step';
import { StatusLine } from '@/components/ui/status-line';
import { VisibilityBadge } from '@/components/ui/visibility-badge';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import {
  agentsQueryOptions,
  briefQueryOptions,
  decideBrief,
  editBriefAgenda,
  sendBriefQuestion,
  startAgent,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Entry = MeetingBrief['parts'][BriefPart];

/** Inhalt eines Teils: der offene Entwurf, sonst der übernommene Stand */
function partOf<P extends BriefPart>(brief: MeetingBrief, part: P) {
  const entry = brief.parts[part] as Entry;
  const shown = (entry.draft ?? entry.accepted) as (Draft & { data: unknown }) | null;
  if (!shown) return null;
  const parsed = briefContentSchemas[part].safeParse(shown.data);
  return parsed.success ? { draft: shown, data: parsed.data as BriefContent[P] } : null;
}

const sourcesOf = (draft: Draft): DraftSource[] => {
  const seen = new Map<string, DraftSource>();
  for (const claim of draft.claims ?? []) {
    for (const source of claim.sources) {
      const key = `${source.objectType}-${source.objectId}-${source.title}`;
      if (!seen.has(key)) seen.set(key, { key, label: source.title });
    }
  }
  return [...seen.values()].slice(0, 6);
};

/**
 * KI-07 Termin-Briefing, Reiter Vorbereitung (nach Termin-Briefing.dc.html): Lage als Entwurf, der
 * nächste Schritt als Tinte-Karte, Ziele „nur für euch“, Agenda mit Zeiten, was geklärt werden muss
 * in drei Gruppen, Risiken und offene Punkte; rechts Teilnehmer, Quellen und wie aktuell. Nur beim
 * Käufer; der Lieferant sieht nur die übernommene Agenda im Reiter Agenda.
 */
export function MeetingBriefPanel({
  relationshipId,
  meetingId,
  supplier,
  meetingDay,
}: {
  relationshipId: string;
  meetingId: string;
  supplier: string;
  meetingDay: string;
}) {
  const t = useT();
  const text = t.meetings.brief;
  const format = useFormat();
  const accessToken = useToken();
  const client = useQueryClient();
  const options = briefQueryOptions(accessToken, relationshipId, meetingId);
  const query = useQuery({
    ...options,
    enabled: accessToken !== '',
    refetchInterval: (state) => (state.state.data?.freshness.running ? 3000 : false),
  });
  const agents = useQuery({ ...agentsQueryOptions(accessToken), enabled: accessToken !== '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'warning' } | null>(
    null,
  );
  const brief = query.data;
  if (query.isError) return null;
  if (!brief) return <LoadingState label={text.loading} />;
  const agent = agents.data?.agents.find((entry) => entry.key === 'meeting_brief');

  const act = async (key: string, work: () => Promise<MeetingBrief>, note: string) => {
    setBusy(key);
    setMessage(null);
    try {
      client.setQueryData(options.queryKey, await work());
      await client.invalidateQueries({ queryKey: ['termine'] });
      setMessage({ text: note, tone: 'success' });
    } catch {
      setMessage({ text: text.failed, tone: 'warning' });
    } finally {
      setBusy(null);
    }
  };
  const decide = (draft: Draft, decision: 'uebernehmen' | 'verwerfen', note: string) =>
    act(
      `${draft.id}-${decision}`,
      () => decideBrief(accessToken, relationshipId, meetingId, draft.id, decision),
      note,
    );
  const rerun = async () => {
    if (!agent) return;
    setBusy('rerun');
    setMessage(null);
    try {
      await startAgent(accessToken, agent.id, { relationshipId, meetingId, isTest: false });
      await client.invalidateQueries({ queryKey: options.queryKey });
      setMessage({ text: text.running, tone: 'success' });
    } catch {
      setMessage({ text: text.rerunRefused, tone: 'warning' });
    } finally {
      setBusy(null);
    }
  };

  const situation = partOf(brief, 'situation');
  const goals = partOf(brief, 'goals');
  const agenda = partOf(brief, 'agenda');
  const internal = partOf(brief, 'internalQuestions');
  const toSupplier = partOf(brief, 'supplierQuestions');
  const expected = partOf(brief, 'expectedQuestions');
  const risks = partOf(brief, 'risks');
  const openPoints = partOf(brief, 'openPoints');
  const empty = !situation && !goals && !agenda;
  const goalNumber = (key: string | null) => {
    const index = goals?.data.goals.findIndex((goal) => goal.key === key) ?? -1;
    return index >= 0 ? index + 1 : null;
  };

  const actions = (draft: Draft, acceptLabel: string, acceptNote: string) =>
    brief.canDecide && draft.status === 'draft' ? (
      <>
        <Button
          size="sm"
          variant="secondary"
          loading={busy === `${draft.id}-uebernehmen`}
          onClick={() => void decide(draft, 'uebernehmen', acceptNote)}
        >
          {acceptLabel}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          loading={busy === `${draft.id}-verwerfen`}
          onClick={() => void decide(draft, 'verwerfen', text.discarded)}
        >
          {text.discard}
        </Button>
      </>
    ) : null;
  const heading = (title: string, draft: Draft) =>
    `${title} · ${draft.status === 'draft' ? text.draftOf(format.dateTime(draft.createdAt)) : text.accepted}`;

  return (
    <div className="flex flex-wrap items-start gap-5" data-slot="meeting-brief">
      <div className="flex min-w-0 shrink grow-2 basis-130 flex-col gap-5">
        {message && (
          <StatusLine
            message={message.text}
            tone={message.tone}
            onHidden={() => setMessage(null)}
          />
        )}
        {empty ? (
          <section className="flex flex-col gap-3 rounded-lg bg-card p-6 shadow-card">
            <h2 className="font-display font-semibold text-section tracking-section">
              {text.emptyTitle}
            </h2>
            <p className="text-muted-foreground">
              {brief.freshness.running
                ? text.running
                : brief.leadDays === null
                  ? text.emptyManual
                  : text.emptyLead(brief.leadDays)}
            </p>
            {brief.canDecide && agent?.enabled && !brief.freshness.running && (
              <Button
                className="self-start"
                variant="secondary"
                loading={busy === 'rerun'}
                onClick={() => void rerun()}
              >
                {text.prepareNow}
              </Button>
            )}
          </section>
        ) : (
          <>
            {situation && (
              <AiDraft
                heading={heading(text.situation, situation.draft)}
                sourcesLabel={text.sources}
                sources={sourcesOf(situation.draft)}
                confirmed={situation.draft.status === 'accepted'}
                actions={actions(situation.draft, text.accept, text.acceptedNote)}
              >
                <p>{situation.data.sentences.join(' ')}</p>
              </AiDraft>
            )}
            <NextStep
              eyebrow={text.nextEyebrow}
              title={
                brief.agendaShared
                  ? text.nextQuestions
                  : text.nextAgenda(format.date(meetingDay), supplier)
              }
              text={brief.agendaShared ? text.nextQuestionsText : text.nextAgendaText}
              action={routerLink({
                href: brief.agendaShared ? '#briefing-fragen' : '#briefing-agenda',
                className: buttonVariants({ variant: 'mint', size: 'hero' }),
                children: brief.agendaShared ? text.nextQuestionsAction : text.nextAgendaAction,
              })}
            />
            {goals && (
              <section
                aria-labelledby="briefing-ziele"
                className="flex flex-col gap-4 rounded-lg bg-card p-6 shadow-card"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="briefing-ziele"
                    className="font-display font-semibold text-section tracking-section"
                  >
                    {text.goals}
                  </h2>
                  <VisibilityBadge visibility="internal" label={text.onlyYou} />
                  <Badge>{goals.draft.status === 'draft' ? text.draft : text.accepted}</Badge>
                </div>
                <ol className="flex flex-col gap-4">
                  {goals.data.goals.map((goal, index) => (
                    <li key={goal.key} className="flex gap-3">
                      <span
                        aria-hidden
                        className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-petrol font-display font-semibold text-chip text-petrol-dark"
                      >
                        {index + 1}
                      </span>
                      <span className="flex min-w-0 flex-col gap-1 text-sm">
                        <strong className="font-semibold text-base">{goal.title}</strong>
                        <span>
                          <span className="font-semibold">{text.reachedWhen}</span>{' '}
                          {goal.reachedWhen}
                        </span>
                        <span className="flex flex-wrap gap-1.5">
                          <Badge>
                            {text.refTypes[goal.ref.objectType] ?? text.refTypes.other}{' '}
                            {goal.ref.title}
                          </Badge>
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
                {brief.canDecide && goals.draft.status === 'draft' && (
                  <div className="flex flex-wrap gap-2">
                    {actions(goals.draft, text.acceptGoals, text.acceptedNote)}
                  </div>
                )}
              </section>
            )}
            {agenda && (
              <AgendaSection
                brief={brief}
                draft={agenda.draft}
                data={agenda.data}
                goalNumber={goalNumber}
                busy={busy}
                onDecide={(decision) =>
                  void decide(
                    agenda.draft,
                    decision,
                    decision === 'uebernehmen' ? text.agendaShared : text.discarded,
                  )
                }
                onSave={(items) =>
                  act(
                    'agenda-edit',
                    () => editBriefAgenda(accessToken, relationshipId, meetingId, { items }),
                    text.agendaSaved,
                  )
                }
                onCopied={(ok) =>
                  setMessage({
                    text: ok ? text.copied : text.copyFailed,
                    tone: ok ? 'success' : 'warning',
                  })
                }
              />
            )}
            {(internal || toSupplier || expected) && (
              <section
                id="briefing-fragen"
                aria-labelledby="briefing-fragen-titel"
                className="flex scroll-mt-32 flex-col gap-5 rounded-lg bg-card p-6 shadow-card"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="briefing-fragen-titel"
                    className="font-display font-semibold text-section tracking-section"
                  >
                    {text.questions}
                  </h2>
                  <Badge>{text.draft}</Badge>
                </div>
                {internal && (
                  <div className="flex flex-col gap-3">
                    <h3 className="flex flex-wrap items-center gap-2 font-semibold">
                      {text.internalTitle}
                      <VisibilityBadge visibility="internal" label={text.onlyYou} />
                    </h3>
                    <ul className="flex flex-col divide-y divide-line-soft">
                      {internal.data.questions.map((question) => (
                        <li
                          key={question.key}
                          className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
                        >
                          <span className="flex min-w-0 grow basis-64 flex-col gap-0.5 text-sm">
                            <span className="font-semibold">{question.text}</span>
                            <span className="text-muted-foreground">
                              {`${question.occasion} · ${text.to(question.addressee.name)}`}
                            </span>
                            {question.answer && (
                              <span>
                                <span className="font-semibold">{text.answer}</span>{' '}
                                {question.answer}
                              </span>
                            )}
                          </span>
                          {question.actionId ? (
                            <Badge variant="shared">{text.sent}</Badge>
                          ) : (
                            brief.canDecide &&
                            question.addressee.userId && (
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={busy === `send-${question.key}`}
                                onClick={() =>
                                  void act(
                                    `send-${question.key}`,
                                    () =>
                                      sendBriefQuestion(
                                        accessToken,
                                        relationshipId,
                                        meetingId,
                                        question.key,
                                      ),
                                    text.sentNote(question.addressee.name),
                                  )
                                }
                              >
                                {text.send(question.addressee.name)}
                              </Button>
                            )
                          )}
                        </li>
                      ))}
                    </ul>
                    {actions(internal.draft, text.accept, text.acceptedNote) && (
                      <div className="flex flex-wrap gap-2">
                        {actions(internal.draft, text.accept, text.acceptedNote)}
                      </div>
                    )}
                  </div>
                )}
                {toSupplier && (
                  <div className="flex flex-col gap-3">
                    <h3 className="flex flex-wrap items-center gap-2 font-semibold">
                      {text.supplierTitle(supplier)}
                      <VisibilityBadge visibility="shared" label={text.withAgenda} />
                    </h3>
                    <ul className="flex flex-col divide-y divide-line-soft">
                      {toSupplier.data.questions.map((question) => (
                        <li key={question.key} className="flex flex-col gap-0.5 py-3 text-sm">
                          <span className="font-semibold">{question.text}</span>
                          <span className="text-muted-foreground">
                            {goalNumber(question.goalKey)
                              ? text.toGoal(goalNumber(question.goalKey) as number)
                              : (question.about ?? '')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {expected && (
                  <div className="flex flex-col gap-3">
                    <h3 className="flex flex-wrap items-center gap-2 font-semibold">
                      {text.expectedTitle(supplier)}
                      <VisibilityBadge visibility="internal" label={text.onlyYou} />
                    </h3>
                    <ul className="flex flex-col divide-y divide-line-soft">
                      {expected.data.questions.map((question) => (
                        <li key={question.key} className="flex flex-col gap-1 py-3 text-sm">
                          <span className="font-semibold">{question.text}</span>
                          <span className="text-muted-foreground">{question.origin}</span>
                          <span>
                            <span className="font-semibold">{text.answerSuggestion}</span>{' '}
                            {question.answer}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}
            {risks && (
              <AiDraft
                heading={heading(text.risks, risks.draft)}
                sourcesLabel={text.sources}
                sources={[]}
                evidence={{ draft: risks.draft, relationshipId }}
                confirmed={risks.draft.status === 'accepted'}
                actions={actions(risks.draft, text.accept, text.acceptedNote)}
              >
                <ul className="flex list-disc flex-col gap-1 pl-5">
                  {risks.data.risks.map((risk) => (
                    <li key={risk.key}>{risk.text}</li>
                  ))}
                </ul>
              </AiDraft>
            )}
            {openPoints && (
              <section
                aria-labelledby="briefing-punkte"
                className="flex flex-col gap-3 rounded-lg bg-card p-6 shadow-card"
              >
                <h2
                  id="briefing-punkte"
                  className="font-display font-semibold text-section tracking-section"
                >
                  {text.openPoints}
                </h2>
                <ul className="flex flex-col divide-y divide-line-soft">
                  {openPoints.data.points.map((point) => (
                    <li
                      key={point.key}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-sm"
                    >
                      <span className="min-w-0 grow basis-48 font-semibold">{point.title}</span>
                      <span className="text-muted-foreground">
                        {point.side === 'buyer' ? text.sideYou : supplier}
                      </span>
                      <span className="tabular-nums">{format.date(point.dueOn)}</span>
                      <Badge variant={point.overdue ? 'danger' : 'neutral'}>
                        {point.overdue ? text.overdue : text.open}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground text-sm">{text.fromDatabase}</p>
              </section>
            )}
          </>
        )}
      </div>
      <aside className="flex min-w-0 shrink grow basis-75 flex-col gap-5">
        <section
          aria-labelledby="briefing-teilnehmer"
          className="flex flex-col gap-3 rounded-lg bg-card p-6 shadow-card"
        >
          <h2
            id="briefing-teilnehmer"
            className="font-display font-semibold text-section tracking-section"
          >
            {text.participants}
          </h2>
          {brief.participants.length === 0 ? (
            <p className="text-muted-foreground text-sm">{text.noParticipants}</p>
          ) : (
            (['buyer', 'supplier'] as const).map((side) => {
              const people = brief.participants.filter((entry) => entry.side === side);
              if (people.length === 0) return null;
              return (
                <div key={side} className="flex flex-col gap-2">
                  <h3 className="font-semibold text-muted-foreground text-sm">
                    {side === 'buyer' ? text.sideYou : supplier}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {people.map((person) => (
                      <li key={person.name} className="flex items-center gap-3 text-sm">
                        <Monogram
                          name={person.name}
                          size="sm"
                          tone={side === 'buyer' ? 'neutral' : 'shared'}
                        />
                        {person.name}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </section>
        <section
          aria-labelledby="briefing-quellen"
          className="flex flex-col gap-3 rounded-lg bg-card p-6 shadow-card"
        >
          <h2
            id="briefing-quellen"
            className="font-display font-semibold text-section tracking-section"
          >
            {text.basedOn}
          </h2>
          <dl className="flex flex-col divide-y divide-line-soft text-sm">
            {brief.sourceCounts.map((entry) => (
              <div key={entry.kind} className="flex justify-between gap-3 py-2">
                <dt>{text.sourceKinds[entry.kind] ?? entry.kind}</dt>
                <dd className="font-semibold tabular-nums">{entry.count}</dd>
              </div>
            ))}
          </dl>
          <VisibilityBadge visibility="internal" label={text.onlyYou} />
        </section>
        <section
          aria-labelledby="briefing-aktuell"
          className="flex flex-col gap-3 rounded-lg bg-card p-6 shadow-card"
        >
          <h2
            id="briefing-aktuell"
            className="font-display font-semibold text-section tracking-section"
          >
            {text.freshness}
          </h2>
          <p className="text-sm">
            {brief.freshness.preparedAt
              ? text.preparedAt(format.dateTime(brief.freshness.preparedAt))
              : text.notPrepared}
          </p>
          <p className="text-muted-foreground text-sm">
            {brief.freshness.running
              ? text.running
              : brief.freshness.unchanged
                ? text.unchanged
                : text.changed}
          </p>
          <div className="flex flex-wrap gap-2">
            {brief.canDecide && agent?.enabled && (
              <Button
                size="sm"
                variant="secondary"
                disabled={brief.freshness.unchanged || brief.freshness.running}
                loading={busy === 'rerun'}
                onClick={() => void rerun()}
              >
                {text.rerun}
              </Button>
            )}
            {brief.freshness.runId &&
              routerLink({
                href: `/einstellungen/ki/agenten/laeufe/${brief.freshness.runId}`,
                className: buttonVariants({ size: 'sm', variant: 'ghost' }),
                children: text.runLog,
              })}
          </div>
        </section>
      </aside>
    </div>
  );
}

/** Agenda als Liste mit Zeit, Punkt, wer führt und Ziel; Bearbeiten rechnet Zeiten neu. */
function AgendaSection({
  brief,
  draft,
  data,
  goalNumber,
  busy,
  onDecide,
  onSave,
  onCopied,
}: {
  brief: MeetingBrief;
  draft: Draft;
  data: BriefContent['agenda'];
  goalNumber: (key: string | null) => number | null;
  busy: string | null;
  onDecide: (decision: 'uebernehmen' | 'verwerfen') => void;
  onSave: (
    items: {
      key: string;
      title: string;
      subline: string | null;
      minutes: number;
      leads: string[];
    }[],
  ) => Promise<void>;
  onCopied: (ok: boolean) => void;
}) {
  const t = useT();
  const text = t.meetings.brief;
  const [editing, setEditing] = useState<{ key: string; title: string; minutes: string }[] | null>(
    null,
  );
  const open = draft.status === 'draft';
  const start = data.items[0]?.start ?? '00:00';
  const editedItems = editing
    ? withStartTimes(
        start,
        editing.map((item) => ({ ...item, minutes: Number(item.minutes) || 0 })),
      )
    : null;
  const sum = editedItems ? agendaMinutes(editedItems) : agendaMinutes(data.items);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(agendaText(data.items));
      onCopied(true);
    } catch {
      onCopied(false);
    }
  };
  return (
    <section
      id="briefing-agenda"
      aria-labelledby="briefing-agenda-titel"
      className="flex scroll-mt-32 flex-col gap-4 rounded-lg bg-card p-6 shadow-card"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2
          id="briefing-agenda-titel"
          className="font-display font-semibold text-section tracking-section"
        >
          {text.agenda}
        </h2>
        <VisibilityBadge
          visibility={open ? 'internal' : 'shared'}
          label={open ? text.sharedAfterAccept : text.sharedNow}
        />
        <Badge>{open ? text.draft : text.accepted}</Badge>
      </div>
      <ol className="flex flex-col divide-y divide-line-soft">
        {(editedItems ?? data.items).map((item, index) => {
          const original = data.items.find((entry) => entry.key === item.key);
          const number = goalNumber(original?.goalKey ?? null);
          return (
            <li
              key={item.key}
              className="grid grid-cols-[--spacing(14)_minmax(0,1fr)] gap-x-3 gap-y-1 py-3 text-sm sm:grid-cols-[--spacing(14)_minmax(0,1fr)_--spacing(36)_--spacing(14)]"
            >
              <span className="flex flex-col tabular-nums">
                <span className="font-semibold">{item.start}</span>
                <span className="text-muted-foreground">{text.minutes(item.minutes)}</span>
              </span>
              {editing ? (
                <span className="flex min-w-0 flex-wrap gap-2">
                  <label className="sr-only" htmlFor={`agenda-titel-${item.key}`}>
                    {text.itemTitle(index + 1)}
                  </label>
                  <Input
                    id={`agenda-titel-${item.key}`}
                    className="min-w-0 grow basis-40"
                    value={editing[index]?.title ?? ''}
                    maxLength={200}
                    onChange={(event) =>
                      setEditing(
                        editing.map((entry, at) =>
                          at === index ? { ...entry, title: event.target.value } : entry,
                        ),
                      )
                    }
                  />
                  <label className="sr-only" htmlFor={`agenda-dauer-${item.key}`}>
                    {text.itemMinutes(index + 1)}
                  </label>
                  <Input
                    id={`agenda-dauer-${item.key}`}
                    className="w-24"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={600}
                    value={editing[index]?.minutes ?? ''}
                    onChange={(event) =>
                      setEditing(
                        editing.map((entry, at) =>
                          at === index ? { ...entry, minutes: event.target.value } : entry,
                        ),
                      )
                    }
                  />
                </span>
              ) : (
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold">{item.title}</span>
                  {original?.subline && (
                    <span className="text-muted-foreground">{original.subline}</span>
                  )}
                </span>
              )}
              <span className="col-start-2 text-muted-foreground sm:col-start-auto sm:text-text">
                {original && original.leads.length > 0 ? original.leads.join(', ') : '–'}
              </span>
              <span className="col-start-2 sm:col-start-auto">
                {number ? <Badge variant="shared">{text.goalShort(number)}</Badge> : '–'}
              </span>
            </li>
          );
        })}
      </ol>
      <p
        className={cn(
          'text-sm',
          sum === brief.durationMinutes
            ? 'text-muted-foreground'
            : 'font-semibold text-destructive',
        )}
      >
        {text.sum(sum, brief.durationMinutes)}
      </p>
      {data.omitted.length > 0 && (
        <p className="text-muted-foreground text-sm">
          <span className="font-semibold text-text">{text.omitted}</span>{' '}
          {data.omitted.map((entry) => `${entry.topic}. ${entry.reason}`).join(' ')}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <Button
              size="sm"
              variant="secondary"
              loading={busy === 'agenda-edit'}
              disabled={sum !== brief.durationMinutes}
              onClick={() =>
                void onSave(
                  editing.map((entry) => {
                    const original = data.items.find((item) => item.key === entry.key);
                    return {
                      key: entry.key,
                      title: entry.title.trim() || original?.title || '',
                      subline: original?.subline ?? null,
                      minutes: Number(entry.minutes) || 0,
                      leads: original?.leads ?? [],
                    };
                  }),
                ).then(() => setEditing(null))
              }
            >
              {text.saveAgenda}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
              {text.cancel}
            </Button>
          </>
        ) : (
          <>
            {brief.canDecide && open && (
              <Button
                size="sm"
                variant="secondary"
                loading={busy === `${draft.id}-uebernehmen`}
                onClick={() => onDecide('uebernehmen')}
              >
                {text.acceptAgenda}
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => void copy()}>
              {text.toInvitation}
            </Button>
            {brief.canDecide && open && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setEditing(
                      data.items.map((item) => ({
                        key: item.key,
                        title: item.title,
                        minutes: String(item.minutes),
                      })),
                    )
                  }
                >
                  {text.edit}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy === `${draft.id}-verwerfen`}
                  onClick={() => onDecide('verwerfen')}
                >
                  {text.discard}
                </Button>
              </>
            )}
          </>
        )}
      </div>
      <p className="text-muted-foreground text-sm">{text.invitationHint}</p>
    </section>
  );
}
