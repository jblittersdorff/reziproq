import {
  type MarketAnalysis,
  type MarketForce,
  type MarketForceKey,
  marketForceKeys,
  marketForceQuestionKey,
  marketSynthesisQuestionKey,
  type StrategyContext,
  type StrategyStep,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { AiDraft } from '@/components/ui/ai-draft';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { GuideQuestions } from '@/components/ui/guide-questions';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { useToken } from '@/features/ratings/use-rating';
import {
  ApiError,
  confirmMarketForce,
  decideMarketProposal,
  decideMarketSynthesis,
  marketQueryOptions,
  requestMarketDraft,
  saveMarketForce,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { NoteForm } from './strategy-pages';

function useMarketSave(strategyId: string) {
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const text = useT().market;
  const failedSave = useT().strategy.failedSave;
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (work: (token: string) => Promise<MarketAnalysis>) => {
    setBusy(true);
    setFailure(null);
    try {
      queryClient.setQueryData(
        marketQueryOptions(accessToken, strategyId).queryKey,
        await work(accessToken),
      );
      // Stand der Schritte und die Beobachtung (Zusammenschau) neu lesen
      await queryClient.invalidateQueries({ queryKey: ['warengruppen'] });
      return true;
    } catch (error) {
      const code =
        error instanceof ApiError ? (error.body as { code?: string } | null)?.code : undefined;
      setFailure(
        code === 'no_sources'
          ? text.noSources
          : code === 'draft_failed'
            ? text.draftFailed
            : failedSave,
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { run, failure, busy };
}

/**
 * Schritt 5 Marktanalyse (WG-09, nach WG-Markt.dc.html): Kopf mit Stand der Recherche, sechs
 * Karten je Kraft (Entwurf gestrichelt Petrol mit Quellen, bestätigt mit festem Rand), darunter die
 * Zusammenschau. Ohne KI füllt das Team jede Karte von Hand aus.
 */
export function MarketSection({
  context,
  content,
  editable,
}: {
  context: StrategyContext;
  content: StrategyStep;
  editable: boolean;
}) {
  const all = useT();
  const text = all.market;
  const format = useFormat();
  const accessToken = useToken();
  const strategyId = context.strategy.id;
  const query = useQuery({
    ...marketQueryOptions(accessToken, strategyId),
    enabled: accessToken !== '',
  });
  const save = useMarketSave(strategyId);

  if (query.isError) return <ErrorState title={text.failed} />;
  if (!query.data) return <LoadingState label={text.loading} />;
  const data = query.data;
  const canEdit = data.canEdit && editable;
  const waiting = 6 - data.confirmedCount;
  const synthesisQuestions = content.questions
    .filter((question) => question.view === marketSynthesisQuestionKey)
    .map((question) => question.text);

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="market-head"
        className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-card p-5 shadow-card"
      >
        <div className="flex min-w-0 grow basis-80 flex-col gap-1">
          <span className="font-semibold text-petrol-dark text-sm">
            {data.researchedAt ? text.headDraft(format.date(data.researchedAt)) : text.headNone}
          </span>
          <h2 id="market-head" className="font-semibold text-lg">
            {text.progress(data.confirmedCount, waiting)}
          </h2>
          <p className="text-muted-foreground text-sm">
            {data.researchedAt ? text.basis(data.sourceCount) : text.basisNone}
          </p>
        </div>
        {canEdit && (
          <Button
            variant="secondary"
            loading={save.busy}
            onClick={() => void save.run((token) => requestMarketDraft(token, strategyId))}
          >
            {data.researchedAt ? text.research : text.requestDraft}
          </Button>
        )}
        {save.failure && (
          <div className="basis-full">
            <StatusLine message={save.failure} tone="warning" />
          </div>
        )}
      </section>

      <ul className="grid gap-4 lg:grid-cols-2">
        {marketForceKeys.map((force) => (
          <li key={force} className="flex">
            <ForceCard
              force={force}
              entry={data.forces.find((entry) => entry.force === force) ?? null}
              questions={content.questions
                .filter((question) => question.view === marketForceQuestionKey[force])
                .map((question) => question.text)}
              strategyId={strategyId}
              canEdit={canEdit}
            />
          </li>
        ))}
      </ul>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {data.synthesisDraft && (
            <AiDraft
              heading={text.synthesisDraft}
              sourcesLabel={text.sources}
              sources={[]}
              actions={
                canEdit && (
                  <>
                    <Button
                      size="sm"
                      onClick={() =>
                        void save.run((token) =>
                          decideMarketSynthesis(
                            token,
                            strategyId,
                            data.synthesisDraft?.id ?? '',
                            true,
                          ),
                        )
                      }
                    >
                      {text.adopt}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void save.run((token) =>
                          decideMarketSynthesis(
                            token,
                            strategyId,
                            data.synthesisDraft?.id ?? '',
                            false,
                          ),
                        )
                      }
                    >
                      {text.dismiss}
                    </Button>
                  </>
                )
              }
            >
              {data.synthesisDraft.text}
            </AiDraft>
          )}
          <NoteForm
            key={content.notes.find((note) => note.view === '')?.updatedAt ?? 'synthesis'}
            context={context}
            step={5}
            view=""
            title={text.synthesis}
            hint={text.synthesisHint}
            note={content.notes.find((note) => note.view === '')}
            editable={editable}
          />
        </div>
        {synthesisQuestions.length > 0 && (
          <aside className="flex min-w-0 flex-col gap-4">
            <GuideQuestions
              title={`${all.strategy.guide} · ${text.synthesis}`}
              questions={synthesisQuestions}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

function Assessment({ value }: { value: Pick<MarketForce, 'today' | 'future'> }) {
  const text = useT().market;
  return (
    <dl className="grid grid-cols-2 gap-3 text-sm">
      {(['today', 'future'] as const).map((key) => (
        <div key={key} className="flex flex-col rounded-md bg-paper px-3 py-2">
          <dt className="text-muted-foreground text-xs">
            {key === 'today' ? text.today : text.future}
          </dt>
          <dd className="font-semibold">{value[key] ? text.levels[value[key]] : '–'}</dd>
        </div>
      ))}
    </dl>
  );
}

function ForceCard({
  force,
  entry,
  questions,
  strategyId,
  canEdit,
}: {
  force: MarketForceKey;
  entry: MarketForce | null;
  questions: string[];
  strategyId: string;
  canEdit: boolean;
}) {
  const text = useT().market;
  const format = useFormat();
  const save = useMarketSave(strategyId);
  const [editing, setEditing] = useState(false);
  const confirmed = entry?.status === 'confirmed';
  const sources = [
    ...new Map(
      (entry?.points ?? [])
        .flatMap((point) => point.sources)
        .map((source) => [source.id, { key: source.id, label: source.title }]),
    ).values(),
  ];
  const levelText = (level: string | null) => (level ? (text.levels[level] ?? level) : '–');
  const heading = (
    <span className="flex flex-wrap items-center gap-2">
      <span>{text.forces[force]}</span>
      {entry?.relevant !== null && entry?.relevant !== undefined && (
        <Badge variant={entry.relevant ? 'warning' : 'neutral'}>
          {entry.relevant ? text.relevant : text.uncritical}
        </Badge>
      )}
    </span>
  );

  // Ohne Einschätzung ist die Kraft kein Entwurf von Reziproq: einfache Karte, kein Petrol-Rand.
  if (!entry) {
    return (
      <section
        aria-label={text.forces[force]}
        className="flex w-full flex-col gap-3 rounded-lg bg-card p-5 text-sm shadow-card"
      >
        <h3 className="font-semibold text-base">{text.forces[force]}</h3>
        <p className="text-muted-foreground">{text.questions[force]}</p>
        {editing ? (
          <ForceForm
            force={force}
            entry={null}
            strategyId={strategyId}
            onDone={() => setEditing(false)}
          />
        ) : (
          <>
            <p>{text.notAssessed}</p>
            {canEdit && (
              <Button
                size="sm"
                variant="secondary"
                className="self-start"
                onClick={() => setEditing(true)}
              >
                {text.fillIn}
              </Button>
            )}
          </>
        )}
        {questions.length > 0 && (
          <details>
            <summary className="min-h-11 cursor-pointer py-2 font-semibold">
              {text.guide(questions.length)}
            </summary>
            <GuideQuestions title={text.forces[force]} questions={questions} />
          </details>
        )}
      </section>
    );
  }
  return (
    <AiDraft
      className="w-full"
      heading={heading}
      sourcesLabel={text.sources}
      sources={sources}
      confirmed={confirmed}
      actions={
        canEdit &&
        !editing && (
          <>
            {entry && !confirmed && (
              <Button
                size="sm"
                loading={save.busy}
                onClick={() =>
                  void save.run((token) => confirmMarketForce(token, strategyId, force))
                }
              >
                {text.confirm}
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              {!entry ? text.fillIn : confirmed ? text.change : text.adjust}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground">{text.questions[force]}</p>
        {save.failure && <StatusLine message={save.failure} tone="warning" />}
        {editing ? (
          <ForceForm
            force={force}
            entry={entry}
            strategyId={strategyId}
            onDone={() => setEditing(false)}
          />
        ) : !entry ? (
          <p>{text.notAssessed}</p>
        ) : (
          <>
            <Assessment value={entry} />
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {entry.points.map((point) => (
                <li key={point.text}>{point.text}</li>
              ))}
            </ul>
            <p className="text-muted-foreground text-xs">
              {confirmed && entry.confirmedBy && entry.confirmedAt
                ? `✓ ${text.confirmedBy(entry.confirmedBy, format.date(entry.confirmedAt))}`
                : text.draftLabel}
            </p>
          </>
        )}
        {entry?.proposal && !editing && (
          <div className="flex flex-col gap-2 rounded-md border-2 border-petrol border-dashed p-3">
            <strong className="font-semibold text-petrol-dark">{text.proposalTitle}</strong>
            <ul className="flex flex-col gap-1">
              {(['today', 'future'] as const)
                .filter((key) => entry.proposal?.[key] !== entry[key])
                .map((key) => (
                  <li key={key}>
                    {text.proposalDiff(
                      key === 'today' ? text.today : text.future,
                      levelText(entry[key]),
                      levelText(entry.proposal?.[key] ?? null),
                    )}
                  </li>
                ))}
              {entry.proposal.relevant !== entry.relevant && (
                <li>
                  {text.proposalDiff(
                    text.formRelevant,
                    entry.relevant ? text.relevant : text.uncritical,
                    entry.proposal.relevant ? text.relevant : text.uncritical,
                  )}
                </li>
              )}
              {entry.proposal.today === entry.today &&
                entry.proposal.future === entry.future &&
                entry.proposal.relevant === entry.relevant && <li>{text.proposalSame}</li>}
              {entry.proposal.points.map((point) => (
                <li key={point.text} className="text-muted-foreground">
                  {point.text}
                </li>
              ))}
            </ul>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    void save.run((token) => decideMarketProposal(token, strategyId, force, true))
                  }
                >
                  {text.adopt}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void save.run((token) => decideMarketProposal(token, strategyId, force, false))
                  }
                >
                  {text.dismiss}
                </Button>
              </div>
            )}
          </div>
        )}
        {questions.length > 0 && (
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold">
              {text.guide(questions.length)}
            </summary>
            <GuideQuestions title={text.forces[force]} questions={questions} />
          </details>
        )}
      </div>
    </AiDraft>
  );
}

function ForceForm({
  force,
  entry,
  strategyId,
  onDone,
}: {
  force: MarketForceKey;
  entry: MarketForce | null;
  strategyId: string;
  onDone: () => void;
}) {
  const text = useT().market;
  const save = useMarketSave(strategyId);
  const [today, setToday] = useState(entry?.today ?? 'high');
  const [future, setFuture] = useState(entry?.future ?? 'high');
  const [relevant, setRelevant] = useState(entry?.relevant ?? true);
  const [points, setPoints] = useState((entry?.points ?? []).map((point) => point.text).join('\n'));
  const [missing, setMissing] = useState(false);
  const level = (label: string, value: string, onChange: (value: 'low' | 'high') => void) => (
    <FormField label={label}>
      {(field) => (
        <NativeSelect
          {...field}
          value={value}
          onChange={(event) => onChange(event.target.value as 'low' | 'high')}
        >
          <option value="low">{text.levels.low}</option>
          <option value="high">{text.levels.high}</option>
        </NativeSelect>
      )}
    </FormField>
  );
  return (
    <form
      aria-label={`${text.adjust}: ${text.forces[force]}`}
      className="flex flex-col gap-3"
      onSubmit={async (event: FormEvent) => {
        event.preventDefault();
        const list = points
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        if (!list.length) {
          setMissing(true);
          return;
        }
        const ok = await save.run((token) =>
          saveMarketForce(token, strategyId, force, { today, future, relevant, points: list }),
        );
        if (ok) onDone();
      }}
    >
      {save.failure && <StatusLine message={save.failure} tone="warning" />}
      <div className="grid gap-3 sm:grid-cols-2">
        {level(text.formToday, today, setToday)}
        {level(text.formFuture, future, setFuture)}
      </div>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          className="size-5 accent-petrol"
          checked={relevant}
          onChange={(event) => setRelevant(event.target.checked)}
        />
        {text.formRelevant}
      </label>
      <FormField
        label={text.formPoints}
        hint={text.formPointsHint}
        error={missing && !points.trim() ? text.pointsMissing : undefined}
      >
        {(field) => (
          <Textarea
            {...field}
            rows={4}
            value={points}
            onChange={(event) => setPoints(event.target.value)}
          />
        )}
      </FormField>
      <FormActions>
        <Button type="submit" loading={save.busy}>
          {text.save}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {text.cancel}
        </Button>
      </FormActions>
    </form>
  );
}
