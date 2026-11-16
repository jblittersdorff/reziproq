import {
  type FeedbackThemes,
  feedbackThemesOf,
  minFreeTextsForThemes,
  type SurveySide,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AiDraft } from '@/components/ui/ai-draft';
import { Button } from '@/components/ui/button';
import { StatusLine } from '@/components/ui/status-line';
import { useToken } from '@/features/ratings/use-rating';
import {
  ApiError,
  decideFeedbackThemes,
  feedbackThemesQueryOptions,
  summarizeFreeTexts,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';

/**
 * PUL-08: Themen der Freitexte über den Freitexten. Den Entwurf sehen nur SRO bzw. Key Account
 * Manager und Admins; die übernommene Zusammenfassung sieht nur die eigene Seite.
 */
export function FeedbackThemesPanel({
  side,
  relationshipId,
  waveId,
}: {
  side: SurveySide;
  relationshipId: string;
  waveId: string;
}) {
  const text = useT().feedback.themes;
  const format = useFormat();
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const options = feedbackThemesQueryOptions(accessToken, side, relationshipId, waveId);
  const query = useQuery({ ...options, enabled: accessToken !== '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, work: () => Promise<FeedbackThemes>) => {
    setBusy(key);
    setError(null);
    try {
      queryClient.setQueryData(options.queryKey, await work());
    } catch (failure) {
      const quoted =
        failure instanceof ApiError &&
        (failure.body as { code?: string } | undefined)?.code === 'zitat';
      setError(quoted ? text.quoted : text.failed);
    } finally {
      setBusy(null);
    }
  };

  const data = query.data;
  // Ohne Zusammenfassung und ohne Recht dazu bleibt der Bereich leer; die Freitexte stehen darunter.
  if (!data || (!data.canSummarize && !data.accepted)) return null;
  const sources = [{ key: 'texts', label: text.source(data.freeTexts) }];
  const themes = (content: string) => (
    <ul className="list-disc space-y-1 pl-5">
      {feedbackThemesOf(content).map((theme) => (
        <li key={theme}>{theme}</li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-3">
      <h4 className="font-semibold">{text.title}</h4>
      {data.accepted && (
        <AiDraft
          confirmed
          heading={text.acceptedHeading(
            format.date(data.accepted.decidedAt ?? data.accepted.createdAt),
          )}
          sourcesLabel={text.sources}
          sources={sources}
        >
          {themes(data.accepted.content)}
        </AiDraft>
      )}
      {data.draft && (
        <AiDraft
          heading={text.draftHeading}
          sourcesLabel={text.sources}
          sources={sources}
          actions={
            <>
              <Button
                size="sm"
                loading={busy === 'accept'}
                onClick={() =>
                  void run('accept', () =>
                    decideFeedbackThemes(
                      accessToken,
                      side,
                      relationshipId,
                      waveId,
                      data.draft?.id ?? '',
                      'uebernehmen',
                    ),
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
                    decideFeedbackThemes(
                      accessToken,
                      side,
                      relationshipId,
                      waveId,
                      data.draft?.id ?? '',
                      'verwerfen',
                    ),
                  )
                }
              >
                {text.discard}
              </Button>
            </>
          }
        >
          {themes(data.draft.content)}
        </AiDraft>
      )}
      {data.canSummarize &&
        (data.freeTexts < minFreeTextsForThemes ? (
          <p className="text-muted-foreground text-sm">{text.tooFew(data.freeTexts)}</p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm">{text.intro}</p>
            <Button
              variant="secondary"
              className="self-start"
              loading={busy === 'summarize'}
              onClick={() =>
                void run('summarize', () =>
                  summarizeFreeTexts(accessToken, side, relationshipId, waveId),
                )
              }
            >
              {text.action}
            </Button>
          </div>
        ))}
      {busy === 'summarize' && <StatusLine message={text.working} />}
      {error && <StatusLine message={error} tone="warning" />}
      {(data.accepted || data.draft) && (
        <p className="text-muted-foreground text-sm">{text.ownOnly}</p>
      )}
    </div>
  );
}
