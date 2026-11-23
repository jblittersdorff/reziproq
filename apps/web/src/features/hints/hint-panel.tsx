import { earlyWarningRuleKeys, type Hint, type HintList } from '@reziproq/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, XIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { AiDraft, type DraftSource } from '@/components/ui/ai-draft';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Monogram } from '@/components/ui/monogram';
import { NextStep } from '@/components/ui/next-step';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { routerLink } from '@/features/shell/navigation';
import { acceptHint, dismissHint, rateHint, startHint } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const earlyWarning = new Set<string>(earlyWarningRuleKeys);
export const isActive = (hint: Hint) => hint.status === 'open' || hint.status === 'in_progress';

/** Satz, warum der Hinweis erscheint; Datum und Zahlen im Detail für die Sprache formatiert */
export function useHintWhy() {
  const t = useT().hints;
  const format = useFormat();
  const { locale } = useLocale();
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  return (hint: Pick<Hint, 'ruleKey' | 'detail'>) => {
    const why = t.why[hint.ruleKey] as (detail: Hint['detail']) => string;
    const detail = Object.fromEntries(
      Object.entries(hint.detail).map(([key, value]) => [
        key,
        typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? format.date(value)
          : typeof value === 'number' && !Number.isInteger(value)
            ? number.format(value)
            : value,
      ]),
    );
    return why(detail);
  };
}

/** Schwere als Text in einer Pille (Status immer als Text) */
export function SeverityBadge({ hint }: { hint: Pick<Hint, 'severity'> }) {
  const t = useT().hints;
  return (
    <Badge
      variant={
        hint.severity === 'high' ? 'danger' : hint.severity === 'medium' ? 'warning' : 'neutral'
      }
    >
      {t.severities[hint.severity]}
    </Badge>
  );
}

function useAccessToken() {
  const auth = useAuth();
  return auth.user?.access_token ?? '';
}

/**
 * Leiste eines Hinweises (KI-16, nach Hinweise.dc.html): Kopf mit Kreis, Schwere und Stand, Beleg
 * mit Werten, Begründung als Entwurf mit Quellen, der nächste Schritt als Tinte-Karte, In Arbeit,
 * Annehmen (Regeln aus FS-01), Nicht relevant mit Grund und „War dieser Hinweis hilfreich?“.
 * page: unter 760 px als eigene Ansicht mit Zurück.
 */
export function HintPanel({
  hint,
  onClose,
  page = false,
  standalone = false,
}: {
  hint: Hint;
  onClose?: () => void;
  page?: boolean;
  /** Auf der eigenen Seite des Hinweises: ohne Karte und Kopf, die stehen in der Seite */
  standalone?: boolean;
}) {
  const t = useT();
  const text = t.hints;
  const format = useFormat();
  const why = useHintWhy();
  const accessToken = useAccessToken();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (work: () => Promise<Hint>, done: string) => {
    setBusy(true);
    setFailed(false);
    try {
      const updated = await work();
      queryClient.setQueryData(['hinweise', hint.id], updated);
      queryClient.setQueryData<HintList>(['hinweise'], (list) =>
        list
          ? {
              ...list,
              hints: list.hints.map((entry) => (entry.id === updated.id ? updated : entry)),
            }
          : list,
      );
      setMessage(done);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const title = why(hint);
  const supplier = hint.supplier ?? text.organization;
  const active = isActive(hint);
  const isNew = earlyWarning.has(hint.ruleKey);
  const values = hint.evidence.values ?? [];
  const sources: DraftSource[] = [
    ...(hint.evidence.refs ?? []).map((ref) => ({
      key: `${ref.objectType}-${ref.objectId}`,
      label: ref.title,
    })),
    ...(hint.evidence.sources ?? []).map((source) => ({
      key: source.url,
      label: source.publishedOn
        ? `${source.title} · ${format.date(source.publishedOn)}`
        : source.title,
      href: source.url,
    })),
  ];
  const ruleText = text.ruleTexts[hint.ruleKey];

  return (
    <section
      aria-label={text.panelLabel(title)}
      className={cn(
        'flex min-w-0 flex-col gap-4',
        !standalone && 'rounded-lg bg-card p-5 shadow-card',
        page && 'p-4',
      )}
    >
      {page && (
        <Button variant="ghost" size="sm" className="self-start" onClick={onClose}>
          <ArrowLeftIcon aria-hidden />
          {text.back}
        </Button>
      )}
      <div className="flex items-start gap-3">
        <Monogram name={supplier} size="lg" tone={hint.isFocus ? 'shared' : 'neutral'} />
        <span className="flex min-w-0 grow flex-col gap-1">
          <strong className="font-display font-semibold text-lg">{title}</strong>
          <span className="text-muted-foreground text-sm">
            {[supplier, hint.isFocus ? text.focus : null, text.rules[hint.ruleKey]]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        {onClose && !page && (
          <Button variant="ghost" size="icon" aria-label={text.close} onClick={onClose}>
            <XIcon aria-hidden />
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
        <span>{text.severity}</span>
        <SeverityBadge hint={hint} />
        <Badge variant={active ? 'warning' : hint.status === 'accepted' ? 'success' : 'neutral'}>
          {text.statuses[hint.status]}
        </Badge>
        <span>{text.openSince(format.date(hint.createdAt))}</span>
        <span>{text.checkedAt(format.dateTime(hint.lastSeenAt))}</span>
      </div>
      {message && <StatusLine message={message} onHidden={() => setMessage(null)} />}
      {failed && <StatusLine message={text.failedSave} tone="warning" />}

      {(values.length > 0 || hint.evidence.threshold || ruleText) && (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-sm">
            {text.evidence}
            {hint.evidence.metric && ` · ${hint.evidence.metric}`}
          </h3>
          {values.length > 0 && (
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {values.map((value) => (
                <div
                  key={`${value.label}-${value.value}`}
                  className={cn(
                    'flex min-w-0 flex-col gap-1 rounded-md p-3',
                    standalone ? 'bg-card shadow-card' : 'bg-paper',
                  )}
                >
                  <dt className="truncate text-muted-foreground text-chip">{value.label}</dt>
                  <dd className="font-display font-semibold text-lg tabular-nums">{value.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {hint.evidence.threshold && (
            <p className="text-sm">
              <span className="text-muted-foreground">{text.threshold}: </span>
              {hint.evidence.threshold}
              {hint.evidence.period && (
                <span className="text-muted-foreground">
                  {' · '}
                  {text.period}: {hint.evidence.period}
                </span>
              )}
            </p>
          )}
          {ruleText && <p className="text-muted-foreground text-sm">{ruleText}</p>}
        </div>
      )}

      {hint.explanation ? (
        <AiDraft heading={text.whyMatters} sourcesLabel={text.sources} sources={sources}>
          <p>{hint.explanation}</p>
        </AiDraft>
      ) : (
        isNew && active && <p className="text-muted-foreground text-sm">{text.noExplanation}</p>
      )}

      {hint.resolvedReason && hint.status === 'resolved' && (
        <p className="text-muted-foreground text-sm">{text.resolvedBecause(hint.resolvedReason)}</p>
      )}
      {hint.decidedAt && hint.decidedByName && (
        <p className="text-muted-foreground text-sm">
          {text.decidedBy(hint.decidedByName, format.date(hint.decidedAt))}
          {hint.reason && ` · ${hint.reason}`}
        </p>
      )}

      {active && (
        <NextStep
          nested
          headingAs="h3"
          eyebrow={text.nextStep}
          title={text.nextSteps[hint.ruleKey]}
          action={routerLink({
            href: hint.href,
            className: buttonVariants({ variant: 'mint', size: 'sm' }),
            children:
              hint.ruleKey === 'performance_drop' && hint.href.includes('?hinweis=')
                ? text.nextOpenPrefilled
                : text.nextOpen,
          })}
        />
      )}
      {hint.actionHref &&
        routerLink({
          href: hint.actionHref,
          className: buttonVariants({ variant: 'secondary', className: 'self-start' }),
          children: text.toAction,
        })}

      {active &&
        (hint.canAccept || hint.canDismiss ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {hint.status === 'open' && (
                <Button
                  variant="secondary"
                  loading={busy}
                  onClick={() => void run(() => startHint(accessToken, hint.id), text.started)}
                >
                  {text.startWork}
                </Button>
              )}
              {!isNew && hint.canAccept && (
                <Button
                  variant="secondary"
                  loading={busy}
                  onClick={() => void run(() => acceptHint(accessToken, hint.id), text.accepted)}
                >
                  {text.accept}
                </Button>
              )}
            </div>
            {!isNew &&
              (hint.canAccept ? (
                <p className="text-muted-foreground text-sm">{text.acceptHint}</p>
              ) : (
                <p className="text-muted-foreground text-sm">{text.acceptOnlyDismiss}</p>
              ))}
            <form
              className="flex flex-col gap-3"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                void run(
                  () => dismissHint(accessToken, hint.id, { reason: reason.trim() }),
                  text.dismissed,
                );
              }}
            >
              <FormField label={text.reason} hint={text.reasonHint}>
                {(field) => (
                  <Textarea
                    {...field}
                    value={reason}
                    required
                    minLength={3}
                    maxLength={1000}
                    rows={2}
                    onChange={(event) => setReason(event.target.value)}
                  />
                )}
              </FormField>
              <Button
                type="submit"
                variant="secondary"
                className="self-start"
                disabled={reason.trim().length < 3}
                loading={busy}
              >
                {text.notRelevant}
              </Button>
            </form>
          </div>
        ) : (
          <p role="status" className="rounded-lg bg-paper px-4 py-3 text-muted-foreground">
            {text.noPermission}
          </p>
        ))}

      <fieldset className="flex flex-wrap items-center gap-2 border-line-soft border-t pt-4">
        <legend className="sr-only">{text.helpfulQuestion}</legend>
        <span aria-hidden className="text-sm">
          {text.helpfulQuestion}
        </span>
        <Button
          size="sm"
          variant="secondary"
          aria-pressed={hint.feedback === 'helpful'}
          className="aria-pressed:bg-mint-soft"
          disabled={busy}
          onClick={() => void run(() => rateHint(accessToken, hint.id, true), text.rated)}
        >
          {text.yes}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          aria-pressed={hint.feedback === 'not_helpful'}
          className="aria-pressed:bg-mint-soft"
          disabled={busy}
          onClick={() => void run(() => rateHint(accessToken, hint.id, false), text.rated)}
        >
          {text.no}
        </Button>
      </fieldset>
    </section>
  );
}
