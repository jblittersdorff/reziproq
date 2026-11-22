import { maxPreReadWords, type PreReadDraft, wordCount } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AiDraft } from '@/components/ui/ai-draft';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { useToken } from '@/features/ratings/use-rating';
import {
  acceptPreRead,
  discardPreRead,
  type MeetingBase,
  preReadDraftQueryOptions,
  proposePreRead,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';

/**
 * QBR-07: KI-Entwurf der Zusammenfassung im Pre-Read, nur für die eigene Seite. Der Entwurf lässt
 * sich vor dem Übernehmen bearbeiten; übernommen steht er im Pre-Read-PDF dieser Seite.
 */
export function PreReadSummary({
  base,
  side,
  meetingId,
}: {
  base: MeetingBase;
  side: 'buyer' | 'supplier';
  meetingId: string;
}) {
  const relationshipId = base.slice(base.lastIndexOf('/') + 1);
  const t = useT();
  const text = t.meetings.summaryDraft;
  const format = useFormat();
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const options = preReadDraftQueryOptions(accessToken, base, meetingId);
  const query = useQuery({ ...options, enabled: accessToken !== '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [reasonByDraft, setReasonByDraft] = useState<Record<string, string>>({});
  // Bearbeiteter Text je Entwurf; ohne Eingabe gilt der Text der KI.
  const [edits, setEdits] = useState<Record<string, string>>({});

  const run = async (key: string, work: () => Promise<PreReadDraft>) => {
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
  if (!data || (!data.canDraft && !data.accepted)) return null;
  const sources = [...text.sourceList, ...(side === 'buyer' ? text.buyerSources : [])].map(
    (label) => ({ key: label, label }),
  );
  const draft = data.draft;
  const reason = (draft && reasonByDraft[draft.id]) ?? '';
  const value = draft ? (edits[draft.id] ?? draft.content) : '';
  const words = wordCount(value);

  return (
    <section aria-labelledby="termin-zusammenfassung" className="flex flex-col gap-3">
      <h2 id="termin-zusammenfassung" className="font-semibold text-lg">
        {text.title}
      </h2>
      {data.accepted && (
        <AiDraft
          evidence={{ draft: data.accepted, relationshipId: relationshipId }}
          confirmed
          heading={text.acceptedHeading(
            format.date(data.accepted.decidedAt ?? data.accepted.createdAt),
          )}
          sourcesLabel={text.sources}
          sources={sources}
        >
          <p className="whitespace-pre-line">{data.accepted.content}</p>
        </AiDraft>
      )}
      {draft ? (
        <AiDraft
          evidence={{ draft: draft, relationshipId: relationshipId }}
          heading={text.heading}
          sourcesLabel={text.sources}
          sources={sources}
          actions={
            <>
              <Button
                size="sm"
                loading={busy === 'accept'}
                disabled={words === 0 || words > maxPreReadWords}
                onClick={() =>
                  void run('accept', () =>
                    acceptPreRead(accessToken, base, meetingId, draft.id, { content: value }),
                  )
                }
              >
                {text.accept}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy !== null}
                onClick={() =>
                  void run('discard', () =>
                    discardPreRead(
                      accessToken,
                      base,
                      meetingId,
                      draft.id,
                      draft.claims ? { reason } : {},
                    ),
                  )
                }
              >
                {text.discard}
              </Button>
            </>
          }
        >
          <FormField label={text.field} hint={text.words(words, maxPreReadWords)}>
            {(field) => (
              <Textarea
                {...field}
                rows={8}
                maxLength={4000}
                value={value}
                aria-invalid={words > maxPreReadWords || undefined}
                onChange={(event) =>
                  setEdits((current) => ({ ...current, [draft.id]: event.target.value }))
                }
              />
            )}
          </FormField>
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
        data.canDraft && (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm">{text.intro}</p>
            <Button
              variant="secondary"
              className="self-start"
              loading={busy === 'propose'}
              onClick={() =>
                void run('propose', () => proposePreRead(accessToken, base, meetingId))
              }
            >
              {text.action}
            </Button>
          </div>
        )
      )}
      {busy === 'propose' && <StatusLine message={text.working} />}
      {failed && <StatusLine message={text.failed} tone="warning" />}
      <p className="text-muted-foreground text-sm">{text.ownOnly}</p>
    </section>
  );
}
