import type { ActivityFilter, ActivityItem } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useId, useState } from 'react';
import { AiDraft } from '@/components/ui/ai-draft';
import { AskRow } from '@/components/ui/ask-row';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { FilterChips } from '@/components/ui/filter-chips';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Monogram } from '@/components/ui/monogram';
import { DisclosureRow, Row, RowGroup } from '@/components/ui/row-group';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { useAsk } from '@/features/prompt/ask-context';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import {
  activitiesQueryOptions,
  addNote,
  downloadMailAttachment,
  filedMailQueryOptions,
  removeFiledMail,
  removeNote,
  updateNote,
} from '@/lib/api';
import { appNow } from '@/lib/clock';
import { useFormat } from '@/lib/format';
import { useLocale, useMessages, useT } from '@/lib/i18n';
import { entriesByMonth, orderedEntries } from './akte-private';
import { aktePrivateMessages } from './akte-private-messages';

type FilterValue = ActivityFilter | 'all';

/** So viele Einträge stehen vorn; der Rest kommt mit „Alles anzeigen“ nach Monaten */
const firstCount = 5;

/** Tag eines Eintrags in Berlin, z. B. „20.11.“ */
function dayMonth(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(new Date(iso));
}

/** Notizen und Mails ändern den Verlauf; danach lädt er neu (wie Aktivitäten, NAV-10) */
function useFeedUpdate(relationshipId: string) {
  const accessToken = useToken();
  const client = useQueryClient();
  const [failure, setFailure] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (work: (token: string) => Promise<unknown>) => {
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

/**
 * Verlauf in Nur für dich (AK-01, K2-c.3, Vorlage K2-Akte-Privat; T2-I19): Frag-Zeile zur
 * Beziehung, Filter, „Neue Notiz“ mit Sichtbarkeit, die jüngsten Einträge mit Angeheftetem oben,
 * „Alles anzeigen“ nach Monaten. Notizen und Mails klappen auf (Text, Anheften, Löschen,
 * Zusammenfassung, Anhänge); Termine und Hinweise öffnen ihr Objekt. Ersetzt die Seite Aktivitäten.
 */
export function History({ relationshipId, name }: { relationshipId: string; name: string }) {
  const t = useT();
  const text = useMessages(aktePrivateMessages);
  const history = text.history;
  const format = useFormat();
  const { locale } = useLocale();
  const accessToken = useToken();
  const ask = useAsk();
  const monthsId = useId();
  const [filter, setFilter] = useState<FilterValue>('all');
  const [showAll, setShowAll] = useState(false);
  const [writing, setWriting] = useState(false);
  const [saved, setSaved] = useState(false);
  const query = useQuery({
    ...activitiesQueryOptions(accessToken, relationshipId, filter === 'all' ? undefined : filter),
    enabled: accessToken !== '',
  });
  const entries = query.data ? orderedEntries(query.data.items, appNow()) : [];
  const first = entries.slice(0, firstCount);
  const rest = entries.slice(firstCount);
  const oldest = entries.reduce<string | null>(
    (min, entry) => (min === null || entry.occurredAt < min ? entry.occurredAt : min),
    null,
  );

  const intro = (
    <div className="flex flex-col gap-3">
      <AskRow
        label={history.ask(name)}
        example={history.askExample(name)}
        onAsk={() => ask({ supplier: relationshipId })}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterChips<FilterValue>
          label={history.filterLabel}
          options={(['all', 'termine', 'mails', 'notizen', 'reziproq'] as const).map((value) => ({
            value,
            label: t.activities.filters[value],
          }))}
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setShowAll(false);
          }}
        />
        {query.data?.canWrite && (
          <Button
            variant="secondary"
            aria-expanded={writing}
            onClick={() => {
              setWriting(!writing);
              setSaved(false);
            }}
          >
            {history.newNote}
          </Button>
        )}
      </div>
      {saved && <StatusLine message={t.activities.saved} onHidden={() => setSaved(false)} />}
      {writing && (
        <NoteForm
          relationshipId={relationshipId}
          onSaved={() => {
            setWriting(false);
            setSaved(true);
          }}
          onCancel={() => setWriting(false)}
        />
      )}
    </div>
  );

  return (
    <>
      <RowGroup id="verlauf" label={history.label} intro={intro}>
        {query.isError ? (
          <Row title={text.failed} />
        ) : !query.data ? (
          <Row title={history.loading} />
        ) : entries.length === 0 ? (
          <Row title={filter === 'all' ? history.empty : history.emptyFilter} />
        ) : (
          <>
            {first.map((entry) => (
              <Entry key={entry.id} item={entry} relationshipId={relationshipId} />
            ))}
            {rest.length > 0 && (
              <DisclosureRow
                title={showAll ? history.less : history.all}
                detail={history.allDetail(entries.length, oldest ? format.date(oldest) : '')}
                open={showAll}
                onToggle={() => setShowAll(!showAll)}
                controls={monthsId}
              />
            )}
          </>
        )}
      </RowGroup>
      {showAll && rest.length > 0 && (
        <div id={monthsId} className="flex flex-col gap-5.5">
          {entriesByMonth(rest, locale).map((group) => (
            <RowGroup key={group.month} level={3} label={group.month}>
              {group.items.map((entry) => (
                <Entry key={entry.id} item={entry} relationshipId={relationshipId} />
              ))}
            </RowGroup>
          ))}
        </div>
      )}
    </>
  );
}

/** Neue Notiz mit Sichtbarkeit Team oder Nur ich (T2-S03) und Telefonnotiz */
function NoteForm({
  relationshipId,
  onSaved,
  onCancel,
}: {
  relationshipId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const text = t.activities;
  const history = useMessages(aktePrivateMessages).history;
  const update = useFeedUpdate(relationshipId);
  const [value, setValue] = useState('');
  const [visibility, setVisibility] = useState<'team' | 'private'>('team');
  const [call, setCall] = useState(false);
  return (
    <form
      aria-label={history.newNote}
      className="flex flex-col gap-3 rounded-md bg-card p-4"
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
        if (ok) onSaved();
      }}
    >
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
        <Button type="button" variant="secondary" onClick={onCancel}>
          {history.cancel}
        </Button>
      </FormActions>
    </form>
  );
}

/** Ein Eintrag: Zeile nach der Vorlage, Notizen und Mails klappen auf */
function Entry({ item, relationshipId }: { item: ActivityItem; relationshipId: string }) {
  const t = useT();
  const history = useMessages(aktePrivateMessages).history;
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const actor = item.actor.type === 'person' ? item.actor.name : t.activities.reziproq;
  const date = dayMonth(item.occurredAt, locale);
  const chip = <Badge variant="neutral">{history.chips[item.kind]}</Badge>;

  if (item.kind === 'note' || item.kind === 'call') {
    const call = item.kind === 'call';
    const title = item.pinned
      ? history.titles.pinned(actor)
      : item.mine
        ? call
          ? history.titles.ownCall
          : history.titles.ownNote
        : call
          ? history.titles.call(actor)
          : history.titles.note(actor);
    return (
      <DisclosureRow
        lead={<Monogram name={actor} tone="ink" />}
        title={title}
        detail={[date, item.visibility === 'private' ? history.onlyYou : null, item.title]
          .filter(Boolean)
          .join(' · ')}
        value={chip}
        open={open}
        onToggle={() => setOpen(!open)}
      >
        <NoteDetails item={item} relationshipId={relationshipId} />
      </DisclosureRow>
    );
  }

  if (item.kind === 'mail' && item.mail) {
    const sender = item.mail.fromName ?? item.mail.fromEmail;
    // Eine Mail von außen ordnet jemand aus dem Team zu; sie zeigt den Absender
    const fromOutside = sender !== actor;
    // Ohne Betreff liefert die API „–“; dann steht nur, wer sie abgelegt hat
    const subject = item.title.trim() && item.title.trim() !== '–' ? item.title : null;
    return (
      <DisclosureRow
        lead={<Monogram name={sender} tone={fromOutside ? 'petrol' : 'ink'} />}
        title={
          fromOutside
            ? history.titles.mailFrom(sender)
            : (subject ?? history.titles.mailFrom(sender))
        }
        detail={[date, fromOutside ? subject : null, history.filedBy(actor)]
          .filter(Boolean)
          .join(' · ')}
        value={chip}
        open={open}
        onToggle={() => setOpen(!open)}
      >
        <MailDetails item={item} relationshipId={relationshipId} />
      </DisclosureRow>
    );
  }

  const title =
    item.kind === 'hint'
      ? ((t.hints.rules as Record<string, string>)[item.code ?? ''] ?? t.activities.kinds.hint)
      : item.kind === 'agent'
        ? (t.activities.agentTitles[item.code ?? ''] ?? t.activities.kinds.agent)
        : item.title;
  const meta =
    item.kind === 'agent'
      ? (t.activities.draftStatuses[item.meta ?? ''] ?? null)
      : item.kind === 'hint'
        ? ((t.hints.statuses as Record<string, string>)[item.meta ?? ''] ?? null)
        : item.kind === 'meeting' && item.code
          ? // IN-03: Herkunft des Termins, z. B. „aus Outlook“
            [t.activities.meetingSources[item.code] ?? null, item.meta].filter(Boolean).join(' · ')
          : item.meta;
  return (
    <Row
      {...(item.href ? { href: item.href } : {})}
      lead={
        item.actor.type === 'reziproq' ? (
          <Monogram name={actor} brand />
        ) : (
          <Monogram name={actor} tone="ink" />
        )
      }
      title={title}
      detail={[date, meta].filter(Boolean).join(' · ')}
      value={chip}
      renderLink={routerLink}
    />
  );
}

/** Notiz aufgeklappt: ganzer Text; die eigene lässt sich anheften, lösen und löschen */
function NoteDetails({ item, relationshipId }: { item: ActivityItem; relationshipId: string }) {
  const text = useT().activities;
  const history = useMessages(aktePrivateMessages).history;
  const update = useFeedUpdate(relationshipId);
  const noteId = item.id.startsWith('note:') ? item.id.slice(5) : null;
  return (
    <>
      <p className="whitespace-pre-line break-words text-base">{item.title}</p>
      {update.failure && <StatusLine message={text.failedSave} tone="warning" />}
      {item.mine && noteId && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            loading={update.busy}
            onClick={() =>
              void update.run((token) =>
                updateNote(token, relationshipId, noteId, { pinned: !item.pinned }),
              )
            }
          >
            {item.pinned ? text.unpin : text.pin}
          </Button>
          <ConfirmButton
            question={history.removeNote}
            confirmLabel={text.remove}
            cancelLabel={history.cancel}
            onConfirm={() => void update.run((token) => removeNote(token, relationshipId, noteId))}
          >
            {text.remove}
          </ConfirmButton>
        </div>
      )}
    </>
  );
}

/**
 * Mail aufgeklappt (IN-04): Zusammenfassung als Entwurf von Reziproq mit der Mail als Quelle,
 * Anhänge zum Laden, Text zum Aufklappen (erst dann geladen); löschen nur, wer sie abgelegt hat.
 */
function MailDetails({ item, relationshipId }: { item: ActivityItem; relationshipId: string }) {
  const text = useT().activities;
  const accessToken = useToken();
  const client = useQueryClient();
  const [showText, setShowText] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const textId = useId();
  const mail = item.mail;
  const body = useQuery({
    ...filedMailQueryOptions(accessToken, relationshipId, mail?.id ?? ''),
    enabled: showText && accessToken !== '' && Boolean(mail),
  });
  if (!mail) return null;
  return (
    <>
      {mail.summary && (
        <AiDraft
          heading={text.mail.summaryHeading}
          sourcesLabel={text.mail.sourcesLabel}
          sources={[{ key: mail.id, label: text.mail.sourceThisMail }]}
          className="p-4"
        >
          {mail.summary}
        </AiDraft>
      )}
      {mail.attachments.length > 0 && (
        <ul aria-label={text.mail.attachments} className="flex min-w-0 flex-wrap gap-2">
          {mail.attachments.map((attachment) => (
            <li key={attachment.id} className="min-w-0 max-w-full">
              {attachment.stored ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="max-w-full"
                  aria-label={`${attachment.fileName} · ${text.mail.kb(attachment.size)}`}
                  onClick={() => {
                    setFailure(null);
                    void downloadMailAttachment(
                      accessToken,
                      relationshipId,
                      mail.id,
                      attachment,
                    ).catch(() => setFailure(text.mail.downloadFailed));
                  }}
                >
                  <span className="truncate">{attachment.fileName}</span>
                  <span className="shrink-0">· {text.mail.kb(attachment.size)}</span>
                </Button>
              ) : (
                <Badge variant="neutral">
                  {attachment.fileName} · {text.mail.tooLarge}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
      {failure && <StatusLine message={failure} tone="warning" />}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          aria-expanded={showText}
          aria-controls={textId}
          onClick={() => setShowText(!showText)}
        >
          {showText ? text.mail.hideText : text.mail.showText}
        </Button>
        {item.mine && (
          <ConfirmButton
            question={text.mail.removeConfirm}
            confirmLabel={text.mail.removeYes}
            cancelLabel={text.mail.cancel}
            onConfirm={() => {
              setFailure(null);
              void removeFiledMail(accessToken, relationshipId, mail.id)
                .then(() =>
                  client.invalidateQueries({
                    queryKey: ['suppliers', relationshipId, 'aktivitaeten'],
                  }),
                )
                .catch(() => setFailure(text.mail.removeFailed));
            }}
          >
            {text.remove}
          </ConfirmButton>
        )}
      </div>
      {showText && (
        <div id={textId} className="flex flex-col gap-2 rounded-md bg-paper p-4">
          {body.isError ? (
            <span className="text-muted-foreground">{text.mail.textFailed}</span>
          ) : !body.data ? (
            <span className="text-muted-foreground">{text.mail.textLoading}</span>
          ) : (
            <>
              {body.data.toEmails.length > 0 && (
                <span className="break-words text-muted-foreground text-sm">
                  {text.mail.to}: {body.data.toEmails.join(', ')}
                </span>
              )}
              <p className="whitespace-pre-line break-words">{body.data.bodyText}</p>
            </>
          )}
        </div>
      )}
    </>
  );
}
