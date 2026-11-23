import type { AiDraft as Draft, QbrPrep } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AiDraft } from '@/components/ui/ai-draft';
import { Button } from '@/components/ui/button';
import { StatusLine } from '@/components/ui/status-line';
import { useToken } from '@/features/ratings/use-rating';
import {
  addPrepTopicToAgenda,
  agentsQueryOptions,
  decideQbrPrep,
  qbrPrepQueryOptions,
  startAgent,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';

type Part = 'topics' | 'risks' | 'openPoints';

/**
 * KI-07: interne QBR-Vorbereitung von Reziproq, nur beim Käufer. Themen, Risiken und offene Punkte
 * als Entwürfe mit Quelle; ein übernommenes Thema geht nur ausdrücklich und nur als Titel in die
 * geteilte Agenda. Der Lieferant sieht diesen Bereich nie.
 */
export function QbrPrepPanel({
  relationshipId,
  meetingId,
}: {
  relationshipId: string;
  meetingId: string;
}) {
  const t = useT();
  const text = t.meetings.prep;
  const format = useFormat();
  const accessToken = useToken();
  const client = useQueryClient();
  const options = qbrPrepQueryOptions(accessToken, relationshipId, meetingId);
  const query = useQuery({ ...options, enabled: accessToken !== '' });
  const agents = useQuery({ ...agentsQueryOptions(accessToken), enabled: accessToken !== '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const data = query.data;
  if (!data) return null;
  const agent = agents.data?.agents.find((entry) => entry.key === 'qbr_prep');

  const act = async (key: string, work: () => Promise<QbrPrep>, note: string) => {
    setBusy(key);
    try {
      client.setQueryData(options.queryKey, await work());
      await client.invalidateQueries({ queryKey: ['termine'] });
      setMessage(note);
    } finally {
      setBusy(null);
    }
  };

  const part = (key: Part) => {
    const entry = data[key];
    const shown: Draft | null = entry.draft ?? entry.accepted;
    if (!shown) return null;
    const open = shown.status === 'draft';
    return (
      <AiDraft
        key={key}
        heading={`${text.parts[key]} · ${open ? text.draftOf(format.date(shown.createdAt)) : text.accepted}`}
        sourcesLabel={text.sources}
        sources={[]}
        evidence={{ draft: shown, relationshipId }}
        confirmed={!open}
        actions={
          data.canDraft && open ? (
            <>
              <Button
                size="sm"
                loading={busy === `${shown.id}-ok`}
                onClick={() =>
                  act(
                    `${shown.id}-ok`,
                    () =>
                      decideQbrPrep(
                        accessToken,
                        relationshipId,
                        meetingId,
                        shown.id,
                        'uebernehmen',
                      ),
                    text.acceptedNote,
                  )
                }
              >
                {text.accept}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                loading={busy === `${shown.id}-no`}
                onClick={() =>
                  act(
                    `${shown.id}-no`,
                    () =>
                      decideQbrPrep(accessToken, relationshipId, meetingId, shown.id, 'verwerfen'),
                    text.discardedNote,
                  )
                }
              >
                {text.discard}
              </Button>
            </>
          ) : key === 'topics' && data.canDraft && !open ? (
            <div className="flex flex-col gap-2">
              {(shown.claims ?? []).map((claim) => {
                const title = claim.text.split(' — ')[0] ?? claim.text;
                return (
                  <Button
                    key={claim.key}
                    size="sm"
                    variant="secondary"
                    className="self-start whitespace-normal text-left"
                    loading={busy === `${shown.id}-${claim.key}`}
                    onClick={() =>
                      act(
                        `${shown.id}-${claim.key}`,
                        () =>
                          addPrepTopicToAgenda(
                            accessToken,
                            relationshipId,
                            meetingId,
                            shown.id,
                            claim.key,
                          ),
                        text.addedNote,
                      )
                    }
                  >
                    {text.toAgenda(title)}
                  </Button>
                );
              })}
            </div>
          ) : undefined
        }
      >
        <p className="text-muted-foreground">{text.partHints[key]}</p>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
          {(shown.claims ?? []).map((claim) => (
            <li key={claim.key}>{claim.text}</li>
          ))}
        </ul>
      </AiDraft>
    );
  };

  const parts = (['topics', 'risks', 'openPoints'] as Part[]).map(part).filter(Boolean);
  return (
    <section aria-labelledby="termin-vorbereitung" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="termin-vorbereitung" className="font-semibold text-lg">
          {text.title}
        </h2>
        {data.canDraft && agent?.enabled && (
          <Button
            size="sm"
            variant="secondary"
            loading={busy === 'run'}
            onClick={async () => {
              setBusy('run');
              try {
                await startAgent(accessToken, agent.id, {
                  relationshipId,
                  meetingId,
                  isTest: false,
                });
                setMessage(text.running);
              } finally {
                setBusy(null);
              }
            }}
          >
            {text.rerun}
          </Button>
        )}
      </div>
      {message && <StatusLine message={message} onHidden={() => setMessage(null)} />}
      {parts.length === 0 ? (
        <p className="rounded-lg bg-card px-4 py-3 text-muted-foreground">{text.empty}</p>
      ) : (
        parts
      )}
    </section>
  );
}
