import type { PlanSummaryDraft } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AiDraft } from '@/components/ui/ai-draft';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { useToken } from '@/features/ratings/use-rating';
import {
  decidePlanSummaryDraft,
  planSummaryDraftQueryOptions,
  proposePlanSummary,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
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
  const t = useT();
  const text = t.supplierPlan.summaryDraft;
  const { date } = useFormat();
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const options = planSummaryDraftQueryOptions(accessToken, relationshipId, planId);
  const query = useQuery({ ...options, enabled: accessToken !== '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [edited, setEdited] = useState<{ id: string; content: string } | null>(null);
  const [reasonByDraft, setReasonByDraft] = useState<Record<string, string>>({});

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
  const reason = (draft && reasonByDraft[draft.id]) ?? '';
  const editing = draft && edited?.id === draft.id;
  const content = draft && (editing ? edited.content : draft.content);
  return (
    <section aria-labelledby="summary-draft" className="flex max-w-3xl flex-col gap-3">
      <h2 id="summary-draft" className="font-semibold text-lg">
        {text.title}
      </h2>
      {data.accepted && (
        <AiDraft
          confirmed
          heading={t.draftEvidence.accepted(
            date(data.accepted.decidedAt ?? data.accepted.createdAt),
          )}
          sourcesLabel={text.sources}
          sources={[]}
          evidence={{ draft: data.accepted, relationshipId }}
        >
          {data.accepted.content}
        </AiDraft>
      )}
      {draft ? (
        <AiDraft
          evidence={{ draft: draft, relationshipId: relationshipId }}
          heading={text.heading}
          sourcesLabel={text.sources}
          sources={text.sourceList.map((label) => ({ key: label, label }))}
          actions={
            <>
              <Button
                size="sm"
                loading={busy === 'accept'}
                disabled={!content?.trim()}
                onClick={async () => {
                  const done = await run('accept', () =>
                    decidePlanSummaryDraft(
                      accessToken,
                      relationshipId,
                      planId,
                      draft.id,
                      'accept',
                      editing ? { content: edited.content } : {},
                    ),
                  );
                  if (done) {
                    onAccept(content ?? draft.content);
                    if (draft.claims) {
                      await queryClient.invalidateQueries({
                        queryKey: ['suppliers', relationshipId, 'supplier-plan'],
                      });
                    }
                    setAccepted(!draft.claims);
                  }
                }}
              >
                {text.accept}
              </Button>
              {draft.claims && !editing && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setEdited({ id: draft.id, content: draft.content })}
                >
                  {t.draftEvidence.edit}
                </Button>
              )}
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
                      { reason },
                    ),
                  )
                }
              >
                {text.discard}
              </Button>
            </>
          }
        >
          {editing ? (
            <FormField label={t.draftEvidence.edit}>
              {(field) => (
                <Textarea
                  {...field}
                  value={edited.content}
                  maxLength={5000}
                  onChange={(event) => setEdited({ id: draft.id, content: event.target.value })}
                />
              )}
            </FormField>
          ) : (
            draft.content
          )}
          {draft.claims && (
            <details className="mt-2">
              <summary className="min-h-11 cursor-pointer content-center">
                {t.draftEvidence.reason}
              </summary>
              <Textarea
                aria-label={t.draftEvidence.reason}
                maxLength={2000}
                value={reason}
                onChange={(event) => setReasonByDraft({ [draft.id]: event.target.value })}
              />
            </details>
          )}
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
