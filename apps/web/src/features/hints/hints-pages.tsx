import type { Hint } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LayerPanel } from '@/components/ui/layer-panel';
import { ListCard, ListCardHeader, ListRow, ListRowText } from '@/components/ui/list-card';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/features/auth/use-permissions';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import {
  acceptHint,
  dismissHint,
  hintQueryOptions,
  hintSettingsQueryOptions,
  hintsQueryOptions,
  saveHintSettings,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';

function useAccessToken() {
  const auth = useAuth();
  return auth.user?.access_token ?? '';
}

/** Satz, warum der Hinweis erscheint */
export function useHintWhy() {
  const t = useT().hints;
  const format = useFormat();
  return (hint: Hint) => {
    const why = t.why[hint.ruleKey] as (detail: Hint['detail']) => string;
    // Datumsangaben im Detail stehen als ISO-Datum und werden für die Sprache formatiert.
    const detail = Object.fromEntries(
      Object.entries(hint.detail).map(([key, value]) => [
        key,
        typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? format.date(value) : value,
      ]),
    );
    return why(detail);
  };
}

/**
 * Hinweise (FS-01): nach Lieferant gruppiert, je Hinweis ein Satz, warum, und „Beheben“. Annehmen
 * und Verwerfen stehen auf der Seite des Hinweises.
 */
export function HintsPage() {
  const t = useT();
  const text = t.hints;
  const accessToken = useAccessToken();
  const query = useQuery({ ...hintsQueryOptions(accessToken), enabled: accessToken !== '' });
  const why = useHintWhy();

  const open = query.data?.hints.filter((hint) => hint.status === 'open') ?? [];
  const decided = query.data?.hints.filter((hint) => hint.status !== 'open') ?? [];
  const groups = new Map<string, Hint[]>();
  for (const hint of open) {
    const key = hint.supplier ?? text.organization;
    groups.set(key, [...(groups.get(key) ?? []), hint]);
  }

  return (
    <>
      <PageHeader size="list" title={text.title} purpose={text.purpose} />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : open.length === 0 ? (
        <EmptyState title={text.emptyTitle} description={text.emptyText} />
      ) : (
        [...groups.entries()].map(([group, hints]) => (
          <ListCard key={group} aria-label={group}>
            <ListCardHeader title={group} />
            <ul>
              {hints.map((hint) => (
                <li key={hint.id}>
                  <ListRow>
                    <ListRowText title={text.rules[hint.ruleKey]} detail={why(hint)} />
                    <div className="flex flex-wrap gap-2">
                      {routerLink({
                        href: hint.href,
                        className: buttonVariants({ size: 'sm' }),
                        children: text.fix,
                      })}
                      {routerLink({
                        href: `/hinweise/${hint.id}`,
                        className: buttonVariants({ size: 'sm', variant: 'secondary' }),
                        'aria-label': `${text.details}: ${text.rules[hint.ruleKey]}`,
                        children: text.details,
                      })}
                    </div>
                  </ListRow>
                </li>
              ))}
            </ul>
          </ListCard>
        ))
      )}
      {decided.length > 0 && (
        <ListCard aria-label={text.decided}>
          <ListCardHeader title={text.decided} />
          <ul>
            {decided.map((hint) => (
              <li key={hint.id}>
                <ListRow asChild>
                  {routerLink({
                    href: `/hinweise/${hint.id}`,
                    className: '',
                    children: (
                      <>
                        <ListRowText
                          title={text.rules[hint.ruleKey]}
                          detail={hint.supplier ?? text.organization}
                        />
                        <Badge variant={hint.status === 'accepted' ? 'success' : 'neutral'}>
                          {text.statuses[hint.status]}
                        </Badge>
                      </>
                    ),
                  })}
                </ListRow>
              </li>
            ))}
          </ul>
        </ListCard>
      )}
    </>
  );
}

/** Ein Hinweis: warum, Beheben, Annehmen oder begründet Verwerfen. */
export function HintPage({ hintId }: { hintId: string }) {
  const t = useT();
  const text = t.hints;
  const format = useFormat();
  const accessToken = useAccessToken();
  const queryClient = useQueryClient();
  const options = hintQueryOptions(accessToken, hintId);
  const query = useQuery({ ...options, enabled: accessToken !== '' });
  const why = useHintWhy();
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (work: () => Promise<Hint>, done: string) => {
    setBusy(true);
    setFailed(false);
    try {
      queryClient.setQueryData(options.queryKey, await work());
      await queryClient.invalidateQueries({ queryKey: ['hinweise'], exact: true });
      setMessage(done);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const hint = query.data;
  return (
    <>
      <PagePath trail={[{ label: text.navTitle, href: '/hinweise' }]} current={text.detailTitle} />
      <PageHeader title={text.detailTitle} {...(hint && { purpose: text.rules[hint.ruleKey] })} />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !hint ? (
        <LoadingState label={text.loading} />
      ) : (
        <div className="flex max-w-3xl flex-col gap-6">
          {message && <StatusLine message={message} onHidden={() => setMessage(null)} />}
          {failed && <StatusLine message={text.failedSave} tone="warning" />}
          <LayerPanel
            layer="private"
            title={hint.supplier ?? text.organization}
            chip={t.workspace.internal}
          >
            <p>
              <Badge variant={hint.status === 'open' ? 'warning' : 'neutral'}>
                {text.statuses[hint.status]}
              </Badge>
            </p>
            <p className="text-base">{why(hint)}</p>
            {hint.decidedAt && hint.decidedByName && (
              <p className="text-muted-foreground text-sm">
                {text.decidedBy(hint.decidedByName, format.date(hint.decidedAt))}
                {hint.reason && ` · ${hint.reason}`}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {routerLink({
                href: hint.href,
                className: buttonVariants({ variant: 'secondary' }),
                children: text.fix,
              })}
              {hint.actionHref &&
                routerLink({
                  href: hint.actionHref,
                  className: buttonVariants({ variant: 'secondary' }),
                  children: text.toAction,
                })}
            </div>
          </LayerPanel>
          {hint.status === 'open' &&
            (hint.canAccept || hint.canDismiss ? (
              <div className="flex flex-col gap-5">
                {hint.canAccept ? (
                  <div className="flex flex-col gap-2">
                    <Button
                      className="self-start"
                      loading={busy}
                      onClick={() =>
                        void run(() => acceptHint(accessToken, hint.id), text.accepted)
                      }
                    >
                      {text.accept}
                    </Button>
                    <p className="text-muted-foreground text-sm">{text.acceptHint}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">{text.acceptOnlyDismiss}</p>
                )}
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
                    {text.dismiss}
                  </Button>
                </form>
              </div>
            ) : (
              <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
                {text.noPermission}
              </p>
            ))}
        </div>
      )}
    </>
  );
}

/** Einstellungen › Hinweise: Schwellwerte, nur Admins (FS-01). */
export function HintSettingsPage() {
  const t = useT();
  const text = t.hints;
  const accessToken = useAccessToken();
  const canEdit = useCan('hinweise.einstellen');
  const queryClient = useQueryClient();
  const options = hintSettingsQueryOptions(accessToken);
  const query = useQuery({ ...options, enabled: accessToken !== '' });
  const [draft, setDraft] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const value = draft ?? query.data?.maxFocusPerSro ?? 8;

  return (
    <>
      <PagePath
        trail={[
          { label: t.profile.title, href: '/profil' },
          { label: t.settings.title, href: '/einstellungen' },
        ]}
        current={text.settingsTitle}
      />
      <PageHeader title={text.settingsTitle} purpose={text.settingsPurpose} />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : !canEdit ? (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {t.settings.adminOnly}
        </p>
      ) : (
        <form
          className="flex max-w-xl flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaved(false);
            setFailed(false);
            try {
              queryClient.setQueryData(
                options.queryKey,
                await saveHintSettings(accessToken, { maxFocusPerSro: value }),
              );
              setDraft(null);
              setSaved(true);
            } catch {
              setFailed(true);
            }
          }}
        >
          {saved && <StatusLine message={text.saved} />}
          {failed && <StatusLine message={text.failedSave} tone="warning" />}
          <FormField label={text.maxFocus} hint={text.maxFocusHint}>
            {(field) => (
              <Input
                {...field}
                type="number"
                min={1}
                max={200}
                value={value}
                onChange={(event) => setDraft(Number(event.target.value))}
              />
            )}
          </FormField>
          <Button type="submit" className="self-start">
            {text.save}
          </Button>
        </form>
      )}
    </>
  );
}
