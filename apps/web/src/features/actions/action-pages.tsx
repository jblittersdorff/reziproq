import type {
  ActionItem,
  ActionList,
  CommitmentEvidence,
  MeetingSide,
  SurveyDimension,
  WorkItemKind,
  WorkItemStatus,
} from '@reziproq/shared';
import { actionStatuses, commitmentSettableStatuses } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ChevronRightIcon, ListChecksIcon, PlusIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Monogram } from '@/components/ui/monogram';
import { NativeSelect } from '@/components/ui/native-select';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { VisibilityBadge } from '@/components/ui/visibility-badge';
import { CommentsSection } from '@/features/comments/comments-section';
import { EvidenceForm, useEvidenceLine } from '@/features/commitments/commitment-evidence';
import { useHintWhy } from '@/features/hints/hints-pages';
import {
  apiBase,
  MeetingFrame,
  type MeetingPlace,
  SideBadge,
} from '@/features/meetings/meeting-pages';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader, useDocumentTitle } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import {
  actionListQueryOptions,
  createAction,
  hintQueryOptions,
  meetingQueryOptions,
  myActionsQueryOptions,
  setActionStatus,
  updateAction,
} from '@/lib/api';
import { flash, useFlash } from '@/lib/flash';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// QBR-03: Maßnahmen für beide Seiten, wie die Termine unter Umsetzung. Der Käufer arbeitet unter
// /lieferanten/<id>/umsetzung/massnahmen, der Lieferant unter /kunden/<beziehung>/umsetzung/massnahmen.
// Seit ZQ-01 (K2-a.3) zeigen die Seiten Zusagen (geteilt, Status je Seite, gehalten mit Beleg) und
// Aufgaben (intern) unter den alten Adressen, bis die Akte sie übernimmt (K2-c).

export const actionsBase = ({ side, relationshipId }: MeetingPlace) =>
  side === 'buyer'
    ? `/lieferanten/${relationshipId}/umsetzung/massnahmen`
    : `/kunden/${relationshipId}/umsetzung/massnahmen`;

/** Filter in der Adresse: Status (Standard offen), Art, Seite, die angelegt hat, verantwortliche Person. */
export interface ActionFilter {
  status?: 'alle' | WorkItemStatus | undefined;
  /** wie in Heute: zusage oder aufgabe */
  art?: 'zusage' | 'aufgabe' | undefined;
  seite?: MeetingSide | undefined;
  person?: string | undefined;
}

function useToken() {
  const auth = useAuth();
  return auth.user?.access_token ?? '';
}

function useActions(place: MeetingPlace) {
  const accessToken = useToken();
  const query = useQuery({
    ...actionListQueryOptions(accessToken, apiBase(place)),
    enabled: accessToken !== '',
  });
  return { ...query, accessToken };
}

function useRefreshActions() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['actions'] });
}

const artOf = (kind: WorkItemKind) => (kind === 'commitment' ? 'zusage' : 'aufgabe');

/** Offen heißt bei einer Aufgabe offen oder in Arbeit, bei einer Zusage offen (ZQ-01) */
const isOpen = (action: Pick<ActionItem, 'kind' | 'status'>) =>
  action.status === 'open' || (action.kind === 'task' && action.status === 'in_progress');

/** Status, nach denen sich filtern lässt, je Art; „Offen“ gilt für beide */
const filterStatuses: Record<WorkItemKind, WorkItemStatus[]> = {
  commitment: ['kept', 'missed', 'replaced', 'withdrawn'],
  task: ['in_progress', 'done', 'cancelled'],
};

export function filterActions(actions: ActionItem[], filter: ActionFilter) {
  return actions.filter(
    (action) =>
      (filter.status === 'alle'
        ? true
        : filter.status
          ? action.status === filter.status
          : isOpen(action)) &&
      (!filter.art || artOf(action.kind) === filter.art) &&
      (!filter.seite || action.side === filter.seite) &&
      (!filter.person || action.ownerName === filter.person),
  );
}

/** Umsetzung › Zusagen und Aufgaben: Liste mit Filtern in der Adresse; Status direkt in der Zeile. */
export function ActionsPage({ place, filter }: { place: MeetingPlace; filter: ActionFilter }) {
  const text = useT().actions;
  return (
    <MeetingFrame
      place={place}
      trail={[]}
      current={text.title}
      header={<PageHeader title={text.title} purpose={text.purpose} />}
    >
      <ActionsContent place={place} filter={filter} />
    </MeetingFrame>
  );
}

function ActionsContent({ place, filter }: { place: MeetingPlace; filter: ActionFilter }) {
  const t = useT();
  const text = t.actions;
  const navigate = useNavigate();
  const query = useActions(place);
  const [message, hideMessage] = useFlash();
  if (query.isError) return <ErrorState title={text.failed} />;
  if (!query.data) return <LoadingState label={text.loading} />;
  const { actions, canCreate } = query.data;
  const newButton = canCreate
    ? routerLink({
        href: `${actionsBase(place)}/neu`,
        className: buttonVariants(),
        children: (
          <>
            <PlusIcon />
            {text.new}
          </>
        ),
      })
    : undefined;
  if (actions.length === 0) {
    return (
      <EmptyState
        size="lg"
        icon={<ListChecksIcon aria-hidden />}
        title={text.emptyTitle}
        description={text.emptyText}
        action={newButton}
      />
    );
  }
  const shown = filterActions(actions, filter);
  const people = [...new Set(actions.map((action) => action.ownerName))].sort();
  const sides = place.side === 'buyer' ? t.meetings.sidesBuyerView : t.meetings.sidesSupplierView;
  const setFilter = (next: ActionFilter) =>
    void navigate({ to: actionsBase(place), search: { ...filter, ...next } as never });

  return (
    <>
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      {newButton && <div>{newButton}</div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label={text.filterStatus}>
          {(field) => (
            <NativeSelect
              {...field}
              value={filter.status ?? ''}
              onChange={(event) =>
                setFilter({ status: (event.target.value || undefined) as ActionFilter['status'] })
              }
            >
              <option value="">{text.filterOpen}</option>
              <option value="alle">{text.all}</option>
              <option value="open">{text.statuses.open}</option>
              {(['commitment', 'task'] as const).map((kind) => (
                <optgroup key={kind} label={text.kindsPlural[kind]}>
                  {filterStatuses[kind].map((status) => (
                    <option key={status} value={status}>
                      {text.statuses[status]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField label={text.filterKind}>
          {(field) => (
            <NativeSelect
              {...field}
              value={filter.art ?? ''}
              onChange={(event) =>
                setFilter({ art: (event.target.value || undefined) as ActionFilter['art'] })
              }
            >
              <option value="">{text.all}</option>
              <option value="zusage">{text.kindsPlural.commitment}</option>
              <option value="aufgabe">{text.kindsPlural.task}</option>
            </NativeSelect>
          )}
        </FormField>
        <FormField label={text.filterSide}>
          {(field) => (
            <NativeSelect
              {...field}
              value={filter.seite ?? ''}
              onChange={(event) =>
                setFilter({ seite: (event.target.value || undefined) as MeetingSide | undefined })
              }
            >
              <option value="">{text.all}</option>
              <option value="buyer">{sides.buyer}</option>
              <option value="supplier">{sides.supplier}</option>
            </NativeSelect>
          )}
        </FormField>
        <FormField label={text.filterPerson}>
          {(field) => (
            <NativeSelect
              {...field}
              value={filter.person ?? ''}
              onChange={(event) => setFilter({ person: event.target.value || undefined })}
            >
              <option value="">{text.all}</option>
              {people.map((person) => (
                <option key={person} value={person}>
                  {person}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </div>
      {shown.length === 0 ? (
        <p className="text-muted-foreground">{text.emptyFiltered}</p>
      ) : (
        <ul aria-label={text.title} className="overflow-hidden rounded-lg bg-card shadow-card">
          {shown.map((action) => (
            <ActionRow key={action.id} place={place} action={action} />
          ))}
        </ul>
      )}
    </>
  );
}

function ActionRow({ place, action }: { place: MeetingPlace; action: ActionItem }) {
  const t = useT();
  const text = t.actions;
  const format = useFormat();
  const token = useToken();
  const refresh = useRefreshActions();
  const evidenceLineOf = useEvidenceLine();
  const [failed, setFailed] = useState(false);
  // ZQ-01 Regel 2: „Gehalten“ fragt in der Zeile nach dem Beleg, statt sofort zu buchen
  const [asking, setAsking] = useState(false);
  const change = (status: WorkItemStatus, evidence?: CommitmentEvidence) => {
    setFailed(false);
    setActionStatus(token, apiBase(place), action.id, status, evidence)
      .then(() => {
        setAsking(false);
        return refresh();
      })
      .catch(() => setFailed(true));
  };
  const choose = (status: WorkItemStatus) => {
    if (action.kind === 'commitment' && status === 'kept') {
      setAsking(true);
      return;
    }
    setAsking(false);
    change(status);
  };
  // Eine ersetzte Zusage ist abgeschlossen; ihr Nachfolger trägt den Status weiter (Regel 3)
  const settable = action.canChangeStatus && action.status !== 'replaced';
  const statuses: readonly WorkItemStatus[] =
    action.kind === 'commitment' ? commitmentSettableStatuses : actionStatuses;
  const evidenceLine = evidenceLineOf(action.status, action.evidence);
  return (
    <li
      id={action.id}
      data-action={action.id}
      data-kind={action.kind}
      className="flex scroll-mt-32 flex-col gap-3 border-line-soft border-b px-5 py-4 last:border-b-0"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{action.title}</span>
            {action.visibility === 'internal' && (
              <VisibilityBadge visibility="internal" label={text.internal} />
            )}
            <SideBadge place={place} side={action.side} />
          </span>
          <span className="text-muted-foreground text-sm">
            {text.kinds[action.kind]} · {action.ownerName} ·{' '}
            <span className={cn(action.overdue && 'font-semibold text-destructive')}>
              {text.due(format.date(action.dueDate))}
              {action.overdue && ` · ${text.overdue}`}
            </span>{' '}
            · {text.sources[action.sourceType]}
            {action.sourceTitle ? `: ${action.sourceTitle}` : ''}
            {action.sourceDimension
              ? `: ${t.settings.survey.dimensions[action.sourceDimension] ?? ''}`
              : ''}
          </span>
          {evidenceLine && <span className="text-muted-foreground text-sm">{evidenceLine}</span>}
          {failed && <span className="text-destructive text-sm">{text.saveFailed}</span>}
        </div>
        <div className="flex items-center gap-3">
          {settable ? (
            <div className="w-40 shrink-0">
              <NativeSelect
                aria-label={text.statusOf(action.title)}
                value={asking ? 'kept' : action.status}
                onChange={(event) => choose(event.target.value as WorkItemStatus)}
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {text.statuses[status]}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : (
            <Badge>{text.statuses[action.status]}</Badge>
          )}
          {action.canEdit &&
            routerLink({
              href: `${actionsBase(place)}/${action.id}`,
              className: buttonVariants({ variant: 'outline', size: 'sm' }),
              'aria-label': `${action.title}: ${text.edit}`,
              children: text.edit,
            })}
        </div>
      </div>
      {settable && asking && (
        <EvidenceForm
          title={action.title}
          onBook={(evidence) => change('kept', evidence)}
          onCancel={() => setAsking(false)}
        />
      )}
    </li>
  );
}

/** Neue Zusage oder Aufgabe, auf Wunsch aus einem Termin (Quelle Termin). */
/** PUL-06: aus einer Feedback-Lücke, vorbefüllt mit der Dimension. */
export interface FeedbackGapSource {
  resultId: string;
  dimension: SurveyDimension;
}

export function NewActionPage({
  place,
  meetingId,
  hintId,
  gap,
}: {
  place: MeetingPlace;
  meetingId?: string;
  /** KI-16: aus einem Hinweis, Titel und Begründung vorausgefüllt, intern */
  hintId?: string;
  gap?: FeedbackGapSource;
}) {
  const text = useT().actions;
  return (
    <MeetingFrame
      place={place}
      trail={[{ label: text.title, href: actionsBase(place) }]}
      current={text.new}
      header={<PageHeader title={text.new} purpose={text.purpose} />}
    >
      <ActionFormLoader place={place} meetingId={meetingId} hintId={hintId} gap={gap} />
    </MeetingFrame>
  );
}

/** Bearbeiten: nur die Seite, die den Eintrag angelegt hat; Art und Quelle bleiben. */
export function EditActionPage({ place, actionId }: { place: MeetingPlace; actionId: string }) {
  const text = useT().actions;
  // Der Titel nennt die Aufgabe der Seite: Zusage oder Aufgabe bearbeiten (Regel 9)
  const kind = useActions(place).data?.actions.find((entry) => entry.id === actionId)?.kind;
  const title = kind ? text.editTitle[kind] : text.editTitleLoading;
  return (
    <MeetingFrame
      place={place}
      trail={[{ label: text.title, href: actionsBase(place) }]}
      current={title}
      header={<PageHeader title={title} purpose={text.purpose} />}
    >
      <ActionFormLoader place={place} actionId={actionId} />
    </MeetingFrame>
  );
}

function ActionFormLoader({
  place,
  meetingId,
  hintId,
  actionId,
  gap,
}: {
  place: MeetingPlace;
  meetingId?: string | undefined;
  hintId?: string | undefined;
  actionId?: string;
  gap?: FeedbackGapSource | undefined;
}) {
  const text = useT().actions;
  const query = useActions(place);
  const meeting = useQuery({
    ...meetingQueryOptions(query.accessToken, apiBase(place), meetingId ?? ''),
    enabled: query.accessToken !== '' && Boolean(meetingId),
  });
  const hint = useQuery({
    ...hintQueryOptions(query.accessToken, hintId ?? ''),
    enabled: query.accessToken !== '' && Boolean(hintId),
  });
  const why = useHintWhy();
  if (query.isError) return <ErrorState title={text.failed} />;
  if (
    !query.data ||
    (meetingId && !meeting.data && !meeting.isError) ||
    (hintId && !hint.data && !hint.isError)
  ) {
    return <LoadingState label={text.loading} />;
  }
  const existing = actionId ? query.data.actions.find((entry) => entry.id === actionId) : undefined;
  if (actionId && !existing) return <ErrorState title={text.notFound} />;
  // Kommentare hängen an der Zusage bzw. Aufgabe (ZQ-01), auch ohne Recht zum Bearbeiten
  const comments = existing && (
    <CommentsSection place={place} objectType={existing.kind} objectId={existing.id} />
  );
  if (!query.data.canCreate || (existing && !existing.canEdit)) {
    return (
      <>
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {text.noPermission}
        </p>
        {comments}
      </>
    );
  }
  return (
    <>
      <ActionForm
        place={place}
        list={query.data}
        accessToken={query.accessToken}
        existing={existing}
        gap={gap}
        {...(hint.data && {
          prefill: { title: why(hint.data), description: hint.data.explanation ?? '' },
        })}
        meeting={
          meeting.data
            ? { id: meeting.data.meeting.id, title: meeting.data.meeting.title }
            : undefined
        }
      />
      {comments}
    </>
  );
}

function ActionForm({
  place,
  list,
  accessToken,
  existing,
  meeting,
  gap,
  prefill,
}: {
  place: MeetingPlace;
  list: ActionList;
  accessToken: string;
  existing?: ActionItem | undefined;
  meeting?: { id: string; title: string } | undefined;
  gap?: FeedbackGapSource | undefined;
  /** KI-16: aus einem Hinweis; daraus wird zunächst eine Aufgabe */
  prefill?: { title: string; description: string };
}) {
  const t = useT();
  const text = t.actions;
  const navigate = useNavigate();
  const refresh = useRefreshActions();
  const sides = place.side === 'buyer' ? t.meetings.sidesBuyerView : t.meetings.sidesSupplierView;
  const gapLabel = gap ? (t.settings.survey.dimensions[gap.dimension] ?? '') : '';
  const [title, setTitle] = useState(
    existing?.title ?? (gap ? text.gapTitle(gapLabel) : (prefill?.title ?? '')),
  );
  const [description, setDescription] = useState(
    existing?.description ?? prefill?.description ?? '',
  );
  // ZQ-01 (E-K2-1): Art statt Sichtbarkeit. Eine Zusage ist geteilt, eine Aufgabe intern; nach dem
  // Anlegen bleiben Art und Sichtbarkeit fest (eine interne Zusage aus dem Termin bleibt intern)
  const [kind, setKind] = useState<WorkItemKind>(
    existing?.kind ?? (prefill ? 'task' : 'commitment'),
  );
  const [ownerSide, setOwnerSide] = useState<MeetingSide>(existing?.ownerSide ?? place.side);
  // Ohne eigene Person (z. B. eine frühere Maßnahme mit Namen) wählt man sie bewusst, statt still
  // die erste Person einzusetzen
  const [ownerUserId, setOwnerUserId] = useState(
    existing ? (existing.ownerUserId ?? '') : (list.people[0]?.userId ?? ''),
  );
  const [ownerName, setOwnerName] = useState(
    existing?.ownerUserId ? '' : (existing?.ownerName ?? ''),
  );
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  // Eine Aufgabe gehört der eigenen Seite; nur eine Zusage kann die andere Seite verantworten
  const side = kind === 'task' ? place.side : ownerSide;
  const ownSide = side === place.side;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailed(false);
    const next: Record<string, string> = {};
    if (title.trim() === '') next.title = text.required;
    if (dueDate === '') next.dueDate = text.required;
    if (ownSide && !ownerUserId) next.owner = text.required;
    if (!ownSide && ownerName.trim() === '') next.ownerName = text.required;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const action = {
      title: title.trim(),
      description: description.trim() || null,
      visibility: existing
        ? existing.visibility
        : kind === 'commitment'
          ? ('shared' as const)
          : ('internal' as const),
      ownerSide: side,
      ownerUserId: ownSide ? ownerUserId : null,
      ownerName: ownSide ? null : ownerName.trim(),
      dueDate,
    };
    setSaving(true);
    try {
      if (existing) {
        await updateAction(accessToken, apiBase(place), existing.id, action);
      } else {
        await createAction(accessToken, apiBase(place), {
          action,
          sourceType: gap ? 'feedback_gap' : meeting ? 'meeting' : 'manual',
          sourceId: gap?.resultId ?? meeting?.id ?? null,
        });
      }
      await refresh();
      flash.set(text.saved);
      await navigate({ to: actionsBase(place) });
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex max-w-2xl flex-col gap-6"
    >
      {(meeting || existing?.sourceTitle) && (
        <p className="text-muted-foreground">
          {text.sourceMeeting(meeting?.title ?? existing?.sourceTitle ?? '')}
        </p>
      )}
      {(gap || existing?.sourceDimension) && (
        <p className="text-muted-foreground">
          {text.sourceGap(
            gapLabel ||
              (existing?.sourceDimension
                ? (t.settings.survey.dimensions[existing.sourceDimension] ?? '')
                : ''),
          )}
        </p>
      )}
      {/* Die Art zuerst: Sie bestimmt, welche Felder folgen */}
      {existing ? (
        <p className="text-muted-foreground">{text.kindFixed(text.kinds[existing.kind])}</p>
      ) : (
        <FormField label={text.kind} hint={text.kindHint}>
          {(field) => (
            <NativeSelect
              {...field}
              value={kind}
              onChange={(event) => setKind(event.target.value as WorkItemKind)}
            >
              <option value="commitment">{text.kinds.commitment}</option>
              <option value="task">{text.kinds.task}</option>
            </NativeSelect>
          )}
        </FormField>
      )}
      <FormField label={text.titleLabel} error={errors.title}>
        {(field) => (
          <Input
            {...field}
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        )}
      </FormField>
      <FormField label={text.description}>
        {(field) => (
          <Textarea
            {...field}
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        )}
      </FormField>
      {kind === 'commitment' && (
        <FormField label={text.ownerSide}>
          {(field) => (
            <NativeSelect
              {...field}
              value={ownerSide}
              onChange={(event) => setOwnerSide(event.target.value as MeetingSide)}
            >
              <option value={place.side}>{sides[place.side]}</option>
              <option value={place.side === 'buyer' ? 'supplier' : 'buyer'}>
                {sides[place.side === 'buyer' ? 'supplier' : 'buyer']}
              </option>
            </NativeSelect>
          )}
        </FormField>
      )}
      {ownSide ? (
        <FormField label={text.owner} error={errors.owner}>
          {(field) => (
            <NativeSelect
              {...field}
              value={ownerUserId}
              onChange={(event) => setOwnerUserId(event.target.value)}
            >
              {ownerUserId === '' && <option value="">{text.ownerChoose}</option>}
              {list.people.map((person) => (
                <option key={person.userId} value={person.userId}>
                  {person.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      ) : (
        <FormField label={text.ownerName} error={errors.ownerName}>
          {(field) => (
            <Input
              {...field}
              maxLength={120}
              value={ownerName}
              onChange={(event) => setOwnerName(event.target.value)}
            />
          )}
        </FormField>
      )}
      <FormField label={text.dueDate} error={errors.dueDate}>
        {(field) => (
          <Input
            {...field}
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        )}
      </FormField>
      {failed && (
        <p role="alert" className="text-destructive">
          {text.saveFailed}
        </p>
      )}
      <FormActions>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void navigate({ to: actionsBase(place) })}
        >
          {text.cancel}
        </Button>
        <Button type="submit" loading={saving}>
          {existing ? text.save : text.create[kind]}
        </Button>
      </FormActions>
    </form>
  );
}

/** /start/massnahmen: offene Zusagen und Aufgaben aller eigenen Beziehungen, je mit Weg zum Ort. */
export function MyActionsPage() {
  const t = useT();
  const text = t.actions.mine;
  const format = useFormat();
  const accessToken = useToken();
  const query = useQuery({ ...myActionsQueryOptions(accessToken), enabled: accessToken !== '' });
  useDocumentTitle(text.title);
  return (
    <>
      <PagePath trail={[{ label: t.start.title, href: '/heute' }]} current={text.title} />
      <PageHeader size="list" title={text.title} purpose={text.purpose} />
      {query.isError ? (
        <ErrorState title={t.actions.failed} />
      ) : !query.data ? (
        <LoadingState label={t.actions.loading} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={<ListChecksIcon aria-hidden />}
          title={text.empty}
          description={t.actions.emptyText}
        />
      ) : (
        <ul aria-label={text.title} className="overflow-hidden rounded-lg bg-card shadow-card">
          {query.data.items.map((item) => (
            <li key={item.id} className="border-line-soft border-b last:border-b-0">
              {routerLink({
                href: item.href,
                className:
                  'flex min-h-14 items-center gap-4 px-5 py-3 transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset',
                children: (
                  <>
                    <Monogram name={item.counterpart} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold">{item.title}</span>
                      <span className="text-muted-foreground text-sm">
                        {t.actions.kinds[item.kind]} · {item.counterpart} · {item.ownerName} ·{' '}
                        <span className={cn(item.overdue && 'font-semibold text-destructive')}>
                          {t.actions.due(format.date(item.dueDate))}
                          {item.overdue && ` · ${t.actions.overdue}`}
                        </span>
                      </span>
                    </span>
                    <Badge>{t.actions.statuses[item.status]}</Badge>
                    <ChevronRightIcon aria-hidden className="size-4 text-muted-foreground" />
                  </>
                ),
              })}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
