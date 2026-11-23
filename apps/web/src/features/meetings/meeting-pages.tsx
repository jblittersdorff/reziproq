import {
  defaultMeetingMinutes,
  type MeetingDetail,
  type MeetingSide,
  type MeetingSummary,
  type MeetingType,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { CalendarDaysIcon, FileDownIcon, PlusIcon } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { VisibilityBadge } from '@/components/ui/visibility-badge';
import { CommentsSection } from '@/features/comments/comments-section';
import { useCustomerWorkspace } from '@/features/customers/customer-workspace';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath, useGoBack } from '@/features/shell/page-path';
import { SupplierFrame } from '@/features/suppliers/supplier-frame';
import {
  briefQueryOptions,
  closeMeeting,
  createMeeting,
  downloadPreRead,
  type MeetingBase,
  meetingListQueryOptions,
  meetingQueryOptions,
  saveMeetingAgenda,
  saveMeetingNote,
  saveMeetingProtocol,
  supplierQueryOptions,
  updateMeeting,
} from '@/lib/api';
import { flash, useFlash } from '@/lib/flash';
import { useFormat } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { MeetingBriefPanel } from './meeting-brief';
import { MeetingCapturePanel } from './meeting-capture';
import { MeetingTranscriptPanel } from './meeting-transcript';
import { PreReadSummary } from './pre-read-summary';

// QBR-01a: Termine für beide Seiten. Der Käufer arbeitet unter /lieferanten/<id>/umsetzung/termine,
// der Lieferant unter /kunden/<beziehung>/umsetzung/termine; die API unterscheidet genauso.

export interface MeetingPlace {
  side: MeetingSide;
  relationshipId: string;
}

export const apiBase = ({ side, relationshipId }: MeetingPlace): MeetingBase =>
  side === 'buyer' ? `/suppliers/${relationshipId}` : `/kunden/${relationshipId}`;

/** Maßnahmen derselben Beziehung (QBR-03), z. B. für „Maßnahme aus Termin“. */
const actionsPath = ({ side, relationshipId }: MeetingPlace) =>
  side === 'buyer'
    ? `/lieferanten/${relationshipId}/umsetzung/massnahmen`
    : `/kunden/${relationshipId}/umsetzung/massnahmen`;

const webBase = ({ side, relationshipId }: MeetingPlace) =>
  side === 'buyer'
    ? `/lieferanten/${relationshipId}/umsetzung/termine`
    : `/kunden/${relationshipId}/umsetzung/termine`;

function useToken() {
  const auth = useAuth();
  return auth.user?.access_token ?? '';
}

function useMeetingList(place: MeetingPlace) {
  const accessToken = useToken();
  const query = useQuery({
    ...meetingListQueryOptions(accessToken, apiBase(place)),
    enabled: accessToken !== '',
  });
  return { ...query, accessToken };
}

function useMeeting(place: MeetingPlace, meetingId: string) {
  const accessToken = useToken();
  const query = useQuery({
    ...meetingQueryOptions(accessToken, apiBase(place), meetingId),
    enabled: accessToken !== '',
  });
  return { ...query, accessToken };
}

function useRefreshMeetings(place: MeetingPlace) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['meetings', apiBase(place)] });
}

/** Datum und Uhrzeit für Menschen, in der Sprache der Oberfläche. */
function useDateTime() {
  const { locale } = useLocale();
  return (iso: string) =>
    new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
}

/** Wert für input type=datetime-local in Ortszeit. */
function toLocalInput(iso: string) {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Pfad und Rahmen je Seite: beim Käufer der Arbeitsbereich des Lieferanten (Bereich Umsetzung),
 * beim Lieferanten der Arbeitsbereich des Kunden.
 */
export function MeetingFrame({
  place,
  trail,
  current,
  header,
  children,
}: {
  place: MeetingPlace;
  trail: { label: string; href: string }[];
  current: string;
  header: ReactNode;
  children: ReactNode;
}) {
  if (place.side === 'buyer') {
    return (
      <SupplierFrame
        relationshipId={place.relationshipId}
        area="execution"
        trail={() => trail}
        current={current}
        header={header}
      >
        {() => children}
      </SupplierFrame>
    );
  }
  return (
    <CustomerFrame place={place} trail={trail} current={current}>
      {header}
      {children}
    </CustomerFrame>
  );
}

function CustomerFrame({
  place,
  trail,
  current,
  children,
}: {
  place: MeetingPlace;
  trail: { label: string; href: string }[];
  current: string;
  children: ReactNode;
}) {
  const text = useT().customers;
  const workspace = useCustomerWorkspace(place.relationshipId);
  if (!workspace.data) return null;
  return (
    <>
      <PagePath
        trail={[
          { label: text.title, href: '/kunden' },
          { label: workspace.data.name, href: `/kunden/${place.relationshipId}` },
          { label: text.areas.execution, href: `/kunden/${place.relationshipId}/umsetzung` },
          ...trail,
        ]}
        current={current}
      />
      {children}
    </>
  );
}

export function SideBadge({ place, side }: { place: MeetingPlace; side: MeetingSide }) {
  const text = useT().meetings;
  const labels = place.side === 'buyer' ? text.sidesBuyerView : text.sidesSupplierView;
  // Nur was von der anderen Seite kommt, ist gekennzeichnet; Eigenes bleibt ruhig.
  if (side === place.side) return null;
  return <Badge variant="selected">{labels[side]}</Badge>;
}

/** Umsetzung › Termine: kommende und vergangene Termine. */
export function MeetingsPage({ place }: { place: MeetingPlace }) {
  const text = useT().meetings;
  return (
    <MeetingFrame
      place={place}
      trail={[]}
      current={text.title}
      header={<PageHeader title={text.title} purpose={text.purpose} />}
    >
      <MeetingsContent place={place} />
    </MeetingFrame>
  );
}

function MeetingsContent({ place }: { place: MeetingPlace }) {
  const text = useT().meetings;
  const dateTime = useDateTime();
  const query = useMeetingList(place);
  const [message, hideMessage] = useFlash();
  if (query.isError) return <ErrorState title={text.failed} />;
  if (!query.data) return <LoadingState label={text.loading} />;
  const { upcoming, past, canCreate } = query.data;
  const newButton = canCreate
    ? routerLink({
        href: `${webBase(place)}/neu`,
        className: buttonVariants(),
        children: (
          <>
            <PlusIcon />
            {text.new}
          </>
        ),
      })
    : undefined;
  if (upcoming.length === 0 && past.length === 0) {
    return (
      <EmptyState
        size="lg"
        icon={<CalendarDaysIcon aria-hidden />}
        title={text.emptyTitle}
        description={text.emptyText}
        action={newButton}
      />
    );
  }
  const list = (id: string, heading: string, meetings: MeetingSummary[], empty: string) => (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="font-semibold text-lg">
        {heading}
      </h2>
      {meetings.length === 0 ? (
        <p className="text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft">
          {meetings.map((meeting) => (
            <li key={meeting.id}>
              {routerLink({
                href: `${webBase(place)}/${meeting.id}`,
                className:
                  'flex flex-col gap-1 py-3 hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-row sm:items-center sm:justify-between',
                children: (
                  <>
                    <span className="flex flex-col">
                      <span className="font-medium">{meeting.title}</span>
                      <span className="text-muted-foreground text-sm">
                        {dateTime(meeting.startsAt)}
                        {meeting.location ? ` · ${meeting.location}` : ''}
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-2">
                      <Badge>{text.types[meeting.type]}</Badge>
                      <SideBadge place={place} side={meeting.ownerSide} />
                    </span>
                  </>
                ),
              })}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
  return (
    <>
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      {newButton && <div>{newButton}</div>}
      {list('termine-kommend', text.upcoming, upcoming, text.emptyUpcoming)}
      {list('termine-vergangen', text.past, past, text.emptyPast)}
    </>
  );
}

/** Neuer Termin: Art aus den Standards oder aus den Formaten der Spielregeln. */
export function NewMeetingPage({ place }: { place: MeetingPlace }) {
  const text = useT().meetings;
  return (
    <MeetingFrame
      place={place}
      trail={[{ label: text.title, href: webBase(place) }]}
      current={text.new}
      header={<PageHeader title={text.new} purpose={text.newPurpose} />}
    >
      <NewMeetingForm place={place} />
    </MeetingFrame>
  );
}

const standardTypes: MeetingType[] = [
  'quarterly_review',
  'strategy_dialogue',
  'jbp',
  'negotiation',
  'site_visit',
  'escalation',
  'other',
];

function NewMeetingForm({ place }: { place: MeetingPlace }) {
  const t = useT();
  const text = t.meetings;
  const { locale } = useLocale();
  const navigate = useNavigate();
  const refresh = useRefreshMeetings(place);
  const query = useMeetingList(place);
  const [choice, setChoice] = useState<string>('quarterly_review');
  const [title, setTitle] = useState(text.types.quarterly_review);
  const [startsAt, setStartsAt] = useState('');
  const [duration, setDuration] = useState(String(defaultMeetingMinutes));
  const [location, setLocation] = useState('');
  const [participants, setParticipants] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  if (query.isError) return <ErrorState title={text.failed} />;
  if (!query.data) return <LoadingState label={text.loading} />;
  if (!query.data.canCreate) {
    return (
      <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
        {text.noPermission}
      </p>
    );
  }
  const formats = query.data.formats;
  const choose = (value: string) => {
    setChoice(value);
    const format = formats.find((entry) => entry.id === value);
    setTitle(format ? format.title[locale] || format.title.de : text.types[value as MeetingType]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailed(false);
    const next: Record<string, string> = {};
    if (title.trim() === '') next.title = text.required;
    if (startsAt === '') next.startsAt = text.required;
    const minutes = Number(duration);
    if (!Number.isInteger(minutes) || minutes < 15 || minutes > 600)
      next.duration = text.durationInvalid;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const format = formats.find((entry) => entry.id === choice);
    setSaving(true);
    try {
      const created = await createMeeting(query.accessToken, apiBase(place), {
        type: format ? 'format' : (choice as MeetingType),
        ruleSetItemId: format ? format.id : null,
        title: title.trim(),
        startsAt: new Date(startsAt).toISOString(),
        durationMinutes: Number(duration),
        location: location.trim() || null,
        participants: participants
          .split('\n')
          .map((name) => name.trim())
          .filter(Boolean),
        locale,
      });
      await refresh();
      flash.set(text.saved);
      await navigate({ to: `${webBase(place)}/${created.meeting.id}` });
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
      <FormField label={text.type}>
        {(field) => (
          <NativeSelect {...field} value={choice} onChange={(event) => choose(event.target.value)}>
            {standardTypes.map((type) => (
              <option key={type} value={type}>
                {text.types[type]}
              </option>
            ))}
            {formats.length > 0 && (
              <optgroup label={text.types.format}>
                {formats.map((format) => (
                  <option key={format.id} value={format.id}>
                    {format.title[locale] || format.title.de}
                  </option>
                ))}
              </optgroup>
            )}
          </NativeSelect>
        )}
      </FormField>
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
      <FormField label={text.date} error={errors.startsAt}>
        {(field) => (
          <Input
            {...field}
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
        )}
      </FormField>
      <FormField label={text.duration} hint={text.durationHint} error={errors.duration}>
        {(field) => (
          <Input
            {...field}
            type="number"
            inputMode="numeric"
            min={15}
            max={600}
            step={5}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
        )}
      </FormField>
      <FormField label={text.location}>
        {(field) => (
          <Input
            {...field}
            maxLength={300}
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        )}
      </FormField>
      <FormField label={text.participants} hint={text.participantsHint}>
        {(field) => (
          <Textarea
            {...field}
            rows={4}
            value={participants}
            onChange={(event) => setParticipants(event.target.value)}
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
          onClick={() => void navigate({ to: webBase(place) })}
        >
          {text.cancel}
        </Button>
        <Button type="submit" loading={saving}>
          {text.create}
        </Button>
      </FormActions>
    </form>
  );
}

function Section({
  id,
  title,
  badge,
  editHref,
  children,
}: {
  id: string;
  title: string;
  badge?: ReactNode;
  editHref?: string | undefined;
  children: ReactNode;
}) {
  const text = useT().meetings;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id={id} className="font-semibold text-lg">
          {title}
        </h2>
        {badge}
        {editHref &&
          routerLink({
            href: editHref,
            className: buttonVariants({ variant: 'outline', size: 'sm' }),
            children: text.edit,
            'aria-label': `${title}: ${text.edit}`,
          })}
      </div>
      {children}
    </section>
  );
}

/** Termin-Seite: Agenda, Protokoll und Beschlüsse, interne Notizen; bearbeitet je Abschnitt. */
export type MeetingTab = 'prep' | 'agenda' | 'results';

export function MeetingPage({
  place,
  meetingId,
  initialTab,
}: {
  place: MeetingPlace;
  meetingId: string;
  /** KI-07, KI-17: Reiter aus dem Link, z. B. aus der Aufgabe „Ergebnisse erfassen“ */
  initialTab?: MeetingTab | undefined;
}) {
  const text = useT().meetings;
  const query = useMeeting(place, meetingId);
  const title = query.data?.meeting.title ?? text.title;
  return (
    <MeetingFrame
      place={place}
      trail={[{ label: text.title, href: webBase(place) }]}
      current={title}
      header={null}
    >
      <MeetingContent place={place} meetingId={meetingId} initialTab={initialTab} />
      {query.data && <CommentsSection place={place} objectType="meeting" objectId={meetingId} />}
    </MeetingFrame>
  );
}

/**
 * Pre-Read als PDF (QBR-06), bei abgeschlossenen Terminen das Protokoll aus dem eingefrorenen
 * Stand. Der Server erzeugt die Datei mit dem, was diese Seite sehen darf.
 */
function PreReadButton({
  place,
  meetingId,
  closed,
}: {
  place: MeetingPlace;
  meetingId: string;
  closed: boolean;
}) {
  const text = useT().meetings;
  const { locale } = useLocale();
  const accessToken = useToken();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          try {
            await downloadPreRead(accessToken, apiBase(place), meetingId, locale);
          } catch {
            setFailed(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <FileDownIcon aria-hidden />
        {closed ? text.protocolPdf : text.preReadPdf}
      </Button>
      {failed && (
        <p role="alert" className="w-full text-destructive text-sm">
          {text.preReadFailed}
        </p>
      )}
    </>
  );
}

function MeetingContent({
  place,
  meetingId,
  initialTab,
}: {
  place: MeetingPlace;
  meetingId: string;
  initialTab?: MeetingTab | undefined;
}) {
  const t = useT();
  const text = t.meetings;
  const format = useFormat();
  const dateTime = useDateTime();
  const query = useMeeting(place, meetingId);
  const [message, hideMessage] = useFlash();
  // Abschließen bleibt auf dieser Seite; die Rückmeldung steht deshalb hier (NAV-04).
  const [closedMessage, setClosedMessage] = useState<string | null>(null);
  // KI-07: beim Käufer zwei Reiter, Vorbereitung (Briefing) und Agenda (wie der Lieferant sie sieht)
  const [tab, setTab] = useState<MeetingTab | null>(initialTab ?? null);
  const supplier = useQuery({
    ...supplierQueryOptions(query.accessToken, place.relationshipId),
    enabled: query.accessToken !== '' && place.side === 'buyer',
  });
  const brief = useQuery({
    ...briefQueryOptions(query.accessToken, place.relationshipId, meetingId),
    enabled: query.accessToken !== '' && place.side === 'buyer',
  });
  if (query.isError) {
    return (
      <>
        <PageHeader title={text.title} />
        <ErrorState title={text.notFound} />
      </>
    );
  }
  if (!query.data) {
    return (
      <>
        <PageHeader title={text.title} />
        <LoadingState label={text.loading} />
      </>
    );
  }
  const { meeting, participants, agenda, decisions, note, canEditMeeting, canContribute } =
    query.data;
  const { live, canClose } = query.data;
  const base = `${webBase(place)}/${meetingId}`;
  // Vor dem Termin beginnt der Käufer bei der Vorbereitung, danach bei der Agenda mit Protokoll.
  // Gibt es schon ein Briefing, beginnt der Käufer vor dem Termin bei der Vorbereitung.
  const hasBrief = Object.values(brief.data?.parts ?? {}).some(
    (part) => part.draft !== null || part.accepted !== null,
  );
  // KI-17: Ergebnisse gibt es ab Beginn des Termins.
  const started = meeting.status !== 'planned' || new Date(meeting.startsAt) <= new Date();
  const shownTab: MeetingTab =
    place.side !== 'buyer'
      ? 'agenda'
      : tab === 'results' && !started
        ? 'agenda'
        : (tab ?? (hasBrief && !started ? 'prep' : 'agenda'));
  return (
    <>
      <PageHeader
        title={meeting.title}
        purpose={[
          dateTime(meeting.startsAt),
          text.brief.minutes(meeting.durationMinutes),
          meeting.location,
        ]
          .filter(Boolean)
          .join(' · ')}
        badge={
          <Badge variant={meeting.status === 'closed' ? 'success' : 'neutral'}>
            {text.statuses[meeting.status]}
          </Badge>
        }
      />
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      {closedMessage && (
        <StatusLine message={closedMessage} onHidden={() => setClosedMessage(null)} />
      )}
      {meeting.status === 'closed' && <StatusLine message={text.closedHint} tone="warning" />}
      <div className="flex flex-col gap-1 text-muted-foreground text-sm">
        <p>
          {text.types[meeting.type]} · {text.ownerSide[meeting.ownerSide]} ·{' '}
          {text.createdBy(meeting.createdByName)}
        </p>
        {participants.length > 0 && (
          <p>
            {text.participants}: {participants.map((entry) => entry.name).join(', ')}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {canEditMeeting &&
          routerLink({
            href: `${base}/bearbeiten`,
            className: buttonVariants({ variant: 'outline' }),
            children: text.editMeeting,
          })}
        <PreReadButton place={place} meetingId={meetingId} closed={meeting.status === 'closed'} />
      </div>
      {meeting.status !== 'closed' && (
        <PreReadSummary base={apiBase(place)} side={place.side} meetingId={meetingId} />
      )}
      {place.side === 'buyer' && (
        <SegmentedControl
          label={text.brief.tabsLabel}
          value={shownTab}
          options={[
            { value: 'prep' as const, label: text.brief.tabPrep },
            { value: 'agenda' as const, label: text.brief.tabAgenda },
            ...(started ? [{ value: 'results' as const, label: text.capture.tab }] : []),
          ]}
          onChange={setTab}
          className="self-start"
        />
      )}
      {shownTab === 'results' ? (
        <div className="flex flex-col gap-5">
          {/* IN-05: Transkript vor den Entwürfen; ohne Transkript Upload oder Notizen */}
          <MeetingTranscriptPanel
            relationshipId={place.relationshipId}
            meetingId={meetingId}
            onCaptureNotes={() =>
              document
                .getElementById('ergebnisse-erfassen')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          />
          <MeetingCapturePanel
            relationshipId={place.relationshipId}
            meetingId={meetingId}
            supplier={supplier.data?.name ?? text.brief.sideYou}
          />
        </div>
      ) : shownTab === 'prep' ? (
        <div className="flex flex-col gap-5">
          {/* IN-05: „Transkript übernehmen“ im Reiter Vorbereitung */}
          <MeetingTranscriptPanel
            relationshipId={place.relationshipId}
            meetingId={meetingId}
            compact
          />
          <MeetingBriefPanel
            relationshipId={place.relationshipId}
            meetingId={meetingId}
            supplier={supplier.data?.name ?? text.brief.sideYou}
            meetingDay={meeting.startsAt}
          />
        </div>
      ) : (
        <>
          <Section
            id="termin-agenda"
            title={text.agenda}
            editHref={canContribute ? `${base}/agenda` : undefined}
          >
            {agenda.length === 0 ? (
              <p className="text-muted-foreground">{text.agendaEmpty}</p>
            ) : (
              <ol className="flex list-decimal flex-col gap-2 pl-5">
                {agenda.map((item) => (
                  <li key={item.id}>
                    <span className="flex flex-wrap items-center gap-2">
                      {item.title}
                      <SideBadge place={place} side={item.side} />
                    </span>
                    {item.detail && (
                      <span className="block text-muted-foreground text-sm">{item.detail}</span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Section>
          {live.sections.length > 0 && (
            <Section
              id="termin-live"
              title={live.frozenAt ? text.liveFrozen(dateTime(live.frozenAt)) : text.live}
            >
              {live.sections.map((section) => (
                <div key={section.key} data-live={section.key} className="flex flex-col gap-2">
                  <h3 className="font-medium">{text.liveSections[section.key] ?? section.key}</h3>
                  <ul className="overflow-hidden rounded-lg bg-card shadow-card">
                    {section.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-4 border-line-soft border-b px-5 py-3 last:border-b-0"
                      >
                        <span className="flex-1">{item.title}</span>
                        <span className="text-muted-foreground text-sm">
                          {[
                            item.status &&
                              (section.key === 'actions' && item.status in t.actions.statuses
                                ? t.actions.statuses[item.status as keyof typeof t.actions.statuses]
                                : section.key === 'commitments'
                                  ? (t.jbp.commitments.statuses[item.status] ?? item.status)
                                  : section.key === 'scorecard'
                                    ? (t.jbp.scorecard.tracks[item.status] ?? item.status)
                                    : section.key === 'initiatives' &&
                                        item.status in t.jbp.initiatives.statuses
                                      ? t.jbp.initiatives.statuses[
                                          item.status as keyof typeof t.jbp.initiatives.statuses
                                        ]
                                      : item.status),
                            item.detail,
                            item.dueDate && t.actions.due(format.date(item.dueDate)),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Section>
          )}
          {canContribute &&
            routerLink({
              href: `${actionsPath(place)}/neu?termin=${meetingId}`,
              className: `${buttonVariants({ variant: 'outline' })} self-start`,
              children: t.actions.fromMeeting,
            })}
          <Section
            id="termin-protokoll"
            title={text.protocol}
            editHref={canContribute ? `${base}/protokoll` : undefined}
          >
            {meeting.protocol ? (
              <p className="whitespace-pre-line">{meeting.protocol}</p>
            ) : (
              <p className="text-muted-foreground">{text.protocolEmpty}</p>
            )}
            <h3 className="font-medium">{text.decisions}</h3>
            {decisions.length === 0 ? (
              <p className="text-muted-foreground">{text.decisionsEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {decisions.map((decision) => (
                  <li key={decision.id} className="flex flex-wrap items-center gap-2">
                    {decision.text}
                    <SideBadge place={place} side={decision.side} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section
            id="termin-notiz"
            title={text.note}
            badge={<VisibilityBadge visibility="internal" label={text.internal} />}
            editHref={canContribute ? `${base}/notiz` : undefined}
          >
            {note ? (
              <p className="whitespace-pre-line">{note}</p>
            ) : (
              <p className="text-muted-foreground">{text.noteEmpty}</p>
            )}
          </Section>
          {canClose && (
            <CloseMeeting
              place={place}
              meetingId={meetingId}
              onClosed={() => setClosedMessage(text.closed)}
            />
          )}
        </>
      )}
    </>
  );
}

/** QBR-01b: Abschließen mit Bestätigung auf der Seite (NAV-04), nur die anlegende Seite. */
function CloseMeeting({
  place,
  meetingId,
  onClosed,
}: {
  place: MeetingPlace;
  meetingId: string;
  onClosed: () => void;
}) {
  const text = useT().meetings;
  const token = useToken();
  const refresh = useRefreshMeetings(place);
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-col gap-2 border-line-soft border-t pt-6">
      <ConfirmButton
        question={text.closeQuestion}
        confirmLabel={text.closeConfirm}
        cancelLabel={text.cancel}
        variant="default"
        onConfirm={() => {
          setFailed(false);
          closeMeeting(token, apiBase(place), meetingId)
            .then(async () => {
              onClosed();
              await refresh();
            })
            .catch(() => setFailed(true));
        }}
      >
        {text.close}
      </ConfirmButton>
      {failed && <StatusLine message={text.saveFailed} tone="warning" />}
    </div>
  );
}

type EditKind = 'meeting' | 'agenda' | 'protocol' | 'note';

/** Bearbeiten je Abschnitt auf eigener Seite (PLT-11). */
export function MeetingEditPage({
  place,
  meetingId,
  kind,
}: {
  place: MeetingPlace;
  meetingId: string;
  kind: EditKind;
}) {
  const text = useT().meetings;
  const query = useMeeting(place, meetingId);
  const titles: Record<EditKind, [string, string]> = {
    meeting: [text.editMeeting, text.editMeetingPurpose],
    agenda: [text.agendaEdit, text.agendaPurpose],
    protocol: [text.protocolEdit, text.protocolPurpose],
    note: [text.noteEdit, text.notePurpose],
  };
  const [title, purpose] = titles[kind];
  return (
    <MeetingFrame
      place={place}
      trail={[
        { label: text.title, href: webBase(place) },
        { label: query.data?.meeting.title ?? text.title, href: `${webBase(place)}/${meetingId}` },
      ]}
      current={title}
      header={
        <PageHeader
          title={title}
          purpose={purpose}
          badge={
            kind === 'note' ? (
              <VisibilityBadge visibility="internal" label={text.internal} />
            ) : undefined
          }
        />
      }
    >
      {query.isError ? (
        <ErrorState title={text.notFound} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : (kind === 'meeting' ? !query.data.canEditMeeting : !query.data.canContribute) ? (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {query.data.meeting.status === 'closed' ? text.closedHint : text.noPermission}
        </p>
      ) : (
        <EditForm place={place} detail={query.data} kind={kind} accessToken={query.accessToken} />
      )}
    </MeetingFrame>
  );
}

/** Eine Liste eigener Texte mit Hinzufügen und Entfernen (Agenda, Beschlüsse). */
function TextList({
  values,
  onChange,
  label,
  addLabel,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  label: (n: number) => string;
  addLabel: string;
}) {
  const text = useT().meetings;
  return (
    <div className="flex flex-col gap-3">
      {values.map((value, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Die Liste hat keine eigenen Schlüssel; die Position ist die Identität.
        <div key={index} className="flex items-end gap-2">
          <FormField label={label(index + 1)} className="flex-1">
            {(field) => (
              <Input
                {...field}
                maxLength={1000}
                value={value}
                onChange={(event) =>
                  onChange(values.map((entry, i) => (i === index ? event.target.value : entry)))
                }
              />
            )}
          </FormField>
          <Button
            type="button"
            variant="ghost"
            aria-label={text.removeItem(value)}
            onClick={() => onChange(values.filter((_, i) => i !== index))}
          >
            {text.remove}
          </Button>
        </div>
      ))}
      <div>
        <Button type="button" variant="outline" onClick={() => onChange([...values, ''])}>
          {addLabel}
        </Button>
      </div>
    </div>
  );
}

function EditForm({
  place,
  detail,
  kind,
  accessToken,
}: {
  place: MeetingPlace;
  detail: MeetingDetail;
  kind: EditKind;
  accessToken: string;
}) {
  const text = useT().meetings;
  const refresh = useRefreshMeetings(place);
  const meetingHref = `${webBase(place)}/${detail.meeting.id}`;
  const goBack = useGoBack(meetingHref);
  const owner = detail.meeting.ownerSide === place.side;
  const [title, setTitle] = useState(detail.meeting.title);
  const [startsAt, setStartsAt] = useState(toLocalInput(detail.meeting.startsAt));
  const [duration, setDuration] = useState(String(detail.meeting.durationMinutes));
  const [location, setLocation] = useState(detail.meeting.location ?? '');
  const [participants, setParticipants] = useState(
    detail.participants
      .filter((entry) => entry.own)
      .map((entry) => entry.name)
      .join('\n'),
  );
  const [agenda, setAgenda] = useState(
    detail.agenda.filter((item) => item.own).map((item) => item.title),
  );
  const [protocol, setProtocol] = useState(detail.meeting.protocol ?? '');
  const [decisions, setDecisions] = useState(
    detail.decisions.filter((entry) => entry.own).map((entry) => entry.text),
  );
  const [note, setNote] = useState(detail.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const clean = (values: string[]) => values.map((value) => value.trim()).filter(Boolean);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (kind === 'meeting' && (title.trim() === '' || startsAt === '')) {
      setError(text.required);
      return;
    }
    setSaving(true);
    const base = apiBase(place);
    const id = detail.meeting.id;
    try {
      if (kind === 'meeting') {
        await updateMeeting(accessToken, base, id, {
          title: title.trim(),
          startsAt: new Date(startsAt).toISOString(),
          durationMinutes: Math.min(600, Math.max(15, Number(duration) || defaultMeetingMinutes)),
          location: location.trim() || null,
          participants: clean(participants.split('\n')),
        });
      } else if (kind === 'agenda') {
        await saveMeetingAgenda(accessToken, base, id, { items: clean(agenda) });
      } else if (kind === 'protocol') {
        await saveMeetingProtocol(accessToken, base, id, {
          protocol: owner ? protocol.trim() || null : null,
          decisions: clean(decisions),
        });
      } else {
        await saveMeetingNote(accessToken, base, id, { text: note.trim() });
      }
      await refresh();
      flash.set(text.saved);
      goBack();
    } catch {
      setError(text.saveFailed);
      setSaving(false);
    }
  };

  const others = (items: { own: boolean; side: MeetingSide }[]) =>
    items.filter((item) => !item.own);

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex max-w-2xl flex-col gap-6"
    >
      {kind === 'meeting' && (
        <>
          <FormField label={text.titleLabel}>
            {(field) => (
              <Input
                {...field}
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            )}
          </FormField>
          <FormField label={text.date}>
            {(field) => (
              <Input
                {...field}
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            )}
          </FormField>
          <FormField label={text.duration} hint={text.durationHint}>
            {(field) => (
              <Input
                {...field}
                type="number"
                inputMode="numeric"
                min={15}
                max={600}
                step={5}
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
            )}
          </FormField>
          <FormField label={text.location}>
            {(field) => (
              <Input
                {...field}
                maxLength={300}
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            )}
          </FormField>
          <FormField label={text.participants} hint={text.participantsHint}>
            {(field) => (
              <Textarea
                {...field}
                rows={4}
                value={participants}
                onChange={(event) => setParticipants(event.target.value)}
              />
            )}
          </FormField>
        </>
      )}
      {kind === 'agenda' && (
        <>
          {others(detail.agenda).length > 0 && (
            <ul className="flex flex-col gap-1 text-muted-foreground">
              {detail.agenda
                .filter((item) => !item.own)
                .map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-2">
                    {item.title}
                    <SideBadge place={place} side={item.side} />
                  </li>
                ))}
            </ul>
          )}
          <TextList
            values={agenda}
            onChange={setAgenda}
            label={text.item}
            addLabel={text.addItem}
          />
        </>
      )}
      {kind === 'protocol' && (
        <>
          {owner ? (
            <FormField label={text.protocolLabel}>
              {(field) => (
                <Textarea
                  {...field}
                  rows={8}
                  maxLength={20_000}
                  value={protocol}
                  onChange={(event) => setProtocol(event.target.value)}
                />
              )}
            </FormField>
          ) : (
            <p className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
              {text.protocolOwnerOnly}
            </p>
          )}
          <h2 className="font-semibold text-lg">{text.decisions}</h2>
          <TextList
            values={decisions}
            onChange={setDecisions}
            label={text.decision}
            addLabel={text.addDecision}
          />
        </>
      )}
      {kind === 'note' && (
        <FormField label={text.noteLabel}>
          {(field) => (
            <Textarea
              {...field}
              rows={8}
              maxLength={10_000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          )}
        </FormField>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <FormActions>
        <Button type="button" variant="secondary" onClick={goBack}>
          {text.cancel}
        </Button>
        <Button type="submit" loading={saving}>
          {text.save}
        </Button>
      </FormActions>
    </form>
  );
}
