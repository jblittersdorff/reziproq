import { type InboundItemView, type Inbox, type MeetingType, meetingTypes } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { ListCard, ListCardHeader } from '@/components/ui/list-card';
import { LoadingState } from '@/components/ui/loading-state';
import { Monogram } from '@/components/ui/monogram';
import { NativeSelect } from '@/components/ui/native-select';
import { NextStep } from '@/components/ui/next-step';
import { StatusLine } from '@/components/ui/status-line';
import { useCan } from '@/features/auth/use-permissions';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { decideInbound, inboxQueryOptions } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

function useAccessToken() {
  const auth = useAuth();
  return auth.user?.access_token ?? '';
}

/**
 * IN-03 Mein Tag › Neu eingegangen (nach Aktivitaeten.dc.html): Tinte-Karte mit der Zahl der
 * Eingänge, „Zuordnen“ mit Vorschlag und Grund je Eingang, „Heute selbst zugeordnet“; rechts wie
 * Termine ankommen und dass Privates privat bleibt.
 */
export function InboxPage() {
  const t = useT();
  const text = t.inbox;
  const accessToken = useAccessToken();
  const client = useQueryClient();
  const query = useQuery({ ...inboxQueryOptions(accessToken), enabled: accessToken !== '' });
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'warning' } | null>(
    null,
  );

  const decide = async (id: string, input: Parameters<typeof decideInbound>[2]) => {
    setMessage(null);
    try {
      client.setQueryData(
        inboxQueryOptions(accessToken).queryKey,
        await decideInbound(accessToken, id, input),
      );
      setMessage({ text: text.saved, tone: 'success' });
      await client.invalidateQueries({ queryKey: ['start'] });
    } catch {
      setMessage({ text: text.failed, tone: 'warning' });
    }
  };

  const data = query.data;
  return (
    <>
      <PagePath trail={[{ label: t.nav.myDay, href: '/mein-tag' }]} current={text.navTitle} />
      <PageHeader title={text.title} purpose={text.purpose} />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !data ? (
        <LoadingState label={text.loading} />
      ) : (
        <>
          <NextStep
            eyebrow={text.nextEyebrow}
            title={
              data.open.length > 0
                ? text.nextTitle(data.open.length, kindOf(data.open))
                : text.doneTitle
            }
            text={data.open.length > 0 ? text.nextText : text.doneText}
          />
          {message && <StatusLine message={message.text} tone={message.tone} />}
          <div className="flex flex-wrap items-start gap-5">
            <div className="flex min-w-0 shrink grow-2 basis-120 flex-col gap-5">
              <section
                aria-labelledby="eingang-zuordnen"
                className="flex flex-col rounded-lg bg-card px-6 pt-5 pb-2 shadow-card"
              >
                <h2
                  id="eingang-zuordnen"
                  className="pb-1 font-display font-semibold text-section tracking-section"
                >
                  {text.openTitle(data.open.length)}
                </h2>
                {data.open.length === 0 ? (
                  <p className="pb-4 text-muted-foreground text-sm">{text.doneText}</p>
                ) : (
                  <ul className="flex flex-col">
                    {data.open.map((item) => (
                      <OpenItem
                        key={item.id}
                        item={item}
                        suppliers={data.suppliers}
                        onDecide={(input) => decide(item.id, input)}
                      />
                    ))}
                  </ul>
                )}
              </section>
              <TodayList items={data.today} />
            </div>
            <aside className="flex min-w-0 shrink grow basis-75 flex-col gap-5">
              <section
                aria-labelledby="eingang-wie"
                className="flex flex-col gap-3 rounded-lg bg-card p-6 shadow-card"
              >
                <h2
                  id="eingang-wie"
                  className="font-display font-semibold text-section tracking-section"
                >
                  {text.howTitle}
                </h2>
                <ul className="flex flex-col gap-2 text-sm">
                  <li>{text.howAddin}</li>
                  <li>{text.howMail}</li>
                  <li>{text.howForward}</li>
                  <li>{text.howCalendar}</li>
                </ul>
              </section>
              <section
                aria-labelledby="eingang-privat"
                className="flex flex-col gap-3 rounded-lg bg-card p-6 shadow-card"
              >
                <h2
                  id="eingang-privat"
                  className="font-display font-semibold text-section tracking-section"
                >
                  {text.privateTitle}
                </h2>
                <p className="text-muted-foreground text-sm">{text.privateText}</p>
              </section>
            </aside>
          </div>
        </>
      )}
    </>
  );
}

/** IN-04: Warten nur Termine, nur Mails oder beides? Davon hängt der Text der Zahl ab. */
function kindOf(items: InboundItemView[]): 'meeting' | 'mail' | 'mixed' {
  const kinds = new Set(items.map((item) => item.kind));
  return kinds.size > 1 ? 'mixed' : kinds.has('mail') ? 'mail' : 'meeting';
}

function OpenItem({
  item,
  suppliers,
  onDecide,
}: {
  item: InboundItemView;
  suppliers: Inbox['suppliers'];
  onDecide: (input: Parameters<typeof decideInbound>[2]) => Promise<void>;
}) {
  const t = useT();
  const text = t.inbox;
  const format = useFormat();
  // IN-04: Mails legt ab, wer Notizen schreiben darf; Termine, wer Termine bearbeiten darf
  const isMail = item.kind === 'mail';
  const canEditMeetings = useCan('termine.bearbeiten');
  const canFileMails = useCan('notizen.schreiben');
  const canEdit = isMail ? canFileMails : canEditMeetings;
  const id = useId();
  const [type, setType] = useState<MeetingType>(item.suggestedType);
  const [supplier, setSupplier] = useState(
    item.suggestions[0]?.relationshipId ?? suppliers[0]?.relationshipId ?? '',
  );
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, input: Parameters<typeof decideInbound>[2]) => {
    setBusy(key);
    await onDecide(input);
    setBusy(null);
  };
  const suggestionTitle =
    item.suggestionKind === 'none'
      ? text.noneTitle
      : item.suggestionKind === 'event'
        ? text.eventTitle
        : item.suggestions.map((entry) => entry.name).join(` ${text.or} `);

  return (
    <li className="flex flex-col gap-3 border-line-soft border-t py-4 first:border-t-0">
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-chip">
          {isMail
            ? text.forwardedMail
            : [text.sources[item.source], item.organizer ? text.invitedBy(item.organizer) : null]
                .filter(Boolean)
                .join(' · ')}
        </span>
        <strong className="break-words font-semibold">{item.subject}</strong>
        <span className="text-muted-foreground text-sm">
          {isMail
            ? `${text.mailFrom(item.organizer ?? '')} · ${format.dateTime(item.startsAt)}`
            : `${format.dateTime(item.startsAt)} · ${text.attendees(item.attendees)}`}
        </span>
      </div>
      <div className="flex flex-col gap-1 rounded-md bg-background p-3">
        <span className="font-semibold text-chip text-muted-foreground">{text.suggestion}</span>
        <span className="font-semibold text-sm">{suggestionTitle}</span>
        {item.suggestionReason && (
          <span className="text-muted-foreground text-sm">{item.suggestionReason}</span>
        )}
      </div>
      {canEdit && item.suggestionKind !== 'event' && (
        <div className="flex flex-wrap items-end gap-3">
          {item.suggestionKind !== 'several' && (
            <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1 text-sm">
              <label htmlFor={`${id}-lieferant`} className="font-semibold">
                {text.supplierLabel}
              </label>
              <NativeSelect
                id={`${id}-lieferant`}
                value={supplier}
                onChange={(event) => setSupplier(event.target.value)}
              >
                {suppliers.map((entry) => (
                  <option key={entry.relationshipId} value={entry.relationshipId}>
                    {entry.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          {!isMail && (
            <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1 text-sm">
              <label htmlFor={`${id}-typ`} className="font-semibold">
                {text.typeLabel}
              </label>
              <NativeSelect
                id={`${id}-typ`}
                value={type}
                onChange={(event) => setType(event.target.value as MeetingType)}
              >
                {meetingTypes
                  .filter((entry) => entry !== 'format')
                  .map((entry) => (
                    <option key={entry} value={entry}>
                      {t.meetings.types[entry]}
                    </option>
                  ))}
              </NativeSelect>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {canEdit && item.suggestionKind === 'several' && (
          <>
            {item.suggestions.map((entry) => (
              <Button
                key={entry.relationshipId}
                variant="outline"
                size="sm"
                loading={busy === entry.relationshipId}
                onClick={() =>
                  void run(entry.relationshipId, {
                    action: 'assign',
                    relationshipIds: [entry.relationshipId],
                    type,
                  })
                }
              >
                {entry.name}
              </Button>
            ))}
            {!isMail && (
              <Button
                size="sm"
                loading={busy === 'both'}
                onClick={() =>
                  void run('both', {
                    action: 'assign',
                    relationshipIds: item.suggestions.map((entry) => entry.relationshipId),
                    type,
                  })
                }
              >
                {text.both}
              </Button>
            )}
          </>
        )}
        {canEdit &&
          (item.suggestionKind === 'supplier' || item.suggestionKind === 'none') &&
          supplier && (
            <Button
              size="sm"
              loading={busy === 'save'}
              onClick={() =>
                void run('save', { action: 'assign', relationshipIds: [supplier], type })
              }
            >
              {isMail ? text.fileMail : text.save}
            </Button>
          )}
        {!isMail && (item.suggestionKind === 'event' || item.suggestionKind === 'none') && (
          <Button
            variant="outline"
            size="sm"
            loading={busy === 'event'}
            onClick={() => void run('event', { action: 'event' })}
          >
            {text.asEvent}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          loading={busy === 'ignore'}
          onClick={() => void run('ignore', { action: 'ignore' })}
        >
          {text.ignore}
        </Button>
      </div>
    </li>
  );
}

function TodayList({ items }: { items: InboundItemView[] }) {
  const t = useT();
  const text = t.inbox;
  return (
    <section
      aria-labelledby="eingang-heute"
      className="flex flex-col rounded-lg bg-card px-6 pt-5 pb-2 shadow-card"
    >
      <h2
        id="eingang-heute"
        className="pb-1 font-display font-semibold text-section tracking-section"
      >
        {text.todayTitle(items.length)}
      </h2>
      {items.length === 0 ? (
        <p className="pb-4 text-muted-foreground text-sm">{text.todayEmpty}</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((item) => {
            const first = item.assigned[0];
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 border-line-soft border-t py-3 first:border-t-0"
              >
                <Monogram name={first?.name ?? item.subject} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  {first ? (
                    routerLink({
                      href: first.mailId
                        ? `/lieferanten/${first.relationshipId}/aktivitaeten#mail-${first.mailId}`
                        : `/lieferanten/${first.relationshipId}/umsetzung/termine/${first.meetingId}`,
                      className:
                        'truncate font-semibold text-sm text-text no-underline hover:underline',
                      children: item.subject,
                    })
                  ) : (
                    <span className="truncate font-semibold text-sm">{item.subject}</span>
                  )}
                  <span className="text-muted-foreground text-chip">
                    {[
                      item.kind === 'mail'
                        ? text.forwardedMail
                        : t.meetings.types[item.suggestedType],
                      item.kind === 'mail' ? null : text.sources[item.source],
                      first?.name,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <Badge variant="neutral">
                  {item.objectType === 'filed_mail'
                    ? text.mail
                    : item.objectType === 'event'
                      ? text.event
                      : text.meeting}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Mein Tag, rechts: „Neu eingegangen“ mit der Zahl, sobald eine Anbindung aktiv ist (IN-03). */
export function InboxTile() {
  const t = useT();
  const text = t.inbox;
  const accessToken = useAccessToken();
  const allowed = useCan('termine.sehen');
  const query = useQuery({
    ...inboxQueryOptions(accessToken),
    enabled: accessToken !== '' && allowed,
  });
  if (!allowed || !query.data?.active) return null;
  const count = query.data.open.length;
  return (
    <ListCard aria-labelledby="start-eingang">
      <ListCardHeader id="start-eingang" title={text.navTitle} />
      <div className="flex flex-col gap-2 px-5.5 pb-5">
        <p className={cn('text-sm', count === 0 && 'text-muted-foreground')}>
          {count > 0 ? text.tileCount(count, kindOf(query.data.open)) : text.tileEmpty}
        </p>
        {count > 0 &&
          routerLink({
            href: '/mein-tag/eingang',
            className: cn(buttonVariants({ variant: 'link' }), 'self-start px-0 has-[>svg]:px-0'),
            children: (
              <>
                {text.tileLink}
                <ArrowRightIcon aria-hidden />
              </>
            ),
          })}
      </div>
    </ListCard>
  );
}
