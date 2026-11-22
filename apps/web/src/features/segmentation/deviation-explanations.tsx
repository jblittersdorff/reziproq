import type { DeviationExplanation, DeviationExplanations } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AiDraft } from '@/components/ui/ai-draft';
import { AiDraftInputs, type DraftInput } from '@/components/ui/ai-draft-inputs';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import { useToken } from '@/features/ratings/use-rating';
import { decideExplanation, deviationExplanationsQueryOptions, explainDeviations } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';

/**
 * SEG-11: Die KI erklärt die drei größten Abweichungen in zwei Sätzen. Entwürfe sehen nur SRO und
 * Admin, gestrichelt mit Übernehmen und Verwerfen; übernommene Erklärungen sehen alle mit Zugriff.
 */
export function DeviationExplanationsSection({
  relationshipId,
  stats,
}: {
  relationshipId: string;
  stats: { criterionKey: string; min: number; max: number }[];
}) {
  const text = useT().segmentation.explain;
  const { locale } = useLocale();
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const options = deviationExplanationsQueryOptions(accessToken, relationshipId);
  const query = useQuery({ ...options, enabled: accessToken !== '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

  const run = async (key: string, work: () => Promise<DeviationExplanations>) => {
    setBusy(key);
    setFailed(false);
    try {
      queryClient.setQueryData(options.queryKey, await work());
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  const data = query.data;
  const names = (keys: string[]) =>
    keys
      .map((key) => data?.explanations.find((entry) => entry.criterionKey === key)?.criterionName)
      .filter(Boolean)
      .join(', ');

  return (
    <section aria-labelledby="seg-explain" className="flex flex-col gap-3">
      <h2 id="seg-explain" className="font-semibold text-lg">
        {text.title}
      </h2>
      {query.isError ? (
        <ErrorState title={text.loadFailed} />
      ) : !data ? (
        <LoadingState label={text.working} />
      ) : data.explanations.length === 0 ? (
        <p className="text-muted-foreground">{text.none}</p>
      ) : (
        <>
          {data.canExplain && (
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground text-sm">{text.intro}</p>
              <Button
                variant="secondary"
                className="self-start"
                loading={busy === 'explain'}
                onClick={() =>
                  void run('explain', () => explainDeviations(accessToken, relationshipId))
                }
              >
                {text.action}
              </Button>
            </div>
          )}
          {busy === 'explain' && <StatusLine message={text.working} />}
          {failed && <StatusLine message={text.failed} tone="warning" />}
          {data.withoutReasons.length > 0 && (
            <p role="status" className="rounded-lg bg-card px-4 py-3 text-sm">
              {text.withoutReasons(names(data.withoutReasons))}
            </p>
          )}
          <ul className="flex flex-col gap-4">
            {data.explanations.map((explanation) => {
              const stat = stats.find((entry) => entry.criterionKey === explanation.criterionKey);
              return (
                <li key={explanation.criterionKey} className="flex flex-col gap-2">
                  <h3 className="flex flex-wrap items-baseline gap-x-3 font-semibold">
                    {explanation.criterionName}
                    {stat && (
                      <span className="font-normal text-muted-foreground text-sm tabular-nums">
                        {text.range(number.format(stat.min), number.format(stat.max))}
                      </span>
                    )}
                  </h3>
                  <ExplanationDrafts
                    relationshipId={relationshipId}
                    explanation={explanation}
                    busy={busy}
                    onDecide={(draftId, decision, input) =>
                      void run(draftId, () =>
                        decideExplanation(accessToken, relationshipId, draftId, decision, input),
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function ExplanationDrafts({
  relationshipId,
  explanation,
  busy,
  onDecide,
}: {
  relationshipId: string;
  explanation: DeviationExplanation;
  busy: string | null;
  onDecide: (draftId: string, decision: 'accept' | 'discard', input: DraftInput) => void;
}) {
  const text = useT().segmentation.explain;
  const format = useFormat();
  const sources = [
    {
      key: 'reasons',
      label: text.reasons(explanation.reasons),
      // Wie criterionPath der Segmentierungsseite; ohne Import, um keinen Kreis zu bilden.
      href: `/lieferanten/${relationshipId}/strategie/segmentierung/kriterium/${explanation.criterionKey}`,
    },
  ];
  const { draft, accepted } = explanation;
  const [inputByDraft, setInputByDraft] = useState<Record<string, DraftInput>>({});
  const input = (draft && inputByDraft[draft.id]) ?? {};
  if (!draft && !accepted) {
    return <p className="text-muted-foreground text-sm">{text.noExplanation}</p>;
  }
  return (
    <>
      {accepted && (
        <AiDraft
          evidence={{ draft: accepted, relationshipId: relationshipId }}
          confirmed
          heading={text.acceptedHeading(format.date(accepted.decidedAt ?? accepted.createdAt))}
          sourcesLabel={text.sources}
          sources={sources}
        >
          {accepted.content}
        </AiDraft>
      )}
      {draft && (
        <AiDraft
          evidence={{ draft: draft, relationshipId: relationshipId }}
          heading={text.draftHeading}
          sourcesLabel={text.sources}
          sources={sources}
          actions={
            <>
              <Button
                size="sm"
                loading={busy === draft.id}
                aria-label={`${text.accept}: ${explanation.criterionName}`}
                disabled={input.content !== undefined && !input.content.trim()}
                onClick={() => onDecide(draft.id, 'accept', input)}
              >
                {text.accept}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy === draft.id}
                aria-label={`${text.discard}: ${explanation.criterionName}`}
                onClick={() => onDecide(draft.id, 'discard', input)}
              >
                {text.discard}
              </Button>
            </>
          }
        >
          {draft.content}
          {draft.claims && (
            <AiDraftInputs
              content={draft.content}
              input={input}
              onChange={(value) => setInputByDraft({ [draft.id]: value })}
            />
          )}
        </AiDraft>
      )}
    </>
  );
}
