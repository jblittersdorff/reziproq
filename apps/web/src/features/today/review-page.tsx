import type { ReviewDecision, ReviewItem } from '@reziproq/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { AiDraft } from '@/components/ui/ai-draft';
import { BackLink } from '@/components/ui/back-link';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { PageTitle } from '@/components/ui/page-title';
import { PrivateNote } from '@/components/ui/private-note';
import { Row, RowGroup } from '@/components/ui/row-group';
import { Textarea } from '@/components/ui/textarea';
import { routerLink } from '@/features/shell/navigation';
import { useDocumentTitle } from '@/features/shell/page-header';
import { shortDate } from '@/features/start/next-action';
import { ApiError, decideReview, reviewStackQueryOptions } from '@/lib/api';
import { useLocale, useMessages, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { reviewMessages } from './review-messages';

type Text = (typeof reviewMessages)['de'];
type Mode = 'view' | 'discard' | 'adjust';

const pad = (n: number) => String(n).padStart(2, '0');
const localDay = (value: Date) =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

/** „heute 06:02“, „gestern 18:30“ oder „Mo 23.11. 06:02“ */
function whenText(text: Text, locale: string, iso: string) {
  const value = new Date(iso);
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
    value,
  );
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (localDay(value) === localDay(now)) return text.today(time);
  if (localDay(value) === localDay(yesterday)) return text.yesterday(time);
  return `${shortDate(locale, localDay(value))} ${time}`;
}

/** Zeilen eines Eingangs zum Zuordnen: Termin, Vorschlag, Begründung */
function inboundLines(
  text: Text,
  types: Record<string, string>,
  locale: string,
  item: ReviewItem,
): string[] {
  const inbound = item.inbound;
  if (!inbound) return item.lines;
  const date = new Date(inbound.startsAt);
  const when = `${shortDate(locale, localDay(date))} ${new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)}`;
  const suggestion =
    inbound.suggestionKind === 'event'
      ? text.inbound.event
      : inbound.suggestions.length > 0
        ? text.inbound.suggestion(
            inbound.suggestions.map((entry) => entry.name).join(', '),
            types[inbound.suggestedType] ?? inbound.suggestedType,
          )
        : text.inbound.none;
  return [
    text.inbound.when(when),
    suggestion,
    ...(inbound.reason ? [text.inbound.reason(inbound.reason)] : []),
  ];
}

/**
 * Kurz prüfen (HE-01, UX-20 `DraftStack`; Vorlagen K1-Kurz-Pruefen, K1-Kurz-Pruefen-Mobil): ein
 * Entwurf nach dem anderen mit Kontext, Text und Quellen. Übernehmen (Enter), Anpassen, Verwerfen mit
 * Grund (V), Später; Fortschritt als Balken; am Ende „Alles geprüft. x von y übernommen.“ Die Wahl
 * für Grund und Text klappt in der Karte auf, ohne Überlagerung (E-K0-01).
 */
export function ReviewPage({ start }: { start?: string | undefined }) {
  const text = useMessages(reviewMessages);
  useDocumentTitle(text.title);
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({ ...reviewStackQueryOptions(accessToken), enabled: accessToken !== '' });
  // Der Stapel bleibt, wie er beim Öffnen war; Neuladen nach einer Entscheidung ordnet nichts um.
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [minutes, setMinutes] = useState(0);
  useEffect(() => {
    if (items || !query.data) return;
    const all = query.data.items;
    const first = start ? all.findIndex((item) => item.id === start) : -1;
    setItems(first > 0 ? [...all.slice(first), ...all.slice(0, first)] : all);
    setMinutes(query.data.minutes);
  }, [items, query.data, start]);

  const header = (where?: string) => (
    <PageTitle
      title={text.title}
      where={where}
      back={<BackLink label={text.back} href="/heute" renderLink={routerLink} />}
    />
  );
  if (query.isError && !items) {
    return (
      <div className="flex flex-col gap-5.5">
        {header()}
        <ErrorState
          title={text.failed}
          action={
            <Button variant="secondary" onClick={() => query.refetch()}>
              {text.retry}
            </Button>
          }
        />
      </div>
    );
  }
  if (!items) {
    return (
      <div className="flex flex-col gap-5.5">
        {header()}
        <LoadingState label={text.loading} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5.5">
      {header(items.length > 0 ? text.where(items.length, minutes) : undefined)}
      <div className="grid gap-5.5 wide:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5.5">
          {items.length === 0 ? (
            <RowGroup>
              <Row title={text.empty} href="/heute" renderLink={routerLink} />
            </RowGroup>
          ) : (
            <Stack items={items} />
          )}
        </div>
        <aside className="flex min-w-0 flex-col gap-5.5">
          <RowGroup label={text.effects.label}>
            <Row title={text.accept} detail={text.effects.accept} wrap />
            <Row title={text.adjust} detail={text.effects.adjust} wrap />
            <Row title={text.discard} detail={text.effects.discard} wrap />
          </RowGroup>
          <PrivateNote title={text.never.title}>{text.never.text}</PrivateNote>
        </aside>
      </div>
    </div>
  );
}

function Stack({ items }: { items: ReviewItem[] }) {
  const text = useMessages(reviewMessages);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<('accepted' | 'discarded' | 'snoozed')[]>([]);
  const total = items.length;
  const done = index >= total;
  const accepted = results.filter((result) => result === 'accepted').length;
  const current = items[index];
  return (
    <>
      <div className="flex items-center gap-3">
        <span className="whitespace-nowrap font-semibold text-muted-strong text-sm tabular-nums">
          {done ? text.finished : text.counter(index + 1, total)}
        </span>
        <div
          role="progressbar"
          aria-label={text.progress}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={Math.min(index, total)}
          className="flex min-w-0 flex-1 gap-1.5"
        >
          {items.map((item, position) => (
            <span
              key={item.id}
              className={cn(
                'h-1.5 flex-1 rounded-full',
                position < index ? 'bg-petrol' : position === index ? 'bg-mint' : 'bg-track',
              )}
            />
          ))}
        </div>
      </div>
      {done || !current ? (
        <section className="flex flex-col items-start gap-3 rounded-lg bg-card p-5">
          <p role="status" className="font-display font-semibold text-lg tracking-section">
            {text.done(accepted, total)}
          </p>
          <p className="text-base text-muted-strong">{text.doneText}</p>
          <Button variant="secondary" asChild>
            {routerLink({ href: '/heute', className: 'no-underline', children: text.backToToday })}
          </Button>
        </section>
      ) : (
        <DraftCard
          key={current.id}
          item={current}
          onDecided={(result) => {
            setResults((previous) => [...previous, result]);
            setIndex((previous) => previous + 1);
          }}
        />
      )}
    </>
  );
}

/** Ein Entwurf mit seinen Knöpfen; Grund und angepasster Text klappen in der Karte auf */
function DraftCard({
  item,
  onDecided,
}: {
  item: ReviewItem;
  onDecided: (result: 'accepted' | 'discarded' | 'snoozed') => void;
}) {
  const text = useMessages(reviewMessages);
  const t = useT();
  const { locale } = useLocale();
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const client = useQueryClient();
  const [mode, setMode] = useState<Mode>('view');
  const [reason, setReason] = useState('');
  const [edited, setEdited] = useState(item.text ?? '');
  const fieldId = useId();
  const decide = useMutation({
    mutationFn: (decision: ReviewDecision) => decideReview(accessToken, item.id, decision),
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: ['heute'] });
      onDecided(result.state);
    },
  });
  const choiceNeeded =
    decide.error instanceof ApiError && decide.error.status === 422 && item.source === 'inbound';
  const accept = () => {
    if (!item.canAccept || decide.isPending) return;
    decide.mutate({ decision: 'uebernehmen' });
  };
  const openDiscard = () => setMode('discard');

  // Tastatur (Vorlage): Enter übernimmt, V öffnet Verwerfen; nicht beim Schreiben in einem Feld.
  const keys = useRef({ accept, openDiscard, mode });
  keys.current = { accept, openDiscard, mode };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (keys.current.mode !== 'view' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (target?.closest('input, textarea, select, [contenteditable="true"], dialog')) return;
      if (event.key === 'Enter' && !target?.closest('a, button')) {
        event.preventDefault();
        keys.current.accept();
      } else if (event.key === 'v' || event.key === 'V') {
        event.preventDefault();
        keys.current.openDiscard();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Wischen auf dem Telefon: nach rechts übernimmt, nach links öffnet Verwerfen (Vorlage mobil).
  const swipe = useRef<{ x: number; id: number } | null>(null);
  const lines = inboundLines(text, t.meetings.types as Record<string, string>, locale, item);
  const context = [item.counterpart, text.kinds[item.kind] ?? null, item.subject]
    .filter(Boolean)
    .join(' · ');
  const reasonValid = reason.trim().length >= 3;

  return (
    <div
      onPointerDown={(event) => {
        if (event.pointerType === 'touch' && mode === 'view') {
          swipe.current = { x: event.clientX, id: event.pointerId };
        }
      }}
      onPointerUp={(event) => {
        const start = swipe.current;
        swipe.current = null;
        if (!start || start.id !== event.pointerId) return;
        const distance = event.clientX - start.x;
        if (distance > 96) accept();
        else if (distance < -96) openDiscard();
      }}
      className="touch-pan-y"
    >
      <AiDraft
        heading={text.heading(whenText(text, locale, item.createdAt))}
        sourcesLabel={text.sources}
        sources={item.sources.map((source) => ({ key: source, label: source }))}
        className="gap-4"
        actions={
          <div className="flex w-full flex-col gap-3">
            {mode === 'discard' && (
              <form
                className="flex flex-col gap-2 rounded-md bg-paper p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (reasonValid) decide.mutate({ decision: 'verwerfen', reason: reason.trim() });
                }}
              >
                <label htmlFor={fieldId} className="font-semibold text-sm">
                  {text.reasonLabel}
                </label>
                <Textarea
                  id={fieldId}
                  value={reason}
                  autoFocus
                  rows={2}
                  onChange={(event) => setReason(event.target.value)}
                  aria-describedby={`${fieldId}-hint`}
                />
                <p id={`${fieldId}-hint`} className="text-muted-foreground text-sm">
                  {text.reasonHint}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={!reasonValid}
                    loading={decide.isPending}
                  >
                    {text.discardNow}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setMode('view')}>
                    {text.cancel}
                  </Button>
                </div>
              </form>
            )}
            {mode === 'adjust' && item.adjust !== 'place' && (
              <form
                className="flex flex-col gap-2 rounded-md bg-paper p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (edited.trim())
                    decide.mutate({ decision: 'uebernehmen', text: edited.trim() });
                }}
              >
                <label htmlFor={fieldId} className="font-semibold text-sm">
                  {item.adjust === 'title' ? text.titleLabel : text.textLabel}
                </label>
                <Textarea
                  id={fieldId}
                  value={edited}
                  autoFocus
                  rows={item.adjust === 'title' ? 2 : 6}
                  onChange={(event) => setEdited(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={!edited.trim()} loading={decide.isPending}>
                    {text.acceptAdjusted}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setMode('view')}>
                    {text.cancel}
                  </Button>
                </div>
              </form>
            )}
            {mode === 'view' && (
              <>
                {/* Telefon: Verwerfen und Übernehmen nebeneinander, mit einer Hand erreichbar */}
                <div className="grid grid-cols-2 gap-2.5 shell:flex shell:flex-wrap shell:items-center">
                  <Button
                    className="h-13 shell:order-2 shell:h-11"
                    variant="secondary"
                    onClick={openDiscard}
                  >
                    {text.discard}
                  </Button>
                  <Button
                    className="h-13 shell:order-first shell:h-11"
                    disabled={!item.canAccept}
                    loading={decide.isPending}
                    onClick={accept}
                  >
                    {text.accept}
                  </Button>
                  {item.adjust === 'place' ? (
                    item.href &&
                    routerLink({
                      href: item.href,
                      className:
                        'inline-flex h-11 items-center justify-center rounded-full bg-control px-5 font-semibold text-ink text-sm no-underline hover:bg-line focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 shell:order-1',
                      children: item.source === 'inbound' ? text.chooseAtPlace : text.adjustAtPlace,
                    })
                  ) : (
                    <Button
                      className="shell:order-1"
                      variant="secondary"
                      onClick={() => setMode('adjust')}
                    >
                      {text.adjust}
                    </Button>
                  )}
                  <Button
                    className="shell:order-3"
                    variant="ghost"
                    loading={decide.isPending && decide.variables?.decision === 'spaeter'}
                    onClick={() => decide.mutate({ decision: 'spaeter' })}
                  >
                    {text.later}
                  </Button>
                  <span className="col-span-2 hidden text-muted-foreground text-sm shell:order-4 shell:ml-auto shell:inline">
                    {text.keys}
                  </span>
                </div>
                <p className="text-center text-muted-foreground text-sm shell:hidden">
                  {text.swipe}
                </p>
              </>
            )}
            {!item.canAccept && item.source === 'inbound' && (
              <p className="text-muted-strong text-sm">{text.needsChoice}</p>
            )}
            {decide.isError && (
              <p role="alert" className="text-destructive text-sm">
                {choiceNeeded ? text.needsChoice : text.failedDecision}
              </p>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            {context && <p className="text-detail text-muted-foreground">{context}</p>}
            <h2 className="text-balance font-display font-semibold text-section text-ink tracking-section">
              {item.title}
            </h2>
          </div>
          {lines.length > 0 && (
            <ul className="flex flex-col gap-1.5 rounded-md bg-paper px-4.5 py-4 text-base leading-relaxed">
              {/* Gleiche Aussagen zählen einmal; die Aussage ist der Schlüssel. */}
              {[...new Set(lines)].map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      </AiDraft>
    </div>
  );
}
