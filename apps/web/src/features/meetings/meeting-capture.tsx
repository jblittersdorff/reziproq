import type { CaptureDraft, CaptureKind, EditCaptureItem, MeetingCapture } from '@reziproq/shared';
import { maxCaptureChars } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ChangeEvent, useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { NextStep } from '@/components/ui/next-step';
import { StatusLine } from '@/components/ui/status-line';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { VisibilityBadge } from '@/components/ui/visibility-badge';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import {
  acceptCapture,
  captureQueryOptions,
  discardCapture,
  editCapture,
  evaluateCapture,
  shareCaptureProtocol,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const groups: { key: string; kinds: CaptureKind[] }[] = [
  { key: 'changes', kinds: ['commitment_change'] },
  { key: 'commitments', kinds: ['commitment'] },
  { key: 'actions', kinds: ['action'] },
  { key: 'decisions', kinds: ['decision', 'open_question'] },
  { key: 'goals', kinds: ['goal_check'] },
];

/**
 * KI-17 Ergebnisse nach dem Termin (nach Termin-Ergebnisse.dc.html): Notizen erfassen und
 * auswerten, Entwürfe in Gruppen mit Fundstelle, Schalter „Für den Lieferanten sichtbar“,
 * Übernehmen, Ändern, Verwerfen, „Alle übernehmen“; rechts das Protokoll so, wie der Lieferant es
 * sieht, und „Protokoll teilen“ mit Bestätigung. Nur beim Käufer.
 */
export function MeetingCapturePanel({
  relationshipId,
  meetingId,
  supplier,
}: {
  relationshipId: string;
  meetingId: string;
  supplier: string;
}) {
  const t = useT();
  const text = t.meetings.capture;
  const format = useFormat();
  const accessToken = useToken();
  const client = useQueryClient();
  const options = captureQueryOptions(accessToken, relationshipId, meetingId);
  const query = useQuery({ ...options, enabled: accessToken !== '' });
  const [notes, setNotes] = useState<string | null>(null);
  const [source, setSource] = useState<'typed' | 'pasted' | 'file'>('typed');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'warning' } | null>(
    null,
  );
  const notesId = useId();
  const capture = query.data;
  if (query.isError) return null;
  if (!capture) return <LoadingState label={text.loading} />;

  const act = async (key: string, work: () => Promise<MeetingCapture>, note: string) => {
    setBusy(key);
    setMessage(null);
    try {
      const result = await work();
      client.setQueryData(options.queryKey, result);
      await client.invalidateQueries({ queryKey: ['termine'], exact: false });
      setSelected([]);
      setMessage(
        result.failed && result.failed.length > 0
          ? { text: text.partlyFailed(result.failed.length), tone: 'warning' }
          : { text: note, tone: 'success' },
      );
      return true;
    } catch (error) {
      const code = (error as { body?: { code?: string } }).body?.code;
      setMessage({ text: (code && text.errors[code]) || text.failed, tone: 'warning' });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const open = capture.drafts.filter((draft) => draft.status === 'draft');
  const accepted = capture.drafts.filter((draft) => draft.status === 'accepted');
  const value = notes ?? capture.notes?.text ?? '';
  const sharedOpen = open.filter(
    (draft) => draft.item.visibility === 'shared' && draft.item.kind !== 'goal_check',
  );
  const counts = (kind: CaptureKind) => open.filter((draft) => draft.item.kind === kind).length;

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.(txt|md)$/i.test(file.name) && file.type !== 'text/plain') {
      setMessage({ text: text.fileOnlyText, tone: 'warning' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ text: text.fileTooLarge, tone: 'warning' });
      return;
    }
    setNotes(await file.text());
    setSource('file');
  };

  if (!capture.open) {
    return (
      <section className="flex flex-col gap-2 rounded-lg bg-card p-6 shadow-card">
        <h2 className="font-display font-semibold text-section tracking-section">{text.title}</h2>
        <p className="text-muted-foreground">{text.notYet}</p>
      </section>
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-5" data-slot="meeting-capture">
      <div className="flex min-w-0 shrink grow-2 basis-130 flex-col gap-5">
        {message && (
          <StatusLine
            message={message.text}
            tone={message.tone}
            onHidden={() => setMessage(null)}
          />
        )}
        {capture.canCapture && (
          <section
            aria-labelledby="ergebnisse-erfassen"
            className="flex flex-col gap-3 rounded-lg bg-card p-6 shadow-card"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="ergebnisse-erfassen"
                className="font-display font-semibold text-section tracking-section"
              >
                {text.captureTitle}
              </h2>
              <VisibilityBadge visibility="internal" label={text.onlyYou} />
            </div>
            {capture.notes && (
              <p className="text-muted-foreground text-sm">
                {text.savedBy(
                  capture.notes.createdByName,
                  format.dateTime(capture.notes.createdAt),
                )}
              </p>
            )}
            <label htmlFor={notesId} className="font-semibold text-sm">
              {text.notesLabel}
            </label>
            <Textarea
              id={notesId}
              rows={8}
              maxLength={maxCaptureChars}
              value={value}
              placeholder={text.placeholder}
              onPaste={() => setSource('pasted')}
              onChange={(event) => {
                setNotes(event.target.value);
                if (source === 'file') setSource('typed');
              }}
            />
            <p className="text-muted-foreground text-sm">{text.notesHint}</p>
            <div className="flex flex-wrap items-center gap-2">
              <label
                className={cn(
                  buttonVariants({ variant: 'secondary', size: 'sm' }),
                  'cursor-pointer focus-within:ring-3 focus-within:ring-ring/50',
                )}
              >
                {text.addFile}
                <input
                  type="file"
                  accept=".txt,.md,text/plain"
                  className="sr-only"
                  onChange={(event) => void onFile(event)}
                />
              </label>
              <Button
                size="sm"
                variant="secondary"
                disabled={value.trim().length === 0}
                loading={busy === 'evaluate'}
                onClick={() =>
                  void act(
                    'evaluate',
                    () =>
                      evaluateCapture(accessToken, relationshipId, meetingId, {
                        source,
                        text: value.trim(),
                      }),
                    text.evaluated,
                  ).then((ok) => ok && setNotes(null))
                }
              >
                {text.evaluate}
              </Button>
            </div>
          </section>
        )}
        {(open.length > 0 || accepted.length > 0) && (
          <NextStep
            eyebrow={text.nextEyebrow}
            title={
              open.length > 0
                ? text.nextReview(open.length)
                : capture.protocol.sharedAt
                  ? text.nextShared
                  : text.nextShare
            }
            text={
              open.length > 0
                ? text.summary({
                    commitments: counts('commitment'),
                    actions: counts('action'),
                    decisions: counts('decision'),
                    questions: counts('open_question'),
                    changes: counts('commitment_change'),
                  })
                : capture.protocol.sharedAt
                  ? text.sharedAt(format.dateTime(capture.protocol.sharedAt))
                  : text.shareHint
            }
            action={
              capture.canDecide && open.length > 0 && sharedOpen.length > 0 ? (
                <Button
                  variant="mint"
                  size="hero"
                  loading={busy === 'all'}
                  onClick={() =>
                    void act(
                      'all',
                      () =>
                        acceptCapture(
                          accessToken,
                          relationshipId,
                          meetingId,
                          sharedOpen.map((draft) => draft.id),
                        ),
                      text.acceptedAll,
                    )
                  }
                >
                  {text.acceptAllShared}
                </Button>
              ) : capture.canDecide && open.length === 0 && !capture.protocol.sharedAt ? (
                routerLink({
                  href: '#ergebnisse-protokoll',
                  className: buttonVariants({ variant: 'mint', size: 'hero' }),
                  children: text.shareProtocol,
                })
              ) : undefined
            }
          />
        )}
        {capture.canDecide && selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-mint-soft px-4 py-3">
            <span className="text-sm">{text.selected(selected.length)}</span>
            <Button
              size="sm"
              variant="secondary"
              loading={busy === 'selected'}
              onClick={() =>
                void act(
                  'selected',
                  () => acceptCapture(accessToken, relationshipId, meetingId, selected),
                  text.acceptedAll,
                )
              }
            >
              {text.acceptSelected}
            </Button>
          </div>
        )}
        {groups.map((group) => {
          const drafts = capture.drafts.filter((draft) => group.kinds.includes(draft.item.kind));
          if (drafts.length === 0) return null;
          return (
            <section
              key={group.key}
              aria-labelledby={`ergebnisse-${group.key}`}
              className="flex flex-col gap-2 rounded-lg bg-card p-6 shadow-card"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id={`ergebnisse-${group.key}`}
                  className="font-display font-semibold text-section tracking-section"
                >
                  {text.groups[group.key]}
                </h2>
                {group.key === 'goals' && (
                  <VisibilityBadge visibility="internal" label={text.onlyYou} />
                )}
              </div>
              <ul className="flex flex-col divide-y divide-line-soft">
                {drafts.map((draft) => (
                  <CaptureRow
                    key={draft.id}
                    draft={draft}
                    capture={capture}
                    supplier={supplier}
                    busy={busy}
                    checked={selected.includes(draft.id)}
                    onCheck={(checked) =>
                      setSelected((current) =>
                        checked
                          ? [...current, draft.id]
                          : current.filter((entry) => entry !== draft.id),
                      )
                    }
                    onAccept={() =>
                      void act(
                        `${draft.id}-ok`,
                        () => acceptCapture(accessToken, relationshipId, meetingId, [draft.id]),
                        text.accepted,
                      )
                    }
                    onDiscard={() =>
                      void act(
                        `${draft.id}-no`,
                        () => discardCapture(accessToken, relationshipId, meetingId, draft.id),
                        text.discarded,
                      )
                    }
                    onEdit={(input) =>
                      act(
                        `${draft.id}-edit`,
                        () => editCapture(accessToken, relationshipId, meetingId, draft.id, input),
                        text.saved,
                      )
                    }
                  />
                ))}
              </ul>
              {group.key === 'goals' && (
                <p className="text-muted-foreground text-sm">{text.goalsHint}</p>
              )}
            </section>
          );
        })}
      </div>
      <aside className="flex min-w-0 shrink grow basis-75 flex-col gap-5">
        <section
          id="ergebnisse-protokoll"
          aria-labelledby="ergebnisse-protokoll-titel"
          className="flex scroll-mt-32 flex-col gap-3 rounded-lg border-2 border-mint bg-card p-6"
        >
          <h2
            id="ergebnisse-protokoll-titel"
            className="font-display font-semibold text-section tracking-section"
          >
            {text.protocolTitle(supplier)}
          </h2>
          {capture.protocol.text ? (
            <p className="whitespace-pre-line text-sm">{capture.protocol.text}</p>
          ) : (
            <p className="text-muted-foreground text-sm">{text.protocolEmpty}</p>
          )}
          <p className="text-muted-foreground text-sm">
            {text.internalCount(capture.protocol.internalCount)}
          </p>
          {capture.protocol.sharedAt && (
            <Badge variant="shared">
              {text.sharedAt(format.dateTime(capture.protocol.sharedAt))}
            </Badge>
          )}
          {capture.canDecide &&
            (confirming ? (
              <div className="flex flex-col gap-3 rounded-md bg-paper p-4">
                <p className="font-semibold text-sm">{text.confirmTitle}</p>
                <p className="text-sm">
                  {text.recipients(
                    supplier,
                    capture.participants
                      .filter((person) => person.side === 'supplier')
                      .map((person) => person.name)
                      .join(', '),
                  )}
                </p>
                <p className="text-muted-foreground text-sm">{text.confirmHint}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    loading={busy === 'share'}
                    onClick={() =>
                      void act(
                        'share',
                        () => shareCaptureProtocol(accessToken, relationshipId, meetingId),
                        text.sharedNote,
                      ).then(() => setConfirming(false))
                    }
                  >
                    {text.confirmShare}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                    {text.cancel}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="secondary"
                className="self-start"
                disabled={accepted.every(
                  (draft) => draft.item.visibility !== 'shared' || draft.item.kind === 'goal_check',
                )}
                onClick={() => setConfirming(true)}
              >
                {text.shareProtocol}
              </Button>
            ))}
          <p className="text-muted-foreground text-sm">{text.shareRule}</p>
        </section>
        <section
          aria-labelledby="ergebnisse-folgen"
          className="flex flex-col gap-2 rounded-lg bg-card p-6 shadow-card"
        >
          <h2
            id="ergebnisse-folgen"
            className="font-display font-semibold text-section tracking-section"
          >
            {text.whatFollows}
          </h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            {text.follows.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

function CaptureRow({
  draft,
  capture,
  supplier,
  busy,
  checked,
  onCheck,
  onAccept,
  onDiscard,
  onEdit,
}: {
  draft: CaptureDraft;
  capture: MeetingCapture;
  supplier: string;
  busy: string | null;
  checked: boolean;
  onCheck: (checked: boolean) => void;
  onAccept: () => void;
  onDiscard: () => void;
  onEdit: (input: EditCaptureItem) => Promise<boolean>;
}) {
  const t = useT();
  const text = t.meetings.capture;
  const format = useFormat();
  const item = draft.item;
  const open = draft.status === 'draft';
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [owner, setOwner] = useState(item.owner ?? '');
  const [dueOn, setDueOn] = useState(item.dueOn ?? '');
  const switchId = useId();
  const withOwner = item.kind === 'commitment' || item.kind === 'action';
  const sideName = item.side === 'supplier' ? supplier : text.sideYou;
  const meta = [
    item.kind === 'commitment' ? sideName : null,
    item.kind === 'open_question' ? text.openQuestion : null,
    item.kind === 'decision' ? text.decision : null,
    item.owner,
    item.addressee ? text.to(item.addressee) : null,
    item.dueOn ? text.until(format.date(item.dueOn)) : null,
    item.kind === 'commitment_change' && item.proposal ? text.proposals[item.proposal] : null,
    item.kind === 'goal_check' && item.goalStatus ? text.goalStatuses[item.goalStatus] : null,
  ].filter(Boolean);
  return (
    <li className="flex flex-col gap-2 py-4">
      <div className="flex flex-wrap items-start gap-3">
        {capture.canDecide && open && item.kind !== 'goal_check' && (
          <Checkbox
            aria-label={text.select(item.title)}
            checked={checked}
            onCheckedChange={(value) => onCheck(value === true)}
            className="mt-1"
          />
        )}
        <span className="flex min-w-0 grow basis-64 flex-col gap-1 text-sm">
          <span className="font-semibold text-base">{item.title}</span>
          {meta.length > 0 && <span className="text-muted-foreground">{meta.join(' · ')}</span>}
          {item.ownerUnclear && withOwner && (
            <span className="font-semibold text-warning-soft-foreground">{text.ownerUnclear}</span>
          )}
          {item.dateUnclear && withOwner && (
            <span className="font-semibold text-warning-soft-foreground">{text.dateUnclear}</span>
          )}
          {item.reason && item.kind === 'goal_check' && (
            <span className="text-muted-foreground">{item.reason}</span>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {item.kind === 'goal_check' ? (
            <VisibilityBadge visibility="internal" label={text.private} />
          ) : capture.canDecide && open ? (
            <span className="flex items-center gap-2">
              <Switch
                id={switchId}
                checked={item.visibility === 'shared'}
                disabled={busy !== null}
                onCheckedChange={(value) =>
                  void onEdit({ visibility: value ? 'shared' : 'internal' })
                }
              />
              <label htmlFor={switchId} className="text-sm">
                {text.visibleForSupplier}
              </label>
            </span>
          ) : (
            <VisibilityBadge
              visibility={item.visibility}
              label={item.visibility === 'shared' ? text.shared : text.private}
            />
          )}
          {!open && (
            <Badge>{draft.status === 'accepted' ? text.acceptedBadge : text.discardedBadge}</Badge>
          )}
        </span>
      </div>
      {item.quote && (
        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer py-2 text-muted-foreground">
            {text.quote}
          </summary>
          <blockquote className="border-line border-l-2 pl-3 italic">„{item.quote}“</blockquote>
        </details>
      )}
      {editing && (
        <div className="grid gap-3 rounded-md bg-paper p-3 sm:grid-cols-3">
          <FormField label={text.titleLabel}>
            {(field) => (
              <Input {...field} value={title} onChange={(event) => setTitle(event.target.value)} />
            )}
          </FormField>
          {withOwner && (
            <FormField label={text.ownerLabel}>
              {(field) => (
                <NativeSelect
                  {...field}
                  value={owner}
                  onChange={(event) => setOwner(event.target.value)}
                >
                  <option value="">{text.ownerNone}</option>
                  {capture.participants.map((person) => (
                    <option key={person.name} value={person.name}>
                      {person.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          )}
          {withOwner && (
            <FormField label={text.dueLabel}>
              {(field) => (
                <Input
                  {...field}
                  type="date"
                  value={dueOn}
                  onChange={(event) => setDueOn(event.target.value)}
                />
              )}
            </FormField>
          )}
          <div className="flex flex-wrap gap-2 sm:col-span-3">
            <Button
              size="sm"
              variant="secondary"
              loading={busy === `${draft.id}-edit`}
              onClick={() =>
                void onEdit({
                  title: title.trim() || item.title,
                  ...(withOwner ? { owner: owner || null, dueOn: dueOn || null } : {}),
                }).then((ok) => ok && setEditing(false))
              }
            >
              {text.save}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              {text.cancel}
            </Button>
          </div>
        </div>
      )}
      {capture.canDecide && open && !editing && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            loading={busy === `${draft.id}-ok`}
            onClick={onAccept}
          >
            {text.accept}
          </Button>
          {item.kind !== 'goal_check' && item.kind !== 'commitment_change' && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              {text.edit}
            </Button>
          )}
          <Button size="sm" variant="ghost" loading={busy === `${draft.id}-no`} onClick={onDiscard}>
            {text.discard}
          </Button>
        </div>
      )}
    </li>
  );
}
