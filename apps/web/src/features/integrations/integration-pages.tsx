import {
  type ApiKeys,
  type ApiObjectType,
  apiObjectTypes,
  type Integrations,
  type MyConnections,
  type SsoOverview,
  type SsoProvider,
  supportedApiObjectTypes,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { CheckboxGroup, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Monogram } from '@/components/ui/monogram';
import { NextStep } from '@/components/ui/next-step';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-group';
import { StatusLine } from '@/components/ui/status-line';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/features/shell/page-header';
import { routerLink } from '@/features/shell/navigation';
import { PagePath } from '@/features/shell/page-path';
import {
  ApiError,
  apiKeysQueryOptions,
  connectIntegration,
  createApiKey,
  connectMine,
  disconnectMine,
  integrationAction,
  integrationsQueryOptions,
  myConnectionsQueryOptions,
  revokeApiKey,
  saveIntegrationParts,
  saveSso,
  ssoQueryOptions,
  verifySsoDomain,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';

type Connector = Integrations['connectors'][number];
type ConnectionView = NonNullable<Connector['connection']>;
type Messages = ReturnType<typeof useT>;

function useAccessToken() {
  const auth = useAuth();
  return auth.user?.access_token ?? '';
}

const errorCode = (failure: unknown) =>
  failure instanceof ApiError ? (failure.body as { code?: string } | null)?.code : undefined;

const nameOf = (t: Messages, key: string) => t.integrations.names[key] ?? key;

/** Stand als Text im Chip; ausgegraut, solange eine Anbindung erst in Stufe 2 kommt */
function StatusBadge({ connector }: { connector: Connector }) {
  const text = useT().integrations;
  const status = connector.stage === 2 ? 'later' : (connector.connection?.status ?? 'none');
  const variant =
    status === 'active'
      ? 'success'
      : status === 'error'
        ? 'danger'
        : status === 'later'
          ? 'plain'
          : 'neutral';
  return <Badge variant={variant}>{text.statuses[status]}</Badge>;
}

/**
 * IN-01 Einstellungen › Anbindungen (nach E-Anbindungen.dc.html): Tinte-Karte mit dem wichtigsten
 * offenen Punkt, Abschnitte Arbeitsplatz und Daten aus dem Einkauf, je Anbindung Kreis, Name, Stand,
 * eine Zeile und die aktiven Teile; Verwalten klappt in der Zeile auf. Rechts die letzten
 * Ereignisse. Den Abschnitt Transkripte rechts bringt IN-05.
 */
export function IntegrationsPage() {
  const t = useT();
  const text = t.integrations;
  const accessToken = useAccessToken();
  const client = useQueryClient();
  const query = useQuery({
    ...integrationsQueryOptions(accessToken),
    enabled: accessToken !== '',
    // Solange ein Abgleich läuft, den Stand nachladen
    refetchInterval: (current) =>
      current.state.data?.connectors.some((entry) =>
        ['queued', 'running'].includes(entry.connection?.lastJob?.status ?? ''),
      )
        ? 1500
        : false,
  });
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'warning' } | null>(
    null,
  );

  const run = async (key: string, work: () => Promise<Integrations>, done?: string) => {
    setBusy(key);
    setMessage(null);
    try {
      client.setQueryData(integrationsQueryOptions(accessToken).queryKey, await work());
      if (done) setMessage({ text: done, tone: 'success' });
    } catch (failure) {
      const code = errorCode(failure);
      setMessage({ text: (code && text.errors[code]) || text.failed, tone: 'warning' });
    } finally {
      setBusy(null);
    }
  };

  const data = query.data;
  const workplace = data?.connectors.filter((entry) => entry.group === 'workplace') ?? [];
  const purchasing = data?.connectors.filter((entry) => entry.group === 'purchasing') ?? [];
  const issue = data?.issue ?? null;
  const broken =
    issue?.kind === 'error'
      ? data?.connectors.find((entry) => entry.key === issue.connectorKey)
      : undefined;
  const anyConnected = data?.connectors.some((entry) => entry.connection) ?? false;

  const reconnect = (connector: Connector) =>
    run(connector.key, async () => {
      if (connector.connection) {
        await integrationAction(accessToken, connector.connection.id, 'trennen');
      }
      return connectIntegration(accessToken, connector.key);
    });

  const section = (id: string, title: string, entries: Connector[]) => (
    <section
      aria-labelledby={id}
      className="flex flex-col rounded-lg bg-card px-6 pt-5 pb-2 shadow-card"
    >
      <h2 id={id} className="pb-1 font-display font-semibold text-section tracking-section">
        {title}
      </h2>
      <ul className="flex flex-col">
        {entries.map((connector) => (
          <ConnectorRow
            key={connector.key}
            connector={connector}
            open={open === connector.key}
            busy={busy === connector.key}
            onToggle={() => setOpen(open === connector.key ? null : connector.key)}
            onConnect={() =>
              void run(connector.key, () => connectIntegration(accessToken, connector.key))
            }
            onSync={(id) =>
              void run(connector.key, () => integrationAction(accessToken, id, 'abgleichen'))
            }
            onParts={(id, parts) =>
              void run(
                connector.key,
                () => saveIntegrationParts(accessToken, id, parts),
                text.saved,
              )
            }
            onDisconnect={(id) => {
              setOpen(null);
              void run(connector.key, () => integrationAction(accessToken, id, 'trennen'));
            }}
          />
        ))}
      </ul>
    </section>
  );

  return (
    <>
      <PagePath
        trail={[
          { label: t.profile.title, href: '/profil' },
          { label: t.settings.title, href: '/einstellungen' },
        ]}
        current={text.navTitle}
      />
      <PageHeader title={text.title} purpose={text.purpose} />
      {query.isError ? (
        <ErrorState
          title={
            query.error instanceof ApiError && query.error.status === 403
              ? text.adminOnly
              : text.failed
          }
        />
      ) : !data ? (
        <LoadingState label={text.loading} />
      ) : (
        <>
          <NextStep
            eyebrow={text.next.eyebrow}
            title={
              broken
                ? text.next.error(nameOf(t, broken.key))
                : issue?.kind === 'failed_items'
                  ? text.next.failedItems(issue.count, nameOf(t, issue.connectorKey))
                  : anyConnected
                    ? text.next.fine
                    : text.next.none
            }
            text={
              broken
                ? text.next.errorText
                : issue?.kind === 'failed_items'
                  ? text.next.failedItemsText
                  : anyConnected
                    ? text.next.fineText
                    : text.next.noneText
            }
            {...(broken && {
              action: (
                <Button
                  variant="mint"
                  size="hero"
                  loading={busy === broken.key}
                  onClick={() => void reconnect(broken)}
                >
                  {text.next.reconnect}
                </Button>
              ),
            })}
          />
          {data.connectors.some((entry) => entry.provider === 'fake') && (
            <p className="text-muted-foreground text-sm">{text.fakeNotice}</p>
          )}
          {message && <StatusLine message={message.text} tone={message.tone} />}
          <div className="flex flex-wrap items-start gap-5">
            <div className="flex min-w-0 shrink grow-2 basis-120 flex-col gap-5">
              {section('anbindungen-arbeitsplatz', text.workplace, workplace)}
              {section('anbindungen-einkauf', text.purchasing, purchasing)}
            </div>
            <aside
              aria-labelledby="anbindungen-ereignisse"
              className="flex min-w-0 shrink grow basis-75 flex-col gap-3 rounded-lg bg-card p-6 shadow-card"
            >
              <h2
                id="anbindungen-ereignisse"
                className="font-display font-semibold text-section tracking-section"
              >
                {text.events.title}
              </h2>
              <EventList events={data.events} />
            </aside>
          </div>
        </>
      )}
    </>
  );
}

function ConnectorRow({
  connector,
  open,
  busy,
  onToggle,
  onConnect,
  onSync,
  onParts,
  onDisconnect,
}: {
  connector: Connector;
  open: boolean;
  busy: boolean;
  onToggle: () => void;
  onConnect: () => void;
  onSync: (id: string) => void;
  onParts: (id: string, parts: string[]) => void;
  onDisconnect: (id: string) => void;
}) {
  const t = useT();
  const text = t.integrations;
  const format = useFormat();
  const panelId = useId();
  const connection = connector.connection;
  const later = connector.stage === 2;
  const name = nameOf(t, connector.key);

  return (
    <li className="flex flex-col gap-4 border-line-soft border-t py-4 first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3">
        <Monogram
          name={name}
          label={text.short[connector.key] ?? undefined}
          tone={connection?.status === 'active' ? 'ink' : 'neutral'}
          className={later ? 'opacity-60' : undefined}
        />
        <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <strong className={later ? 'font-semibold text-muted-foreground' : 'font-semibold'}>
              {name}
            </strong>
            <StatusBadge connector={connector} />
          </span>
          <span className="text-muted-foreground text-sm">
            {connection
              ? `${text.connectedBy(connection.connectedByName, format.date(connection.connectedAt))} · ${text.descriptions[connector.key] ?? ''}`
              : text.descriptions[connector.key]}
          </span>
          {connection && connection.parts.length > 0 && (
            <span className="flex flex-wrap gap-1.5 pt-1">
              {connection.parts.map((part) => (
                <Badge key={part} variant="success">
                  <CheckIcon aria-hidden />
                  {text.parts[part] ?? part}
                </Badge>
              ))}
            </span>
          )}
        </div>
        {!later &&
          (connection ? (
            <Button
              variant="outline"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={onToggle}
            >
              {open ? text.closeManage : text.manage}
            </Button>
          ) : (
            <Button loading={busy} onClick={onConnect}>
              {text.connect}
            </Button>
          ))}
      </div>
      {connection && open && (
        <ManagePanel
          id={panelId}
          connector={connector}
          connection={connection}
          busy={busy}
          onSync={() => onSync(connection.id)}
          onParts={(parts) => onParts(connection.id, parts)}
          onDisconnect={() => onDisconnect(connection.id)}
        />
      )}
    </li>
  );
}

/** Verwalten: Teile an oder aus, Adresse für eingehende Daten, letzter Abgleich, Trennen */
function ManagePanel({
  id,
  connector,
  connection,
  busy,
  onSync,
  onParts,
  onDisconnect,
}: {
  id: string;
  connector: Connector;
  connection: ConnectionView;
  busy: boolean;
  onSync: () => void;
  onParts: (parts: string[]) => void;
  onDisconnect: () => void;
}) {
  const t = useT();
  const text = t.integrations;
  const format = useFormat();
  const job = connection.lastJob;
  const running = job?.status === 'queued' || job?.status === 'running';
  const [copied, setCopied] = useState(false);
  const hookUrl = connection.hookPath ? `${window.location.origin}${connection.hookPath}` : null;

  return (
    <div id={id} className="flex flex-col gap-4 rounded-lg bg-background p-4">
      <fieldset className="flex flex-col gap-3" disabled={busy}>
        <legend className="pb-2 font-semibold text-sm">{text.partsLabel}</legend>
        {connector.parts.map((part) => {
          const switchId = `${id}-${part}`;
          const on = connection.parts.includes(part);
          return (
            <div key={part} className="flex items-center gap-3">
              <Switch
                id={switchId}
                checked={on}
                onCheckedChange={(checked) =>
                  onParts(
                    checked
                      ? [...connection.parts, part]
                      : connection.parts.filter((entry) => entry !== part),
                  )
                }
              />
              <label htmlFor={switchId} className="text-base">
                {text.parts[part] ?? part}
              </label>
            </div>
          );
        })}
      </fieldset>
      {hookUrl && (
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-sm">{text.hookLabel}</span>
          <code className="break-all rounded-md bg-card px-3 py-2 text-sm">{hookUrl}</code>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => {
              void navigator.clipboard?.writeText(hookUrl).then(() => setCopied(true));
            }}
          >
            {text.copy}
          </Button>
          {copied && (
            <span role="status" className="text-sm">
              {text.copied}
            </span>
          )}
        </div>
      )}
      {connector.key === 'import_api' && <ApiKeysSection />}
      {connector.key === 'microsoft365' && <SsoSection provider="entra" />}
      {connector.key === 'google_workspace' && <SsoSection provider="google" />}
      <div className="flex flex-col gap-2">
        <span className="font-semibold text-sm">{text.lastJobTitle}</span>
        <span className="text-muted-foreground text-sm">
          {job
            ? text.lastJob(
                job.itemsOk,
                job.itemsFailed,
                job.finishedAt ? format.dateTime(job.finishedAt) : '',
              )
            : text.noJob}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          loading={busy || running}
          disabled={connection.status !== 'active'}
          onClick={onSync}
        >
          {running ? text.syncing : text.sync}
        </Button>
      </div>
      {/* Eigene Zeile, damit der Knopf nicht die ganze Breite füllt */}
      <div className="flex">
        <ConfirmButton
          question={text.disconnectQuestion}
          confirmLabel={text.disconnectConfirm}
          cancelLabel={text.cancel}
          onConfirm={onDisconnect}
        >
          {text.disconnect}
        </ConfirmButton>
      </div>
    </div>
  );
}

/**
 * IN-02: Anmeldung über das Firmenkonto (Microsoft Entra ID oder Google Workspace): Mandant bzw.
 * Domain, Domains mit DNS-Eintrag und „Domain bestätigen“, Standardrolle, „Nur noch über …“.
 */
function SsoSection({ provider }: { provider: SsoProvider }) {
  const t = useT();
  const text = t.integrations.sso;
  const accessToken = useAccessToken();
  const client = useQueryClient();
  const query = useQuery({ ...ssoQueryOptions(accessToken), enabled: accessToken !== '' });
  const current = query.data?.[provider] ?? null;
  const [form, setForm] = useState<{
    target: string;
    domains: string;
    defaultRole: 'admin' | 'member' | 'viewer';
    ssoOnly: boolean;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'warning' } | null>(
    null,
  );
  const values = form ?? {
    target: (provider === 'entra' ? current?.tenantId : current?.hostedDomain) ?? '',
    domains: current?.domains.map((entry) => entry.domain).join('\n') ?? '',
    defaultRole: current?.defaultRole ?? 'viewer',
    ssoOnly: current ? !current.passwordLoginAllowed : false,
  };
  const update = (change: Partial<typeof values>) => setForm({ ...values, ...change });
  const store = (value: SsoOverview) =>
    client.setQueryData(ssoQueryOptions(accessToken).queryKey, value);
  const fail = (failure: unknown) => {
    const code = errorCode(failure);
    setMessage({ text: (code && text.errors[code]) || t.integrations.failed, tone: 'warning' });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy('save');
    setMessage(null);
    try {
      store(
        await saveSso(accessToken, provider, {
          tenantId: provider === 'entra' ? values.target.trim() || null : null,
          hostedDomain: provider === 'google' ? values.target.trim() || null : null,
          domains: values.domains
            .split(/[\s,;]+/)
            .map((entry) => entry.trim().toLowerCase())
            .filter(Boolean),
          defaultRole: values.defaultRole,
          passwordLoginAllowed: !values.ssoOnly,
        }),
      );
      setForm(null);
      setMessage({ text: text.saved, tone: 'success' });
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(null);
    }
  };
  const verify = async (domain: string) => {
    setBusy(domain);
    setMessage(null);
    try {
      const result = await verifySsoDomain(accessToken, provider, domain);
      store(result);
      if (!result[provider]?.domains.find((entry) => entry.domain === domain)?.verifiedAt) {
        setMessage({ text: text.verifyFailed, tone: 'warning' });
      }
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(null);
    }
  };
  const ids = { target: `${provider}-sso-ziel`, only: `${provider}-sso-nur` };

  return (
    <section aria-labelledby={`${provider}-sso`} className="flex flex-col gap-3">
      <h3 id={`${provider}-sso`} className="flex flex-wrap items-center gap-2 font-semibold text-sm">
        {text.title}
        {current && (
          <Badge variant={current.status === 'active' ? 'success' : 'warning'}>
            {current.status === 'active' ? text.statusActive : text.statusDraft}
          </Badge>
        )}
      </h3>
      <p className="text-muted-foreground text-sm">
        {provider === 'entra' ? text.hintEntra : text.hintGoogle}
      </p>
      {query.isError ? (
        <ErrorState title={t.integrations.failed} />
      ) : !query.data ? (
        <LoadingState label={t.integrations.loading} />
      ) : (
        <>
          {current && current.domains.length > 0 && (
            <ul className="flex flex-col divide-y divide-line-soft rounded-md bg-card px-3">
              {current.domains.map((entry) => (
                <li key={entry.domain} className="flex flex-col gap-2 py-3">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="break-all text-sm">{entry.domain}</strong>
                    <Badge variant={entry.verifiedAt ? 'success' : 'neutral'}>
                      {entry.verifiedAt ? text.verified : text.unverified}
                    </Badge>
                  </span>
                  {!entry.verifiedAt && (
                    <>
                      <code className="break-all text-muted-foreground text-sm">
                        {text.record(entry.recordName, entry.recordValue)}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        className="self-start"
                        loading={busy === entry.domain}
                        onClick={() => void verify(entry.domain)}
                      >
                        {text.verify}
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {message && <StatusLine message={message.text} tone={message.tone} />}
          <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
            <FormField label={provider === 'entra' ? text.tenantLabel : text.hostedDomainLabel}>
              {(field) => (
                <Input
                  {...field}
                  value={values.target}
                  maxLength={253}
                  onChange={(event) => update({ target: event.target.value })}
                />
              )}
            </FormField>
            <FormField label={text.domainsLabel} hint={text.domainsHint}>
              {(field) => (
                <Textarea
                  {...field}
                  rows={2}
                  value={values.domains}
                  onChange={(event) => update({ domains: event.target.value })}
                />
              )}
            </FormField>
            <FormField label={text.roleLabel}>
              {(field) => (
                <NativeSelect
                  {...field}
                  value={values.defaultRole}
                  onChange={(event) =>
                    update({ defaultRole: event.target.value as typeof values.defaultRole })
                  }
                >
                  {(['viewer', 'member', 'admin'] as const).map((role) => (
                    <option key={role} value={role}>
                      {t.roles[role]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <div className="flex items-start gap-3">
              <Switch
                id={ids.only}
                checked={values.ssoOnly}
                onCheckedChange={(checked) => update({ ssoOnly: checked })}
                aria-describedby={`${ids.only}-hinweis`}
              />
              <span className="flex flex-col gap-1">
                <label htmlFor={ids.only} className="text-base">
                  {provider === 'entra' ? text.passwordOnlyEntra : text.passwordOnlyGoogle}
                </label>
                <span id={`${ids.only}-hinweis`} className="text-muted-foreground text-sm">
                  {text.passwordOnlyHint}
                </span>
              </span>
            </div>
            <Button
              type="submit"
              variant="outline"
              className="self-start"
              loading={busy === 'save'}
              disabled={!values.target.trim() || !values.domains.trim()}
            >
              {text.save}
            </Button>
          </form>
        </>
      )}
    </section>
  );
}

/**
 * IN-07: Schlüssel der Import-API. Erzeugen mit Name und Objektarten, der Schlüssel steht einmal im
 * Klartext; Liste mit letzter Nutzung und Widerrufen; letzte Lieferung mit Link in den Import.
 */
function ApiKeysSection() {
  const t = useT();
  const text = t.integrations.apiKeys;
  const format = useFormat();
  const accessToken = useAccessToken();
  const client = useQueryClient();
  const query = useQuery({ ...apiKeysQueryOptions(accessToken), enabled: accessToken !== '' });
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiObjectType[]>([...supportedApiObjectTypes]);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const store = (value: ApiKeys) =>
    client.setQueryData(apiKeysQueryOptions(accessToken).queryKey, value);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    try {
      const created = await createApiKey(accessToken, { name, scopes });
      store(created);
      setSecret(created.secret);
      setCopied(false);
      setName('');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  const supported = supportedApiObjectTypes as readonly string[];
  const last = query.data?.lastDelivery ?? null;

  return (
    <section aria-labelledby="api-schluessel" className="flex flex-col gap-3">
      <h3 id="api-schluessel" className="font-semibold text-sm">
        {text.title}
      </h3>
      <p className="text-muted-foreground text-sm">{text.hint}</p>
      <a href="/api/v1/openapi.json" className="self-start font-semibold text-sm">
        {text.docs}
      </a>
      {last && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span>
            {text.lastDelivery(format.dateTime(last.createdAt), last.rowsTotal, last.rowsError)}
          </span>
          {routerLink({
            href: `/einstellungen/daten/import/${last.batchId}`,
            className: 'font-semibold',
            children: text.openDelivery,
          })}
        </p>
      )}
      {secret && (
        <div role="status" className="flex flex-col gap-2 rounded-md bg-card p-3">
          <strong className="text-sm">{text.secretTitle}</strong>
          <code className="break-all text-sm">{secret}</code>
          <span className="text-muted-foreground text-sm">{text.secretHint}</span>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => {
              void navigator.clipboard?.writeText(secret).then(() => setCopied(true));
            }}
          >
            {text.copy}
          </Button>
          {copied && <span className="text-sm">{text.copied}</span>}
        </div>
      )}
      {query.isError ? (
        <ErrorState title={t.integrations.failed} />
      ) : !query.data ? (
        <LoadingState label={t.integrations.loading} />
      ) : query.data.keys.length === 0 ? (
        <p className="text-muted-foreground text-sm">{text.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft rounded-md bg-card px-3">
          {query.data.keys.map((key) => (
            <li key={key.id} className="flex flex-col gap-2 py-3">
              <span className="flex flex-wrap items-center gap-2">
                <strong className="text-sm">{key.name}</strong>
                <code className="text-muted-foreground text-sm">{`${key.prefix}…`}</code>
                {key.revokedAt && <Badge variant="plain">{text.revoked}</Badge>}
              </span>
              <span className="flex flex-wrap gap-1.5">
                {key.scopes.map((scope) => (
                  <Badge key={scope} variant="neutral">
                    {text.types[scope] ?? scope}
                  </Badge>
                ))}
              </span>
              <span className="text-muted-foreground text-sm">
                {key.lastUsedAt ? text.lastUsed(format.dateTime(key.lastUsedAt)) : text.neverUsed}
              </span>
              {!key.revokedAt && (
                <div className="flex">
                  <ConfirmButton
                    question={text.revokeQuestion}
                    confirmLabel={text.revokeConfirm}
                    cancelLabel={t.integrations.cancel}
                    onConfirm={() => {
                      void revokeApiKey(accessToken, key.id).then(store, () => setFailed(true));
                    }}
                  >
                    {text.revoke}
                  </ConfirmButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
        <FormField label={text.nameLabel}>
          {(field) => (
            <Input
              {...field}
              value={name}
              maxLength={80}
              placeholder={text.namePlaceholder}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </FormField>
        <CheckboxGroup<ApiObjectType>
          legend={text.scopesLabel}
          value={scopes}
          onChange={setScopes}
          options={apiObjectTypes.map((type) => ({
            value: type,
            label: supported.includes(type)
              ? (text.types[type] ?? type)
              : `${text.types[type] ?? type} (${text.later})`,
          }))}
        />
        {failed && <StatusLine message={t.integrations.failed} tone="warning" />}
        <Button
          type="submit"
          variant="outline"
          className="self-start"
          loading={busy}
          disabled={name.trim() === '' || scopes.length === 0}
        >
          {text.create}
        </Button>
      </form>
    </section>
  );
}

/** Letzte Ereignisse: nur Titel und Zeit, der Grund klappt auf */
function EventList({ events }: { events: Integrations['events'] }) {
  const t = useT();
  const text = t.integrations;
  const format = useFormat();
  if (events.length === 0) {
    return <p className="text-muted-foreground text-sm">{text.events.empty}</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-line-soft text-sm">
      {events.map((event) => {
        const name = nameOf(t, event.connectorKey);
        const kind = text.events.kinds[event.kind] ?? event.kind;
        const title =
          event.status === 'applied' &&
          ['connect', 'disconnect', 'token_refresh'].includes(event.kind)
            ? `${name} ${kind}`
            : `${name}: ${kind} ${text.events.statuses[event.status] ?? event.status}`;
        const time = (
          <span className="shrink-0 text-muted-foreground">{format.dateTime(event.createdAt)}</span>
        );
        return (
          <li key={event.id} className="py-2.5">
            {event.reason ? (
              <details>
                <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-2">
                  <span>{title}</span>
                  {time}
                </summary>
                <p className="pt-1 text-muted-foreground">
                  {text.reasons[event.reason] ?? event.reason}
                </p>
              </details>
            ) : (
              <span className="flex min-h-11 flex-wrap items-center justify-between gap-2">
                <span>{title}</span>
                {time}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * IN-01 Profil › Meine Verbindungen: Kalender und Outlook-Add-in verbindet jede Person beim Käufer
 * für sich; hier stehen Stand und Trennen. Beim Lieferanten erscheint der Abschnitt nicht.
 */
export function MyConnectionsSection() {
  const t = useT();
  const text = t.integrations;
  const accessToken = useAccessToken();
  const client = useQueryClient();
  const query = useQuery({
    ...myConnectionsQueryOptions(accessToken),
    enabled: accessToken !== '',
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const run = async (key: string, work: () => Promise<MyConnections>) => {
    setBusy(key);
    setFailed(null);
    try {
      client.setQueryData(myConnectionsQueryOptions(accessToken).queryKey, await work());
    } catch (failure) {
      const code = errorCode(failure);
      setFailed((code && text.errors[code]) || text.failed);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div id="verbindungen" className="scroll-mt-24">
      <SettingsGroup title={text.mine.title}>
        <p className="px-4 py-3 text-muted-foreground text-sm">{text.mine.hint}</p>
        {failed && (
          <div className="px-4 py-3">
            <StatusLine message={failed} tone="warning" />
          </div>
        )}
        {query.isError ? (
          <ErrorState title={text.failed} />
        ) : !query.data ? (
          <LoadingState label={text.mine.loading} />
        ) : (
          query.data.available.map((key) => {
            const own = query.data.connections.find((entry) => entry.connectorKey === key);
            const status = own?.connection.status ?? 'none';
            return (
              <SettingsRow
                key={key}
                label={nameOf(t, key)}
                description={text.descriptions[key] ?? ''}
              >
                <span className="flex flex-wrap items-center gap-3 sm:justify-end">
                  <Badge
                    variant={
                      status === 'active' ? 'success' : status === 'error' ? 'danger' : 'neutral'
                    }
                  >
                    {text.statuses[status]}
                  </Badge>
                  {own ? (
                    <ConfirmButton
                      question={text.disconnectQuestion}
                      confirmLabel={text.disconnectConfirm}
                      cancelLabel={text.cancel}
                      onConfirm={() =>
                        void run(key, () => disconnectMine(accessToken, own.connection.id))
                      }
                    >
                      {text.disconnect}
                    </ConfirmButton>
                  ) : (
                    <Button
                      variant="outline"
                      loading={busy === key}
                      onClick={() => void run(key, () => connectMine(accessToken, key))}
                    >
                      {text.connect}
                    </Button>
                  )}
                </span>
              </SettingsRow>
            );
          })
        )}
      </SettingsGroup>
    </div>
  );
}
