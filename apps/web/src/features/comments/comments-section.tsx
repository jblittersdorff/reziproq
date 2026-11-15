import type { Comment, CommentObjectType, CommentPerson } from '@reziproq/shared';
import { commentMaxLength } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { ErrorState } from '@/components/ui/error-state';
import { ListCard, ListCardHeader } from '@/components/ui/list-card';
import { LoadingState } from '@/components/ui/loading-state';
import { Monogram } from '@/components/ui/monogram';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Textarea } from '@/components/ui/textarea';
import { VisibilityBadge } from '@/components/ui/visibility-badge';
import { useToken } from '@/features/ratings/use-rating';
import {
  commentsQueryOptions,
  createComment,
  editComment,
  removeComment,
  type TeamSide,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface Place {
  side: TeamSide;
  relationshipId: string;
}

/** Text hinter dem letzten „@“ am Ende, solange er kein Leerzeichen enthält; sonst null. */
export function mentionQuery(text: string): string | null {
  const match = /(?:^|\s)@([^\s@]*)$/.exec(text);
  return match ? (match[1] ?? '') : null;
}

/**
 * Kommentare unter einem Objekt (QS-02): neueste unten, Feld direkt auf der Seite, daneben der
 * Schalter Intern oder Geteilt (Standard Geteilt). Nach „@“ steht fest unter dem Feld eine Liste
 * im Seitenfluss, kein aufklappendes Fenster (PLT-10), mit nur den Personen, die das Objekt und den
 * Kommentar sehen dürfen.
 */
export function CommentsSection({
  place,
  objectType,
  objectId,
}: {
  place: Place;
  objectType: CommentObjectType;
  objectId: string;
}) {
  const t = useT();
  const text = t.comments;
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const options = commentsQueryOptions(
    accessToken,
    place.side,
    place.relationshipId,
    objectType,
    objectId,
  );
  const query = useQuery({ ...options, enabled: accessToken !== '' });
  const headingId = useId();

  const store = (data: Awaited<ReturnType<typeof createComment>>) => {
    queryClient.setQueryData(options.queryKey, data);
  };

  return (
    <ListCard aria-labelledby={headingId} data-slot="comments">
      <ListCardHeader id={headingId} title={text.title} />
      {query.isError ? (
        <div className="px-5.5 pb-5.5">
          <ErrorState title={text.failed} />
        </div>
      ) : !query.data ? (
        <div className="px-5.5 pb-5.5">
          <LoadingState label={text.loading} />
        </div>
      ) : (
        <>
          {query.data.comments.length === 0 ? (
            <p className="px-5.5 pb-4 text-muted-foreground">{text.empty}</p>
          ) : (
            <ol aria-label={text.title}>
              {query.data.comments.map((comment) => (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  onEdit={async (body) =>
                    store(
                      await editComment(
                        accessToken,
                        place.side,
                        place.relationshipId,
                        objectType,
                        objectId,
                        comment.id,
                        { body },
                      ),
                    )
                  }
                  onRemove={async () =>
                    store(
                      await removeComment(
                        accessToken,
                        place.side,
                        place.relationshipId,
                        objectType,
                        objectId,
                        comment.id,
                      ),
                    )
                  }
                />
              ))}
            </ol>
          )}
          {query.data.canComment ? (
            <CommentForm
              objectInternal={query.data.objectVisibility === 'internal'}
              people={query.data.people}
              onSend={async (request) =>
                store(
                  await createComment(
                    accessToken,
                    place.side,
                    place.relationshipId,
                    objectType,
                    objectId,
                    request,
                  ),
                )
              }
            />
          ) : (
            <p className="border-line-soft border-t px-5.5 py-4 text-muted-foreground text-sm">
              {text.readOnly}
            </p>
          )}
        </>
      )}
    </ListCard>
  );
}

function CommentRow({
  comment,
  onEdit,
  onRemove,
}: {
  comment: Comment;
  onEdit: (body: string) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const t = useT();
  const text = t.comments;
  const format = useFormat();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body ?? '');
  const [failed, setFailed] = useState(false);
  const fieldId = useId();
  const removed = comment.deletedAt !== null;

  const save = async () => {
    setFailed(false);
    try {
      await onEdit(draft.trim());
      setEditing(false);
    } catch {
      setFailed(true);
    }
  };

  return (
    <li
      data-comment={comment.id}
      className="flex gap-3.5 border-line-soft border-t px-5.5 py-4 first:border-t-0"
    >
      <Monogram name={comment.authorName} tone={comment.side === 'buyer' ? 'neutral' : 'shared'} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <strong className="font-semibold">{comment.authorName}</strong>
          <span className="text-muted-foreground">
            {text.sides[comment.side]} · {format.dateTime(comment.createdAt)}
            {comment.editedAt && !removed && ` · ${text.edited}`}
          </span>
          {comment.visibility === 'internal' && (
            <VisibilityBadge visibility="internal" label={text.internal} />
          )}
        </p>
        {removed ? (
          <p className="text-muted-foreground">{text.removed}</p>
        ) : editing ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={fieldId} className="sr-only">
              {text.field}
            </label>
            <Textarea
              id={fieldId}
              value={draft}
              maxLength={commentMaxLength}
              onChange={(event) => setDraft(event.target.value)}
            />
            {failed && (
              <p role="alert" className="text-destructive text-sm">
                {text.failedSave}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void save()} disabled={!draft.trim()}>
                {text.save}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                {text.cancel}
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words">{comment.body}</p>
        )}
        {!removed && !editing && (comment.canEdit || comment.canDelete) && (
          <div className="flex flex-wrap items-center gap-2">
            {comment.canEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(comment.body ?? '');
                  setEditing(true);
                }}
              >
                {text.edit}
              </Button>
            )}
            {comment.canDelete && (
              <ConfirmButton
                question={text.removeQuestion}
                confirmLabel={text.removeConfirm}
                cancelLabel={text.cancel}
                onConfirm={() => void onRemove()}
              >
                {text.remove}
              </ConfirmButton>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function CommentForm({
  objectInternal,
  people,
  onSend,
}: {
  objectInternal: boolean;
  people: { internal: CommentPerson[]; shared: CommentPerson[] };
  onSend: (request: {
    visibility: 'internal' | 'shared';
    body: string;
    mentions: string[];
  }) => Promise<void>;
}) {
  const t = useT();
  const text = t.comments;
  const fieldId = useId();
  const listId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<'internal' | 'shared'>(
    objectInternal ? 'internal' : 'shared',
  );
  const [mentioned, setMentioned] = useState<CommentPerson[]>([]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const allowed = visibility === 'internal' ? people.internal : people.shared;
  const search = mentionQuery(body);
  const matches =
    search === null
      ? []
      : allowed.filter((person) =>
          person.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
        );

  const pick = (person: CommentPerson) => {
    setBody((current) => `${current.replace(/@[^\s@]*$/, '')}@${person.name} `);
    setMentioned((current) =>
      current.some((entry) => entry.userId === person.userId) ? current : [...current, person],
    );
    field.current?.focus();
  };

  const send = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    // Nur wer noch im Text steht und diesen Kommentar sehen darf, wird erwähnt.
    const mentions = mentioned
      .filter((person) => trimmed.includes(`@${person.name}`))
      .filter((person) => allowed.some((entry) => entry.userId === person.userId))
      .map((person) => person.userId);
    setSaving(true);
    setFailed(false);
    try {
      await onSend({ visibility, body: trimmed, mentions });
      setBody('');
      setMentioned([]);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3 border-line-soft border-t bg-paper px-5.5 py-4"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <label htmlFor={fieldId} className="font-semibold text-sm">
        {text.field}
      </label>
      <Textarea
        ref={field}
        id={fieldId}
        value={body}
        maxLength={commentMaxLength}
        placeholder={text.placeholder}
        aria-controls={search !== null ? listId : undefined}
        onChange={(event) => setBody(event.target.value)}
      />
      {search !== null && (
        // Fest im Seitenfluss unter dem Feld, kein aufklappendes Fenster (PLT-10).
        <section aria-label={text.mention} id={listId} className="flex flex-col gap-1.5">
          <p className="font-semibold text-muted-foreground text-sm">{text.mention}</p>
          {matches.length === 0 ? (
            <p className="text-muted-foreground text-sm">{text.noPeople}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {matches.map((person) => (
                <li key={person.userId}>
                  <Button type="button" variant="secondary" size="sm" onClick={() => pick(person)}>
                    {person.name}
                    <span className="text-muted-foreground"> · {text.sides[person.side]}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {text.failedSave}
        </p>
      )}
      <div className={cn('flex flex-wrap items-center gap-3', 'justify-between')}>
        {objectInternal ? (
          <p className="text-muted-foreground text-sm">{text.internalOnly}</p>
        ) : (
          <SegmentedControl
            label={text.visibility}
            value={visibility}
            onChange={setVisibility}
            options={[
              { value: 'shared', label: text.shared },
              { value: 'internal', label: text.internal },
            ]}
          />
        )}
        <Button type="submit" loading={saving} disabled={!body.trim()}>
          {text.send}
        </Button>
      </div>
    </form>
  );
}
