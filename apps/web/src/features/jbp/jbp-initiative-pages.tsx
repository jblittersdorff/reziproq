import {
  type Initiative,
  type InitiativeMilestone,
  type InitiativeStatus,
  initiativeStatuses,
  type SaveInitiative,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ChevronRightIcon, PlusIcon, TargetIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatusLine } from '@/components/ui/status-line';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { AuditHistory } from '@/features/audit/audit-history';
import { apiBase, type MeetingPlace } from '@/features/meetings/meeting-pages';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import {
  ApiError,
  addMilestone,
  createInitiative,
  deleteMilestone,
  initiativeQueryOptions,
  initiativesQueryOptions,
  jbpTopicsQueryOptions,
  setInitiativeStatus,
  updateInitiative,
  updateMilestone,
} from '@/lib/api';
import { flash, useFlash } from '@/lib/flash';
import { useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { JbpFrame, useToken } from './jbp-pages';
import { topicsPath } from './jbp-topic-pages';

// JBP-03: Initiativen und Roadmap unter Gemeinsamer Plan › Initiativen, für beide Seiten gleich.

export type InitiativeView = 'liste' | 'roadmap';

export const initiativesPath = ({ side, relationshipId }: MeetingPlace) =>
  side === 'buyer'
    ? `/lieferanten/${relationshipId}/plan/initiativen`
    : `/kunden/${relationshipId}/plan/initiativen`;

/** Datum ohne Zeitzonen-Verschiebung: „2027-03-15“ ist der 15. März, überall. */
const day = (iso: string) => new Date(`${iso}T00:00:00`);

function useDate() {
  const { locale } = useLocale();
  const format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  return (iso: string) => format.format(day(iso));
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['jbp'] });
}

const statusVariant: Record<InitiativeStatus, 'neutral' | 'selected' | 'success' | 'warning'> = {
  planned: 'neutral',
  running: 'selected',
  done: 'success',
  stopped: 'warning',
};

function StatusBadge({ status }: { status: InitiativeStatus }) {
  const text = useT().jbp.initiatives;
  return <Badge variant={statusVariant[status]}>{text.statuses[status]}</Badge>;
}

/** Liste oder Roadmap, umschaltbar in der Adresse (?ansicht=roadmap). */
export function JbpInitiativesPage({ place, view }: { place: MeetingPlace; view: InitiativeView }) {
  const text = useT().jbp.initiatives;
  return (
    <JbpFrame
      place={place}
      trail={[]}
      current={text.title}
      header={<PageHeader title={text.title} purpose={text.purpose} />}
    >
      <InitiativesContent place={place} view={view} />
    </JbpFrame>
  );
}

function InitiativesContent({ place, view }: { place: MeetingPlace; view: InitiativeView }) {
  const text = useT().jbp.initiatives;
  const accessToken = useToken();
  const navigate = useNavigate();
  const [message, hideMessage] = useFlash();
  const query = useQuery({
    ...initiativesQueryOptions(accessToken, apiBase(place)),
    enabled: accessToken !== '',
  });
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
  const canCreate = data.canEdit && !data.approved;
  return (
    <>
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      {data.approved && (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {text.approvedNotice}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {canCreate ? (
          routerLink({
            href: `${initiativesPath(place)}/neu`,
            className: buttonVariants(),
            children: (
              <>
                <PlusIcon />
                {text.new}
              </>
            ),
          })
        ) : (
          <span />
        )}
        {data.initiatives.length > 0 && (
          <SegmentedControl
            label={text.view.label}
            value={view}
            options={[
              { value: 'liste', label: text.view.list },
              { value: 'roadmap', label: text.view.roadmap },
            ]}
            onChange={(next) =>
              void navigate({
                to: initiativesPath(place),
                search: next === 'roadmap' ? { ansicht: 'roadmap' } : {},
              })
            }
          />
        )}
      </div>
      {data.initiatives.length === 0 ? (
        <EmptyState
          icon={<TargetIcon aria-hidden />}
          title={text.empty}
          description={text.emptyHint}
        />
      ) : view === 'roadmap' ? (
        <Roadmap place={place} initiatives={data.initiatives} />
      ) : (
        <InitiativeTable place={place} initiatives={data.initiatives} />
      )}
    </>
  );
}

function InitiativeTable({
  place,
  initiatives,
}: {
  place: MeetingPlace;
  initiatives: Initiative[];
}) {
  const text = useT().jbp.initiatives;
  const date = useDate();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{text.columns.title}</TableHead>
          <TableHead>{text.columns.owners}</TableHead>
          <TableHead>{text.columns.period}</TableHead>
          <TableHead>{text.columns.status}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {initiatives.map((initiative) => (
          <TableRow key={initiative.id} data-initiative={initiative.id}>
            <TableCell className="font-semibold">
              {routerLink({
                href: `${initiativesPath(place)}/${initiative.id}`,
                className: 'hover:underline focus-visible:underline focus-visible:outline-none',
                children: initiative.title,
              })}
            </TableCell>
            <TableCell>
              <span className="flex flex-col">
                <span>{initiative.ownerBuyerName}</span>
                <span className="text-muted-foreground">{initiative.ownerSupplierName}</span>
              </span>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {text.period(date(initiative.startsOn), date(initiative.endsOn))}
            </TableCell>
            <TableCell>
              <StatusBadge status={initiative.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const barTone: Record<InitiativeStatus, string> = {
  planned: 'bg-primary-soft ring-1 ring-primary ring-inset',
  running: 'bg-primary',
  done: 'bg-success-soft ring-1 ring-success-soft-foreground ring-inset',
  stopped: 'bg-secondary ring-1 ring-border ring-inset',
};

/**
 * Roadmap: Zeitachse über mindestens drei Jahre, je Initiative eine Zeile mit Balken, Meilensteine
 * als Rauten. Die ganze Zeile ist ein Link zur Initiative.
 */
export function Roadmap({
  place,
  initiatives,
}: {
  place: MeetingPlace;
  initiatives: Initiative[];
}) {
  const text = useT().jbp.initiatives;
  const date = useDate();
  const first = Math.min(
    new Date().getFullYear(),
    ...initiatives.map((initiative) => day(initiative.startsOn).getFullYear()),
  );
  const last = Math.max(
    first + 2,
    ...initiatives.map((initiative) => day(initiative.endsOn).getFullYear()),
  );
  const years = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  const start = new Date(first, 0, 1).getTime();
  const span = new Date(last + 1, 0, 1).getTime() - start;
  const at = (iso: string, end = false) => {
    const time = day(iso).getTime() + (end ? 86_400_000 : 0);
    return Math.min(100, Math.max(0, ((time - start) / span) * 100));
  };
  const grid = (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex">
      {years.map((year) => (
        <span key={year} className="flex-1 border-border border-l first:border-l-0" />
      ))}
    </div>
  );
  return (
    <section
      aria-label={text.roadmapLabel}
      data-slot="roadmap"
      className="overflow-hidden rounded-xl bg-card"
    >
      <div className="grid sm:grid-cols-4">
        <span className="hidden border-border border-b sm:block" />
        <div className="flex border-border border-b sm:col-span-3">
          {years.map((year) => (
            <span
              key={year}
              data-year={year}
              className="flex-1 border-border border-l px-2 py-2 font-semibold text-muted-foreground text-sm tabular-nums first:border-l-0"
            >
              {year}
            </span>
          ))}
        </div>
      </div>
      <ol>
        {initiatives.map((initiative) => {
          const left = at(initiative.startsOn);
          const width = Math.max(1, at(initiative.endsOn, true) - left);
          return (
            <li key={initiative.id} data-initiative={initiative.id}>
              {routerLink({
                href: `${initiativesPath(place)}/${initiative.id}`,
                'aria-label': `${initiative.title}, ${text.period(date(initiative.startsOn), date(initiative.endsOn))}, ${text.statuses[initiative.status]}`,
                className:
                  'grid border-border border-b transition-colors last:border-b-0 hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:grid-cols-4',
                children: (
                  <>
                    <span className="truncate px-4 pt-3 font-semibold text-sm sm:py-3">
                      {initiative.title}
                    </span>
                    <span className="relative block h-11 sm:col-span-3">
                      {grid}
                      <span
                        data-slot="bar"
                        className={cn('absolute top-3 h-5 rounded-sm', barTone[initiative.status])}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      />
                      {initiative.milestones.map((milestone) => (
                        <span
                          key={milestone.id}
                          data-slot="milestone"
                          title={text.milestoneOn(milestone.title, date(milestone.dueOn))}
                          className={cn(
                            'absolute top-3.5 size-3 -translate-x-1/2 rotate-45 ring-2 ring-card',
                            milestone.doneOn ? 'bg-success-soft-foreground' : 'bg-foreground',
                          )}
                          style={{ left: `${at(milestone.dueOn)}%` }}
                        />
                      ))}
                    </span>
                  </>
                ),
              })}
            </li>
          );
        })}
      </ol>
      {/* Status nie nur als Farbe: Legende unter der Zeitachse. */}
      <ul
        aria-label={text.columns.status}
        className="flex flex-wrap gap-x-5 gap-y-2 border-border border-t px-4 py-3 text-muted-foreground text-sm"
      >
        {initiativeStatuses.map((status) => (
          <li key={status} className="flex items-center gap-2">
            <span aria-hidden className={cn('h-3 w-5 rounded-sm', barTone[status])} />
            {text.statuses[status]}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-2.5 rotate-45 bg-foreground" />
          {text.milestones}
        </li>
      </ul>
    </section>
  );
}

/** Eine Initiative: Ziel, Nutzen, Verantwortliche, Status, Meilensteine, Themen und Verlauf. */
export function JbpInitiativePage({
  place,
  initiativeId,
}: {
  place: MeetingPlace;
  initiativeId: string;
}) {
  const text = useT().jbp.initiatives;
  const accessToken = useToken();
  const query = useQuery({
    ...initiativeQueryOptions(accessToken, apiBase(place), initiativeId),
    enabled: accessToken !== '',
  });
  const title = query.data?.initiative.title ?? text.title;
  return (
    <JbpFrame
      place={place}
      trail={[{ label: text.title, href: initiativesPath(place) }]}
      current={title}
      header={<PageHeader title={title} />}
    >
      {query.isError ? (
        <ErrorState title={text.notFound} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : (
        <InitiativeContent
          place={place}
          accessToken={accessToken}
          initiative={query.data.initiative}
          approved={query.data.approved}
          canEdit={query.data.canEdit}
        />
      )}
    </JbpFrame>
  );
}

function InitiativeContent({
  place,
  accessToken,
  initiative,
  approved,
  canEdit,
}: {
  place: MeetingPlace;
  accessToken: string;
  initiative: Initiative;
  approved: boolean;
  canEdit: boolean;
}) {
  const text = useT().jbp.initiatives;
  const topicColumns = useT().jbp.topics.column;
  const date = useDate();
  const refresh = useRefresh();
  const [message, hideMessage] = useFlash();
  const [status, setStatus] = useState<InitiativeStatus>(initiative.status);
  const [failed, setFailed] = useState(false);
  const saveStatus = async () => {
    setFailed(false);
    try {
      await setInitiativeStatus(accessToken, apiBase(place), initiative.id, status);
      await refresh();
    } catch {
      setFailed(true);
    }
  };
  const facts: [string, string][] = [
    [text.goal, initiative.goal],
    [text.benefitBuyer, initiative.benefitBuyer],
    [text.benefitSupplier, initiative.benefitSupplier],
    [text.ownerBuyer, initiative.ownerBuyerName],
    [text.ownerSupplier, initiative.ownerSupplierName],
    [text.columns.period, text.period(date(initiative.startsOn), date(initiative.endsOn))],
  ];
  return (
    <div className="flex max-w-3xl flex-col gap-10">
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      {approved && (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {text.approvedNotice}
        </p>
      )}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={initiative.status} />
          {canEdit &&
            !approved &&
            routerLink({
              href: `${initiativesPath(place)}/${initiative.id}/bearbeiten`,
              className: buttonVariants({ variant: 'outline', size: 'sm' }),
              children: text.edit,
            })}
        </div>
        <dl className="grid gap-x-8 gap-y-4 rounded-xl bg-card p-5 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-sm">{label}</dt>
              <dd className="whitespace-pre-line">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {canEdit && (
        <section aria-labelledby="initiative-status" className="flex flex-col gap-3">
          <h2 id="initiative-status" className="font-bold text-xl tracking-title">
            {text.statusLabel}
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56">
              <NativeSelect
                aria-label={text.statusLabel}
                value={status}
                onChange={(event) => setStatus(event.target.value as InitiativeStatus)}
              >
                {initiativeStatuses.map((value) => (
                  <option key={value} value={value}>
                    {text.statuses[value]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button
              variant="outline"
              disabled={status === initiative.status}
              onClick={() => void saveStatus()}
            >
              {text.statusSave}
            </Button>
          </div>
          {failed && <p className="text-destructive">{text.saveFailed}</p>}
        </section>
      )}

      <Milestones
        place={place}
        accessToken={accessToken}
        initiativeId={initiative.id}
        milestones={initiative.milestones}
        canEdit={canEdit}
      />

      {initiative.topics.length > 0 && (
        <section aria-labelledby="initiative-themen" className="flex flex-col gap-3">
          <h2 id="initiative-themen" className="font-bold text-xl tracking-title">
            {text.topics}
          </h2>
          <ul className="flex flex-col gap-2">
            {initiative.topics.map((topic) => (
              <li key={topic.id} className="flex flex-wrap items-center gap-2">
                <Badge>{topicColumns[topic.side]}</Badge>
                <span>{topic.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="initiative-verlauf" className="flex flex-col gap-3">
        <h2 id="initiative-verlauf" className="font-bold text-xl tracking-title">
          {text.history}
        </h2>
        <AuditHistory
          objectType="initiative"
          objectId={initiative.id}
          {...(place.side === 'supplier' ? { relationshipId: place.relationshipId } : {})}
        />
      </section>
    </div>
  );
}

function Milestones({
  place,
  accessToken,
  initiativeId,
  milestones,
  canEdit,
}: {
  place: MeetingPlace;
  accessToken: string;
  initiativeId: string;
  milestones: InitiativeMilestone[];
  canEdit: boolean;
}) {
  const text = useT().jbp.initiatives;
  const date = useDate();
  const refresh = useRefresh();
  const [title, setTitle] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const run = async (work: () => Promise<unknown>) => {
    setFailed(false);
    try {
      await work();
      await refresh();
    } catch {
      setFailed(true);
    }
  };
  const add = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = text.required;
    if (!dueOn) next.dueOn = text.required;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    await run(() =>
      addMilestone(accessToken, apiBase(place), initiativeId, {
        title: title.trim(),
        dueOn,
        doneOn: null,
      }),
    );
    setTitle('');
    setDueOn('');
  };
  const today = new Date().toISOString().slice(0, 10);
  return (
    <section aria-labelledby="initiative-meilensteine" className="flex flex-col gap-3">
      <h2 id="initiative-meilensteine" className="font-bold text-xl tracking-title">
        {text.milestones}
      </h2>
      {milestones.length === 0 ? (
        <p className="text-muted-foreground">{text.milestonesEmpty}</p>
      ) : (
        <ul className="overflow-hidden rounded-xl bg-card">
          {milestones.map((milestone) => (
            <li
              key={milestone.id}
              className="flex flex-wrap items-center gap-3 border-border border-b px-5 py-3 last:border-b-0"
            >
              {canEdit && (
                <Checkbox
                  aria-label={text.milestoneDone(milestone.title)}
                  checked={Boolean(milestone.doneOn)}
                  onCheckedChange={(value) =>
                    void run(() =>
                      updateMilestone(accessToken, apiBase(place), initiativeId, milestone.id, {
                        title: milestone.title,
                        dueOn: milestone.dueOn,
                        doneOn: value ? today : null,
                      }),
                    )
                  }
                />
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={cn('font-semibold', milestone.doneOn && 'text-muted-foreground')}>
                  {milestone.title}
                </span>
                <span className="text-muted-foreground text-sm">
                  {date(milestone.dueOn)}
                  {milestone.doneOn && ` · ${text.milestoneDoneOn(date(milestone.doneOn))}`}
                </span>
              </span>
              {canEdit && (
                <ConfirmButton
                  question={text.milestoneDelete(milestone.title)}
                  confirmLabel={text.delete}
                  cancelLabel={text.cancel}
                  onConfirm={() =>
                    void run(() =>
                      deleteMilestone(accessToken, apiBase(place), initiativeId, milestone.id),
                    )
                  }
                >
                  {text.delete}
                  <span className="sr-only">: {milestone.title}</span>
                </ConfirmButton>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form
          noValidate
          onSubmit={(event) => void add(event)}
          className="grid items-start gap-3 rounded-xl bg-card p-5 sm:grid-cols-[1fr_auto_auto]"
        >
          <FormField label={text.milestoneTitle} error={errors.title}>
            {(field) => (
              <Input
                {...field}
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            )}
          </FormField>
          <FormField label={text.milestoneDue} error={errors.dueOn}>
            {(field) => (
              <Input
                {...field}
                type="date"
                value={dueOn}
                onChange={(event) => setDueOn(event.target.value)}
              />
            )}
          </FormField>
          <Button type="submit" variant="outline" className="sm:mt-7">
            {text.milestoneAdd}
          </Button>
        </form>
      )}
      {failed && <p className="text-destructive">{text.saveFailed}</p>}
    </section>
  );
}

/** Neu oder Bearbeiten auf eigener Seite; beim Zusammenführen vorbefüllt aus den Themen. */
export function JbpInitiativeFormPage({
  place,
  initiativeId,
  topicIds = [],
}: {
  place: MeetingPlace;
  initiativeId?: string;
  topicIds?: string[];
}) {
  const text = useT().jbp.initiatives;
  const accessToken = useToken();
  const base = apiBase(place);
  const existing = useQuery({
    ...initiativeQueryOptions(accessToken, base, initiativeId ?? ''),
    enabled: accessToken !== '' && Boolean(initiativeId),
  });
  const topics = useQuery({
    ...jbpTopicsQueryOptions(accessToken, base),
    enabled: accessToken !== '' && topicIds.length > 0,
  });
  // Beim Anlegen kommen Personen und eigene Seite aus der Liste, beim Bearbeiten aus der Initiative.
  const list = useQuery({
    ...initiativesQueryOptions(accessToken, base),
    enabled: accessToken !== '' && !initiativeId,
  });
  const context = existing.data ?? list.data;
  const title = initiativeId ? text.editTitle : text.new;
  const trail = [{ label: text.title, href: initiativesPath(place) }];
  const loading =
    !context ||
    (initiativeId && !existing.data && !existing.isError) ||
    (topicIds.length > 0 && !topics.data && !topics.isError);
  return (
    <JbpFrame place={place} trail={trail} current={title} header={<PageHeader title={title} />}>
      {existing.isError || list.isError ? (
        <ErrorState title={text.notFound} />
      ) : loading ? (
        <LoadingState label={text.loading} />
      ) : !context?.canEdit ? (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {text.noPermission}
        </p>
      ) : (
        <InitiativeForm
          place={place}
          accessToken={accessToken}
          existing={existing.data?.initiative}
          ownSide={context.ownSide}
          people={context.people}
          merged={[...(topics.data?.buyer ?? []), ...(topics.data?.supplier ?? [])].filter(
            (topic) => topicIds.includes(topic.id),
          )}
        />
      )}
    </JbpFrame>
  );
}

function InitiativeForm({
  place,
  accessToken,
  existing,
  ownSide,
  people,
  merged,
}: {
  place: MeetingPlace;
  accessToken: string;
  existing?: Initiative | undefined;
  ownSide: 'buyer' | 'supplier';
  people: { userId: string; name: string }[];
  merged: { id: string; title: string; description: string }[];
}) {
  const text = useT().jbp.initiatives;
  const navigate = useNavigate();
  const refresh = useRefresh();
  const year = new Date().getFullYear() + 1;
  const [values, setValues] = useState({
    title: existing?.title ?? merged[0]?.title ?? '',
    goal:
      existing?.goal ??
      merged
        .map((topic) => topic.description)
        .filter(Boolean)
        .join('\n'),
    benefitBuyer: existing?.benefitBuyer ?? '',
    benefitSupplier: existing?.benefitSupplier ?? '',
    // Eigene Seite: gewählte Person. Andere Seite: Name, nur beim Anlegen einzutragen.
    ownerUserId:
      (ownSide === 'buyer' ? existing?.ownerBuyerUserId : existing?.ownerSupplierUserId) ?? '',
    otherName: (ownSide === 'buyer' ? existing?.ownerSupplierName : existing?.ownerBuyerName) ?? '',
    startsOn: existing?.startsOn ?? `${year}-01-01`,
    endsOn: existing?.endsOn ?? `${year}-12-31`,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailed(null);
    const next: Record<string, string> = {};
    for (const key of [
      'title',
      'goal',
      'benefitBuyer',
      'benefitSupplier',
      'ownerUserId',
      'otherName',
      'startsOn',
      'endsOn',
    ] as const) {
      if (!values[key].trim()) next[key] = text.required;
    }
    if (!next.endsOn && !next.startsOn && values.endsOn < values.startsOn) {
      next.endsOn = text.endBeforeStart;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const base = {
      title: values.title.trim(),
      goal: values.goal.trim(),
      benefitBuyer: values.benefitBuyer.trim(),
      benefitSupplier: values.benefitSupplier.trim(),
    };
    const ownName = people.find((person) => person.userId === values.ownerUserId)?.name ?? '';
    const otherName = values.otherName.trim();
    const request: SaveInitiative = {
      ...base,
      ownerBuyerName: ownSide === 'buyer' ? ownName : otherName,
      ownerSupplierName: ownSide === 'buyer' ? otherName : ownName,
      ownerUserId: values.ownerUserId,
      startsOn: values.startsOn,
      endsOn: values.endsOn,
      ...(merged.length > 0 && !existing ? { topicIds: merged.map((topic) => topic.id) } : {}),
    };
    setSaving(true);
    try {
      const saved = existing
        ? await updateInitiative(accessToken, apiBase(place), existing.id, request)
        : await createInitiative(accessToken, apiBase(place), request);
      await refresh();
      flash.set(text.saved);
      await navigate({ to: `${initiativesPath(place)}/${saved.initiative.id}` });
    } catch (error) {
      setFailed(
        error instanceof ApiError && error.status === 409 ? text.approvedFailed : text.saveFailed,
      );
      setSaving(false);
    }
  };

  const area = (key: keyof typeof values, label: string, hint?: string) => (
    <FormField label={label} error={errors[key]} {...(hint ? { hint } : {})}>
      {(field) => (
        <Textarea
          {...field}
          rows={3}
          maxLength={2000}
          value={values[key]}
          onChange={(event) => set(key)(event.target.value)}
        />
      )}
    </FormField>
  );
  const line = (key: keyof typeof values, label: string, type = 'text') => (
    <FormField label={label} error={errors[key]}>
      {(field) => (
        <Input
          {...field}
          type={type}
          maxLength={200}
          value={values[key]}
          onChange={(event) => set(key)(event.target.value)}
        />
      )}
    </FormField>
  );

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex max-w-2xl flex-col gap-6"
    >
      {merged.length > 0 && !existing && (
        <section aria-label={text.topics} className="flex flex-col gap-2 rounded-xl bg-card p-5">
          <p className="font-semibold">{text.topics}</p>
          <ul className="flex flex-wrap gap-2">
            {merged.map((topic) => (
              <li key={topic.id}>
                <Badge variant="selected">{topic.title}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
      {line('title', text.titleLabel)}
      {area('goal', text.goal)}
      <div className="grid gap-6 sm:grid-cols-2">
        {area('benefitBuyer', text.benefitBuyer, text.benefitHint)}
        {area('benefitSupplier', text.benefitSupplier, text.benefitHint)}
        <FormField label={text.ownerOwn} error={errors.ownerUserId}>
          {(field) => (
            <NativeSelect
              {...field}
              value={values.ownerUserId}
              onChange={(event) => set('ownerUserId')(event.target.value)}
            >
              <option value="">{text.ownerPick}</option>
              {people.map((person) => (
                <option key={person.userId} value={person.userId}>
                  {person.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        {existing ? (
          <div className="flex flex-col gap-2">
            <p className="font-medium text-sm">
              {ownSide === 'buyer' ? text.ownerSupplier : text.ownerBuyer}
            </p>
            <p className="flex min-h-11 items-center text-muted-foreground">{values.otherName}</p>
          </div>
        ) : (
          <FormField
            label={ownSide === 'buyer' ? text.ownerSupplier : text.ownerBuyer}
            hint={text.ownerOtherHint}
            error={errors.otherName}
          >
            {(field) => (
              <Input
                {...field}
                maxLength={200}
                value={values.otherName}
                onChange={(event) => set('otherName')(event.target.value)}
              />
            )}
          </FormField>
        )}
        {line('startsOn', text.startsOn, 'date')}
        {line('endsOn', text.endsOn, 'date')}
      </div>
      {failed && (
        <p role="alert" className="text-destructive">
          {failed}
        </p>
      )}
      <FormActions>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            void navigate({
              to: existing ? `${initiativesPath(place)}/${existing.id}` : initiativesPath(place),
            })
          }
        >
          {text.cancel}
        </Button>
        <Button type="submit" loading={saving}>
          {existing ? text.save : text.create}
        </Button>
      </FormActions>
    </form>
  );
}

/** Zu Initiative zusammenführen: offene Themen beider Seiten wählen, dann weiter zum Formular. */
export function JbpTopicMergePage({ place }: { place: MeetingPlace }) {
  const t = useT().jbp;
  const accessToken = useToken();
  const navigate = useNavigate();
  const query = useQuery({
    ...jbpTopicsQueryOptions(accessToken, apiBase(place)),
    enabled: accessToken !== '',
  });
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const open = [...(query.data?.buyer ?? []), ...(query.data?.supplier ?? [])].filter(
    (topic) => topic.status === 'proposed',
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (chosen.length === 0) {
      setError(t.topics.chooseOne);
      return;
    }
    void navigate({
      to: `${initiativesPath(place)}/neu`,
      search: { themen: chosen.join(',') },
    });
  };
  return (
    <JbpFrame
      place={place}
      trail={[{ label: t.topics.title, href: topicsPath(place) }]}
      current={t.topics.merge}
      header={<PageHeader title={t.topics.merge} purpose={t.topics.mergePurpose} />}
    >
      {query.isError ? (
        <ErrorState title={t.topics.failed} />
      ) : !query.data ? (
        <LoadingState label={t.topics.loading} />
      ) : open.length === 0 ? (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {t.topics.mergeEmpty}
        </p>
      ) : (
        <form noValidate onSubmit={submit} className="flex max-w-3xl flex-col gap-4">
          <ul className="overflow-hidden rounded-xl bg-card">
            {open.map((topic) => (
              <li key={topic.id} className="border-border border-b px-5 py-3 last:border-b-0">
                <label
                  htmlFor={`zusammen-${topic.id}`}
                  className="flex min-h-11 items-center gap-3"
                >
                  <Checkbox
                    id={`zusammen-${topic.id}`}
                    checked={chosen.includes(topic.id)}
                    onCheckedChange={(value) =>
                      setChosen((current) =>
                        value ? [...current, topic.id] : current.filter((id) => id !== topic.id),
                      )
                    }
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{topic.title}</span>
                    {topic.description && (
                      <span className="text-muted-foreground text-sm">{topic.description}</span>
                    )}
                  </span>
                  <Badge>{t.topics.column[topic.side]}</Badge>
                </label>
              </li>
            ))}
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
              {t.initiatives.cancel}
            </Button>
            <Button type="submit">
              {t.topics.mergeNext}
              <ChevronRightIcon aria-hidden />
            </Button>
          </FormActions>
        </form>
      )}
    </JbpFrame>
  );
}
