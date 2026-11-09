import type { JbpTopic, JbpTopics, MeetingSide } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { apiBase, type MeetingPlace } from '@/features/meetings/meeting-pages';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import {
  createJbpTopic,
  importJbpTopics,
  jbpTopicCandidatesQueryOptions,
  jbpTopicsQueryOptions,
  parkJbpTopic,
  reorderJbpTopics,
  restoreJbpTopic,
  updateJbpTopic,
} from '@/lib/api';
import { flash, useFlash } from '@/lib/flash';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { JbpFrame, useToken } from './jbp-pages';

// JBP-02: Themen beider Seiten unter Gemeinsamer Plan › Themen, beim Käufer und beim Lieferanten.

export const topicsPath = ({ side, relationshipId }: MeetingPlace) =>
  side === 'buyer'
    ? `/lieferanten/${relationshipId}/plan/themen`
    : `/kunden/${relationshipId}/plan/themen`;

function useTopics(place: MeetingPlace) {
  const accessToken = useToken();
  const query = useQuery({
    ...jbpTopicsQueryOptions(accessToken, apiBase(place)),
    enabled: accessToken !== '',
  });
  return { ...query, accessToken };
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['jbp'] });
}

/** Themen: zwei Spalten, Käufer und Lieferant, je nach Priorität; eigene ordnen und bearbeiten. */
export function JbpTopicsPage({ place }: { place: MeetingPlace }) {
  const text = useT().jbp.topics;
  return (
    <JbpFrame
      place={place}
      trail={[]}
      current={text.title}
      header={<PageHeader title={text.title} purpose={text.purpose} />}
    >
      <TopicsContent place={place} />
    </JbpFrame>
  );
}

function TopicsContent({ place }: { place: MeetingPlace }) {
  const text = useT().jbp.topics;
  const query = useTopics(place);
  const refresh = useRefresh();
  const [message, hideMessage] = useFlash();
  const [failed, setFailed] = useState(false);
  if (query.isError) return <ErrorState title={text.failed} />;
  if (!query.data) return <LoadingState label={text.loading} />;
  const data = query.data;
  if (!data.hasPlan) {
    return (
      <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
        {text.noPlan}
      </p>
    );
  }
  const move = (side: MeetingSide, index: number, delta: number) => {
    const ids = data[side].map((topic) => topic.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved as string);
    setFailed(false);
    reorderJbpTopics(query.accessToken, apiBase(place), ids)
      .then(() => refresh())
      .catch(() => setFailed(true));
  };

  return (
    <>
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      {data.canEditOwn && (
        <div className="flex flex-wrap gap-3">
          {routerLink({
            href: `${topicsPath(place)}/neu`,
            className: buttonVariants(),
            children: (
              <>
                <PlusIcon />
                {text.new}
              </>
            ),
          })}
          {data.canImport &&
            routerLink({
              href: `${topicsPath(place)}/uebernehmen`,
              className: buttonVariants({ variant: 'outline' }),
              children: text.import,
            })}
          {/* JBP-03: offene Themen beider Seiten zu einer Initiative zusammenführen */}
          {[...data.buyer, ...data.supplier].some((topic) => topic.status === 'proposed') &&
            routerLink({
              href: `${topicsPath(place)}/zusammenfuehren`,
              className: buttonVariants({ variant: 'outline' }),
              children: text.merge,
            })}
        </div>
      )}
      {failed && <p className="text-destructive">{text.saveFailed}</p>}
      <div className="grid gap-6 md:grid-cols-2">
        {(['buyer', 'supplier'] as MeetingSide[]).map((side) => (
          <TopicColumn
            key={side}
            place={place}
            side={side}
            data={data}
            onMove={(index, delta) => move(side, index, delta)}
          />
        ))}
      </div>
    </>
  );
}

function TopicColumn({
  place,
  side,
  data,
  onMove,
}: {
  place: MeetingPlace;
  side: MeetingSide;
  data: JbpTopics;
  onMove: (index: number, delta: number) => void;
}) {
  const text = useT().jbp.topics;
  const topics = data[side];
  const own = side === data.ownSide && data.canEditOwn;
  return (
    <section aria-labelledby={`themen-${side}`} className="flex flex-col gap-3">
      <h2 id={`themen-${side}`} className="font-bold text-xl tracking-title">
        {text.column[side]}
      </h2>
      {topics.length === 0 ? (
        <p className="text-muted-foreground">{text.empty}</p>
      ) : (
        <ol className="overflow-hidden rounded-xl bg-card">
          {topics.map((topic, index) => (
            <TopicRow
              key={topic.id}
              place={place}
              topic={topic}
              index={index}
              count={topics.length}
              editable={own}
              onMove={onMove}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function TopicRow({
  place,
  topic,
  index,
  count,
  editable,
  onMove,
}: {
  place: MeetingPlace;
  topic: JbpTopic;
  index: number;
  count: number;
  editable: boolean;
  onMove: (index: number, delta: number) => void;
}) {
  const text = useT().jbp.topics;
  const parked = topic.status === 'parked';
  return (
    <li
      data-topic={topic.id}
      className={cn(
        'flex flex-col gap-2 border-border border-b px-5 py-4 last:border-b-0',
        parked && 'bg-muted',
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="w-6 text-muted-foreground tabular-nums">{index + 1}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={cn('font-semibold', parked && 'text-muted-foreground')}>
            {topic.title}
          </span>
          {topic.description && <span className="text-muted-foreground">{topic.description}</span>}
          {topic.origin && (
            <span className="text-muted-foreground text-sm">{text.origin(topic.origin.title)}</span>
          )}
          {topic.status === 'merged' && <Badge variant="selected">{text.merged}</Badge>}
          {parked && topic.parkReason && (
            <Badge variant="neutral">{text.parkedReason(topic.parkReason)}</Badge>
          )}
        </div>
        {editable && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={index === 0}
              aria-label={text.up(topic.title)}
              onClick={() => onMove(index, -1)}
            >
              <ArrowUpIcon aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={index === count - 1}
              aria-label={text.down(topic.title)}
              onClick={() => onMove(index, 1)}
            >
              <ArrowDownIcon aria-hidden />
            </Button>
            {routerLink({
              href: `${topicsPath(place)}/${topic.id}`,
              className: buttonVariants({ variant: 'outline', size: 'sm' }),
              'aria-label': `${topic.title}: ${text.edit}`,
              children: text.edit,
            })}
          </div>
        )}
      </div>
    </li>
  );
}

/** Neues oder geändertes Thema der eigenen Seite, auf eigener Seite; dazu Parken. */
export function JbpTopicFormPage({ place, topicId }: { place: MeetingPlace; topicId?: string }) {
  const text = useT().jbp.topics;
  const title = topicId ? text.editTitle : text.new;
  return (
    <JbpFrame
      place={place}
      trail={[{ label: text.title, href: topicsPath(place) }]}
      current={title}
      header={<PageHeader title={title} purpose={text.purpose} />}
    >
      <TopicFormLoader place={place} topicId={topicId} />
    </JbpFrame>
  );
}

function TopicFormLoader({
  place,
  topicId,
}: {
  place: MeetingPlace;
  topicId?: string | undefined;
}) {
  const text = useT().jbp.topics;
  const query = useTopics(place);
  if (query.isError) return <ErrorState title={text.failed} />;
  if (!query.data) return <LoadingState label={text.loading} />;
  const existing = topicId
    ? query.data[query.data.ownSide].find((topic) => topic.id === topicId)
    : undefined;
  if (topicId && !existing) return <ErrorState title={text.notFound} />;
  if (!query.data.canEditOwn) {
    return (
      <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
        {text.noPermission}
      </p>
    );
  }
  return <TopicForm place={place} accessToken={query.accessToken} existing={existing} />;
}

function TopicForm({
  place,
  accessToken,
  existing,
}: {
  place: MeetingPlace;
  accessToken: string;
  existing?: JbpTopic | undefined;
}) {
  const text = useT().jbp.topics;
  const navigate = useNavigate();
  const refresh = useRefresh();
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const done = async () => {
    await refresh();
    flash.set(text.saved);
    await navigate({ to: topicsPath(place) });
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailed(false);
    if (title.trim() === '') {
      setErrors({ title: text.required });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const input = { title: title.trim(), description: description.trim() };
      if (existing) await updateJbpTopic(accessToken, apiBase(place), existing.id, input);
      else await createJbpTopic(accessToken, apiBase(place), input);
      await done();
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };
  const park = async () => {
    if (!existing) return;
    if (reason.trim() === '') {
      setErrors({ reason: text.required });
      return;
    }
    try {
      await parkJbpTopic(accessToken, apiBase(place), existing.id, reason.trim());
      await done();
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-6">
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
        <FormField label={text.descriptionLabel} hint={text.descriptionHint}>
          {(field) => (
            <Textarea
              {...field}
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
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
            onClick={() => void navigate({ to: topicsPath(place) })}
          >
            {text.cancel}
          </Button>
          <Button type="submit" loading={saving}>
            {existing ? text.save : text.create}
          </Button>
        </FormActions>
      </form>
      {existing && existing.status !== 'parked' && (
        <section aria-label={text.park} className="flex flex-col gap-3 rounded-xl bg-card p-5">
          <FormField label={text.parkReason} error={errors.reason}>
            {(field) => (
              <Input
                {...field}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            )}
          </FormField>
          <div>
            <ConfirmButton
              question={text.parkConfirm}
              confirmLabel={text.park}
              cancelLabel={text.cancel}
              variant="default"
              onConfirm={() => void park()}
            >
              {text.park}
            </ConfirmButton>
          </div>
        </section>
      )}
      {existing && existing.status === 'parked' && (
        <div>
          <Button
            variant="outline"
            onClick={() =>
              void restoreJbpTopic(accessToken, apiBase(place), existing.id)
                .then(done)
                .catch(() => setFailed(true))
            }
          >
            {text.restore}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Aus dem Lieferantenplan übernehmen (nur Käufer, SRO): Auswahl und teilbare Beschreibung je Thema. */
export function JbpTopicImportPage({ relationshipId }: { relationshipId: string }) {
  const text = useT().jbp.topics;
  const place: MeetingPlace = { side: 'buyer', relationshipId };
  return (
    <JbpFrame
      place={place}
      trail={[{ label: text.title, href: topicsPath(place) }]}
      current={text.importTitle}
      header={<PageHeader title={text.importTitle} purpose={text.importPurpose} />}
    >
      <ImportContent place={place} />
    </JbpFrame>
  );
}

function ImportContent({ place }: { place: MeetingPlace }) {
  const text = useT().jbp.topics;
  const accessToken = useToken();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const query = useQuery({
    ...jbpTopicCandidatesQueryOptions(accessToken, apiBase(place)),
    enabled: accessToken !== '',
  });
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (query.isError) return <ErrorState title={text.failed} />;
  if (!query.data) return <LoadingState label={text.loading} />;
  const { candidates } = query.data;
  if (candidates.length === 0) {
    return (
      <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
        {text.importEmpty}
      </p>
    );
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const items = Object.entries(chosen).map(([strategicTopicId, description]) => ({
      strategicTopicId,
      description: description.trim(),
    }));
    if (items.length === 0) {
      setError(text.chooseOne);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await importJbpTopics(accessToken, apiBase(place), { items });
      await refresh();
      flash.set(text.saved);
      await navigate({ to: topicsPath(place) });
    } catch {
      setError(text.saveFailed);
      setSaving(false);
    }
  };
  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex max-w-3xl flex-col gap-4"
    >
      <ul className="flex flex-col gap-3">
        {candidates.map((candidate) => {
          const selected = candidate.id in chosen;
          return (
            <li key={candidate.id} className="flex flex-col gap-3 rounded-xl bg-card p-5">
              <label
                htmlFor={`thema-${candidate.id}`}
                className="flex min-h-11 items-center gap-3 font-semibold"
              >
                <Checkbox
                  id={`thema-${candidate.id}`}
                  checked={selected}
                  onCheckedChange={(value) =>
                    setChosen((current) => {
                      const next = { ...current };
                      if (value) next[candidate.id] = '';
                      else delete next[candidate.id];
                      return next;
                    })
                  }
                />
                {candidate.title}
              </label>
              <p className="text-muted-foreground text-sm">
                {text.importReason}: {candidate.reason}
              </p>
              {selected && (
                <FormField label={text.importDescription(candidate.title)}>
                  {(field) => (
                    <Textarea
                      {...field}
                      rows={3}
                      maxLength={2000}
                      value={chosen[candidate.id] ?? ''}
                      onChange={(event) =>
                        setChosen((current) => ({ ...current, [candidate.id]: event.target.value }))
                      }
                    />
                  )}
                </FormField>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <FormActions>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void navigate({ to: topicsPath(place) })}
        >
          {text.cancel}
        </Button>
        <Button type="submit" loading={saving}>
          {text.importConfirm}
        </Button>
      </FormActions>
    </form>
  );
}
