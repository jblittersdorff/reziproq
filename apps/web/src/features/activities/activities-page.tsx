import type { ActivityFeed, ActivityFilter, ActivityItem } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { LockIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { BrandMark } from '@/components/ui/brand-mark';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Monogram } from '@/components/ui/monogram';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { useSupplier } from '@/features/suppliers/use-supplier';
import { activitiesQueryOptions, addNote, removeNote, updateNote } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type FilterValue = ActivityFilter | 'all';

/**
 * Aktivitäten › Verlauf (NAV-10, nach L-Notizen.dc.html): neue Notiz mit Team oder Nur ich, Frag
 * Reziproq zu diesem Lieferanten, Filter, Verlauf nach Monaten mit Angeheftetem oben; rechts der
 * Hinweis, dass der Lieferant die Aktivitäten nie sieht.
 */
export function ActivitiesPage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = t.activities;
  const accessToken = useToken();
  const supplier = useSupplier(relationshipId);
  const [filter, setFilter] = useState<FilterValue>('all');
  const query = useQuery({
    ...activitiesQueryOptions(accessToken, relationshipId, filter === 'all' ? undefined : filter),
    enabled: accessToken !== '',
  });
  const name = supplier.data?.name ?? '';

  return (
    <>
      <PageHeader size="work" title={text.title} purpose={name ? text.purpose(name) : ''} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {query.data?.canWrite && <NoteForm relationshipId={relationshipId} />}
          {name && <AskSupplier relationshipId={relationshipId} name={name} />}
          <SegmentedControl<FilterValue>
            className="self-start"
            label={text.filterLabel}
            value={filter}
            options={(['all', 'termine', 'notizen', 'reziproq'] as const).map((value) => ({
              value,
              label: text.filters[value],
            }))}
            onChange={setFilter}
          />
          {query.isError ? (
            <ErrorState title={text.failed} />
          ) : !query.data ? (
            <LoadingState label={text.loading} />
          ) : query.data.items.length === 0 ? (
            <EmptyState
              title={filter === 'all' ? text.empty : text.emptyFilter}
              description={text.comingWithIntegrations}
            />
          ) : (
            <Timeline feed={query.data} relationshipId={relationshipId} />
          )}
        </div>
        <aside className="flex min-w-0 flex-col gap-3">
          <section className="flex items-start gap-3 rounded-lg border-2 border-line border-dashed bg-card p-4 text-sm">
            <LockIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="flex flex-col gap-1">
              <strong className="font-semibold">{text.supplierNever}</strong>
              <span className="text-muted-foreground">{text.comingWithIntegrations}</span>
            </span>
          </section>
        </aside>
      </div>
    </>
  );
}

function useFeedUpdate(relationshipId: string) {
  const accessToken = useToken();
  const client = useQueryClient();
  const [failure, setFailure] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (work: (token: string) => Promise<ActivityFeed>) => {
    setBusy(true);
    setFailure(false);
    try {
      await work(accessToken);
      await client.invalidateQueries({ queryKey: ['suppliers', relationshipId, 'aktivitaeten'] });
      return true;
    } catch {
      setFailure(true);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { run, failure, busy };
}

function NoteForm({ relationshipId }: { relationshipId: string }) {
  const text = useT().activities;
  const update = useFeedUpdate(relationshipId);
  const [value, setValue] = useState('');
  const [visibility, setVisibility] = useState<'team' | 'private'>('team');
  const [call, setCall] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <form
      aria-label={text.newNote}
      className="flex flex-col gap-3 rounded-lg bg-card p-5 shadow-card"
      onSubmit={async (event: FormEvent) => {
        event.preventDefault();
        if (!value.trim()) return;
        const ok = await update.run((token) =>
          addNote(token, relationshipId, {
            text: value.trim(),
            visibility,
            kind: call ? 'call' : 'note',
          }),
        );
        if (ok) {
          setValue('');
          setSaved(true);
        }
      }}
    >
      <h2 className="font-semibold text-lg">{text.newNote}</h2>
      {saved && <StatusLine message={text.saved} onHidden={() => setSaved(false)} />}
      {update.failure && <StatusLine message={text.failedSave} tone="warning" />}
      <FormField label={text.noteLabel} className="[&>label]:sr-only">
        {(field) => (
          <Textarea
            {...field}
            rows={3}
            maxLength={5000}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        )}
      </FormField>
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl<'team' | 'private'>
          label={text.visibility}
          value={visibility}
          options={[
            { value: 'team', label: text.visibilities.team },
            { value: 'private', label: text.visibilities.private },
          ]}
          onChange={setVisibility}
        />
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-5 accent-petrol"
            checked={call}
            onChange={(event) => setCall(event.target.checked)}
          />
          {text.call}
        </label>
      </div>
      <FormActions>
        <Button type="submit" loading={update.busy} disabled={!value.trim()}>
          {text.save}
        </Button>
      </FormActions>
    </form>
  );
}

/** Frage mit diesem Lieferanten als Kontext (NAV-10): öffnet Fragen mit ?lieferant=<id>. */
function AskSupplier({ relationshipId, name }: { relationshipId: string; name: string }) {
  const text = useT().activities;
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  return (
    <form
      aria-label={text.ask(name)}
      className="flex flex-wrap items-end gap-2 rounded-lg bg-card p-4 shadow-ask"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        if (question.trim()) {
          void navigate({
            to: '/fragen',
            search: { q: question.trim(), lieferant: relationshipId },
          });
        }
      }}
    >
      <FormField label={text.ask(name)} className="min-w-0 grow">
        {(field) => (
          <Input
            {...field}
            value={question}
            placeholder={text.askPlaceholder(name)}
            onChange={(event) => setQuestion(event.target.value)}
          />
        )}
      </FormField>
      <Button type="submit" variant="secondary" disabled={!question.trim()}>
        {text.askSend}
      </Button>
    </form>
  );
}

function Timeline({ feed, relationshipId }: { feed: ActivityFeed; relationshipId: string }) {
  const text = useT().activities;
  const { locale } = useLocale();
  const month = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const pinned = feed.items.filter((item) => item.pinned);
  const rest = feed.items.filter((item) => !item.pinned);
  const groups = new Map<string, ActivityItem[]>();
  for (const item of rest) {
    const key = month.format(new Date(item.occurredAt));
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const section = (title: string, items: ActivityItem[]) => (
    <section key={title} aria-label={title} className="flex flex-col gap-2">
      <h2 className="font-semibold text-muted-strong text-sm">{title}</h2>
      <ul className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-lg bg-card shadow-card">
        {items.map((item) => (
          <Entry key={item.id} item={item} relationshipId={relationshipId} />
        ))}
      </ul>
    </section>
  );
  return (
    <div className="flex flex-col gap-5">
      {pinned.length > 0 && section(text.pinned, pinned)}
      {[...groups.entries()].map(([title, items]) => section(title, items))}
    </div>
  );
}

function Entry({ item, relationshipId }: { item: ActivityItem; relationshipId: string }) {
  const t = useT();
  const text = t.activities;
  const format = useFormat();
  const update = useFeedUpdate(relationshipId);
  const noteId = item.id.startsWith('note:') ? item.id.slice(5) : null;
  const reziproq = item.actor.type === 'reziproq';
  const title =
    item.kind === 'hint'
      ? ((t.hints.rules as Record<string, string>)[item.code ?? ''] ?? text.kinds.hint)
      : item.kind === 'agent'
        ? (text.agentTitles[item.code ?? ''] ?? text.kinds.agent)
        : item.title;
  const meta =
    item.kind === 'agent'
      ? (text.draftStatuses[item.meta ?? ''] ?? null)
      : item.kind === 'hint'
        ? ((t.hints.statuses as Record<string, string>)[item.meta ?? ''] ?? null)
        : item.meta;
  return (
    <li
      className={cn(
        'flex items-start gap-3 p-4 text-sm',
        item.visibility === 'private' && 'border-2 border-line border-dashed',
      )}
    >
      {reziproq ? (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mint-soft">
          <BrandMark className="h-4 w-6" />
        </span>
      ) : (
        <Monogram name={item.actor.type === 'person' ? item.actor.name : ''} />
      )}
      <span className="flex min-w-0 grow flex-col gap-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
          <strong className="font-semibold text-ink">{text.kinds[item.kind]}</strong>
          <span>
            {reziproq ? text.reziproq : item.actor.type === 'person' ? item.actor.name : ''} ·{' '}
            {format.dateTime(item.occurredAt)}
          </span>
          <Badge variant={item.visibility === 'private' ? 'plain' : 'neutral'}>
            {item.visibility === 'private' && <LockIcon aria-hidden />}
            {text.visibilityBadge[item.visibility]}
          </Badge>
        </span>
        <span className="whitespace-pre-line">{title}</span>
        {meta && <span className="text-muted-foreground text-xs">{meta}</span>}
        <span className="flex flex-wrap gap-2">
          {item.href &&
            routerLink({
              href: item.href,
              className: 'min-h-11 py-2 font-semibold text-petrol underline',
              children: text.open,
            })}
          {item.mine && noteId && (
            <>
              <Button
                size="sm"
                variant="ghost"
                loading={update.busy}
                onClick={() =>
                  void update.run((token) =>
                    updateNote(token, relationshipId, noteId, { pinned: !item.pinned }),
                  )
                }
              >
                {item.pinned ? text.unpin : text.pin}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void update.run((token) => removeNote(token, relationshipId, noteId))
                }
              >
                {text.remove}
              </Button>
            </>
          )}
        </span>
      </span>
    </li>
  );
}
