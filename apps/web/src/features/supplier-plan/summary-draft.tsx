import type { PlanSummaryDraft } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AiDraft } from '@/components/ui/ai-draft';
import { Button } from '@/components/ui/button';
import { StatusLine } from '@/components/ui/status-line';
import { useToken } from '@/features/ratings/use-rating';
import {
  decidePlanSummaryDraft,
  planSummaryDraftQueryOptions,
  proposePlanSummary,
} from '@/lib/api';
import { useT } from '@/lib/i18n';

/**
 * SPL-10: KI-Entwurf der Strategie-Zusammenfassung. Übernehmen setzt den Text ins Feld; Teil des
 * Plans wird er erst mit dem normalen Speichern.
 */
export function PlanSummaryDraftPanel({
  relationshipId,
  planId,
  onAccept,
}: {
  relationshipId: string;
  planId: string;
  onAccept: (content: string) => void;
}) {
  const text = useT().supplierPlan.summaryDraft;
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const options = planSummaryDraftQueryOptions(accessToken, relationshipId, planId);
  const query = useQuery({ ...options, enabled: accessToken !== '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const run = async (key: string, work: () => Promise<PlanSummaryDraft>) => {
    setBusy(key);
    setFailed(false);
    setAccepted(false);
    try {
      queryClient.setQueryData(options.queryKey, await work());
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const data = query.data;
  if (!data?.canDraft) return null;
  const draft = data.draft;
  return (
    <section aria-labelledby="summary-draft" className="flex max-w-3xl flex-col gap-3">
      <h2 id="summary-draft" className="font-semibold text-lg">
        {text.title}
      </h2>
      {draft ? (
        <AiDraft
          heading={text.heading}
          sourcesLabel={text.sources}
          sources={text.sourceList.map((label) => ({ key: label, label }))}
          actions={
            <>
              <Button
                size="sm"
                loading={busy === 'accept'}
                onClick={async () => {
                  const done = await run('accept', () =>
                    decidePlanSummaryDraft(accessToken, relationshipId, planId, draft.id, 'accept'),
                  );
                  if (done) {
                    onAccept(draft.content);
                    setAccepted(true);
                  }
                }}
              >
                {text.accept}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy !== null}
                onClick={() =>
                  void run('discard', () =>
                    decidePlanSummaryDraft(
                      accessToken,
                      relationshipId,
                      planId,
                      draft.id,
                      'discard',
                    ),
                  )
                }
              >
                {text.discard}
              </Button>
            </>
          }
        >
          {draft.content}
        </AiDraft>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">{text.intro}</p>
          <Button
            variant="secondary"
            className="self-start"
            loading={busy === 'propose'}
            onClick={() =>
              void run('propose', () => proposePlanSummary(accessToken, relationshipId, planId))
            }
          >
            {text.action}
          </Button>
        </div>
      )}
      {busy === 'propose' && <StatusLine message={text.working} />}
      {failed && <StatusLine message={text.failed} tone="warning" />}
      {accepted && <StatusLine message={text.accepted} />}
    </section>
  );
}
