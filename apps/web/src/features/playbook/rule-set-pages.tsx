import {
  type CustomRuleSetItem,
  formatCadences,
  type ProposalItem,
  type RuleSet,
  type RuleSetItem,
  ruleGroups,
  type SaveRuleSet,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ScaleIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { VisibilityBadge } from '@/components/ui/visibility-badge';
import { PageHeader } from '@/features/shell/page-header';
import { useGoBack } from '@/features/shell/page-path';
import { SupplierFrame } from '@/features/suppliers/supplier-frame';
import {
  ApiError,
  adoptRuleSetProposal,
  approveRuleSet,
  ruleSetProposalQueryOptions,
  ruleSetQueryOptions,
  ruleSetSharePreviewQueryOptions,
  saveRuleSet,
  shareRuleSet,
} from '@/lib/api';
import { flash, useFlash } from '@/lib/flash';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useLocalized } from './use-playbook';

const rulesPath = (id: string) => `/lieferanten/${id}/beziehung/spielregeln`;

function useToken() {
  const auth = useAuth();
  return auth.user?.access_token ?? '';
}

function useRuleSet(relationshipId: string) {
  const accessToken = useToken();
  const query = useQuery({
    ...ruleSetQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  return { ...query, accessToken };
}

function useRefreshRuleSet(relationshipId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: ['suppliers', relationshipId, 'rule-set'] });
}

export type ListedItem = Pick<
  RuleSetItem,
  'kind' | 'group' | 'title' | 'description' | 'cadence'
> & {
  key: string;
  custom?: boolean;
  reason?: string | null;
};

/** Rechte und Pflichten je Gruppe nebeneinander, darunter die Formate mit Takt. */
export function ItemsView({ items }: { items: ListedItem[] }) {
  const text = useT().ruleSets;
  const catalog = useT().playbook;
  const localized = useLocalized();
  const entry = (item: ListedItem) => (
    <li key={item.key} className="flex flex-col gap-0.5">
      <span className="flex flex-wrap items-center gap-2 font-medium">
        {localized(item.title)}
        {item.custom && <Badge>{text.custom}</Badge>}
      </span>
      {localized(item.description) && (
        <span className="text-muted-foreground text-sm">{localized(item.description)}</span>
      )}
      {item.reason && (
        <span className="text-muted-foreground text-sm">{text.reason(item.reason)}</span>
      )}
    </li>
  );
  const groups = ruleGroups.filter((group) => items.some((item) => item.group === group));
  const formats = items.filter((item) => item.kind === 'format');
  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group} aria-labelledby={`sr-${group}`} className="flex flex-col gap-3">
          <h2 id={`sr-${group}`} className="font-semibold text-lg">
            {catalog.groups[group]}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {(['right', 'obligation'] as const).map((kind) => {
              const list = items.filter((item) => item.group === group && item.kind === kind);
              return (
                <div key={kind} className="flex flex-col gap-2">
                  <h3 className="text-muted-foreground text-sm">
                    {kind === 'right' ? text.rights : text.obligations}
                  </h3>
                  {list.length === 0 ? (
                    <p className="text-muted-foreground">{text.none}</p>
                  ) : (
                    <ul className="flex flex-col gap-3">{list.map(entry)}</ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {formats.length > 0 && (
        <section aria-labelledby="sr-formate" className="flex flex-col gap-3">
          <h2 id="sr-formate" className="font-semibold text-lg">
            {text.formats}
          </h2>
          <ul className="flex flex-col gap-3">
            {formats.map((item) =>
              entry({
                ...item,
                description: {
                  de: [item.cadence && catalog.cadences[item.cadence], item.description.de]
                    .filter(Boolean)
                    .join(' · '),
                  en: [item.cadence && catalog.cadences[item.cadence], item.description.en]
                    .filter(Boolean)
                    .join(' · '),
                },
              }),
            )}
          </ul>
        </section>
      )}
    </div>
  );
}

const fromSet = (set: RuleSet): ListedItem[] =>
  set.items.map((item) => ({
    ...item,
    key: item.id,
    custom: item.origin === 'custom',
    reason: item.reason,
  }));

/** Lieferant › Beziehung › Spielregeln (PLB-03): die aktuelle Version mit Kennzeichen. */
export function RuleSetPage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  return (
    <SupplierFrame relationshipId={relationshipId} area="relationship" current={t.ruleSets.title}>
      {() => <RuleSetContent relationshipId={relationshipId} />}
    </SupplierFrame>
  );
}

function RuleSetContent({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = t.ruleSets;
  const format = useFormat();
  const localized = useLocalized();
  const query = useRuleSet(relationshipId);
  const refresh = useRefreshRuleSet(relationshipId);
  const [message, hideMessage] = useFlash();
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const header = (badge?: 'internal' | 'shared') => (
    <PageHeader
      title={text.title}
      purpose={text.purpose}
      badge={
        badge && (
          <VisibilityBadge
            visibility={badge}
            label={badge === 'internal' ? text.internal : text.shared}
          />
        )
      }
    />
  );

  if (query.isError) {
    return (
      <>
        {header()}
        <ErrorState title={text.failed} />
      </>
    );
  }
  if (!query.data) {
    return (
      <>
        {header()}
        <LoadingState label={text.loading} />
      </>
    );
  }
  const { current, target, targetChanged, canManage, shared } = query.data;

  const run = async (work: () => Promise<unknown>, done: string, failed: string) => {
    setBusy(true);
    setFailure(null);
    try {
      await work();
      await refresh();
      flash.set(done);
      hideMessage();
    } catch {
      setFailure(failed);
    } finally {
      setBusy(false);
    }
  };

  if (!current) {
    return (
      <>
        {header()}
        {failure && <StatusLine message={failure} tone="warning" />}
        {target ? (
          <EmptyState
            size="lg"
            icon={<ScaleIcon aria-hidden />}
            title={text.emptyTitle}
            description={text.emptyText(target.typeName)}
            action={
              canManage ? (
                <Button
                  loading={busy}
                  onClick={() =>
                    void run(
                      () => adoptRuleSetProposal(query.accessToken, relationshipId),
                      text.saved,
                      text.adoptFailed,
                    )
                  }
                >
                  {text.adopt}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <EmptyState
            size="lg"
            icon={<ScaleIcon aria-hidden />}
            title={text.noTargetTitle}
            description={text.noTargetText}
            action={
              <Button asChild variant="outline">
                <Link to="/lieferanten/$id/strategie/segmentierung" params={{ id: relationshipId }}>
                  {text.toSegmentation}
                </Link>
              </Button>
            }
          />
        )}
      </>
    );
  }

  return (
    <>
      {header(current.visibility)}
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      {failure && <StatusLine message={failure} tone="warning" />}
      {targetChanged && (
        <p
          role="status"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-warning-soft px-4 py-3 text-warning-soft-foreground"
        >
          {text.targetChanged}
          <Link
            to="/lieferanten/$id/beziehung/spielregeln/vorschlag"
            params={{ id: relationshipId }}
            className="font-medium underline underline-offset-4"
          >
            {text.viewProposal}
          </Link>
        </p>
      )}
      <div className="flex flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {text.summary(current.target.typeName, current.version)}
          <Badge variant={current.status === 'draft' ? 'neutral' : 'success'}>
            {text.statuses[current.status]}
          </Badge>
        </p>
        {current.approvedBy && current.approvedAt && (
          <p className="text-muted-foreground text-sm">
            {text.approvedBy(current.approvedBy, format.date(current.approvedAt))}
          </p>
        )}
        {current.status !== 'draft' && canManage && (
          <p className="text-muted-foreground text-sm">{text.lockedHint}</p>
        )}
        {shared && shared.version === current.version && (
          <p className="text-muted-foreground text-sm">
            {text.sharedOn(format.date(shared.sharedAt))}
          </p>
        )}
      </div>
      {shared && shared.version !== current.version && (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {text.supplierSees(shared.version, format.date(shared.sharedAt))}
        </p>
      )}
      {canManage && (
        <div className="flex flex-wrap gap-3">
          {current.status === 'draft' && (
            <ConfirmButton
              variant="default"
              question={text.approveQuestion(current.version)}
              confirmLabel={text.approveYes}
              cancelLabel={text.approveCancel}
              onConfirm={() =>
                void run(
                  () => approveRuleSet(query.accessToken, relationshipId),
                  text.approved,
                  text.approveFailed,
                )
              }
            >
              {text.approve}
            </ConfirmButton>
          )}
          {current.status === 'approved' && (
            <Button asChild>
              <Link
                to="/lieferanten/$id/beziehung/spielregeln/teilen"
                params={{ id: relationshipId }}
              >
                {text.share}
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link
              to="/lieferanten/$id/beziehung/spielregeln/bearbeiten"
              params={{ id: relationshipId }}
            >
              {text.edit}
            </Link>
          </Button>
        </div>
      )}
      <ItemsView items={fromSet(current)} />
      {current.removed.length > 0 && (
        <section aria-labelledby="sr-abgewaehlt" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="sr-abgewaehlt" className="font-semibold text-lg">
              {text.removedTitle}
            </h2>
            <p className="text-muted-foreground">{text.removedHint}</p>
          </div>
          <ul className="flex flex-col gap-3">
            {current.removed.map((entry) => (
              <li key={entry.item.catalogItemId} className="flex flex-col gap-0.5">
                <span className="font-medium text-muted-foreground line-through">
                  {localized(entry.item.title)}
                </span>
                <span className="text-muted-foreground text-sm">{text.reason(entry.reason)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Neuer Vorschlag aus dem Katalog; wird erst auf Klick zum Entwurf. */
export function RuleSetProposalPage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = t.ruleSets;
  return (
    <SupplierFrame
      relationshipId={relationshipId}
      area="relationship"
      trail={() => [{ label: text.title, href: rulesPath(relationshipId) }]}
      current={text.proposalTitle}
    >
      {() => <ProposalContent relationshipId={relationshipId} />}
    </SupplierFrame>
  );
}

function ProposalContent({ relationshipId }: { relationshipId: string }) {
  const text = useT().ruleSets;
  const accessToken = useToken();
  const state = useRuleSet(relationshipId);
  const navigate = useNavigate();
  const refresh = useRefreshRuleSet(relationshipId);
  const query = useQuery({
    ...ruleSetProposalQueryOptions(accessToken, relationshipId, 'soll'),
    enabled: accessToken !== '',
  });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (query.isError) {
    return (
      <>
        <PageHeader title={text.proposalTitle} />
        <ErrorState title={text.failed} />
      </>
    );
  }
  if (!query.data) {
    return (
      <>
        <PageHeader title={text.proposalTitle} />
        <LoadingState label={text.loading} />
      </>
    );
  }
  const adopt = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await adoptRuleSetProposal(accessToken, relationshipId);
      await refresh();
      flash.set(text.saved);
      await navigate({
        to: '/lieferanten/$id/beziehung/spielregeln',
        params: { id: relationshipId },
      });
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        title={text.proposalTitle}
        purpose={text.proposalPurpose(query.data.target.typeName)}
      />
      {failed && <StatusLine message={text.adoptFailed} tone="warning" />}
      {state.data?.canManage && (state.data.targetChanged || !state.data.current) && (
        <div>
          <Button loading={busy} onClick={() => void adopt()}>
            {text.adoptDraft}
          </Button>
        </div>
      )}
      <ItemsView items={query.data.items.map((item) => ({ ...item, key: item.catalogItemId }))} />
    </>
  );
}

/** Bearbeiten: Einträge abwählen (mit Begründung) oder eigene ergänzen. */
export function RuleSetEditPage({ relationshipId }: { relationshipId: string }) {
  const text = useT().ruleSets;
  return (
    <SupplierFrame
      relationshipId={relationshipId}
      area="relationship"
      trail={() => [{ label: text.title, href: rulesPath(relationshipId) }]}
      current={text.editTitle}
      header={<PageHeader title={text.editTitle} purpose={text.editPurpose} />}
    >
      {() => <EditContent relationshipId={relationshipId} />}
    </SupplierFrame>
  );
}

function EditContent({ relationshipId }: { relationshipId: string }) {
  const text = useT().ruleSets;
  const accessToken = useToken();
  const state = useRuleSet(relationshipId);
  const proposal = useQuery({
    ...ruleSetProposalQueryOptions(accessToken, relationshipId, 'aktuell'),
    enabled: accessToken !== '' && Boolean(state.data?.current),
  });
  if (state.isError || proposal.isError) return <ErrorState title={text.failed} />;
  if (!state.data) return <LoadingState label={text.loading} />;
  if (!state.data.canManage) {
    return (
      <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
        {text.noPermission}
      </p>
    );
  }
  if (!state.data.current) {
    return <EmptyState size="lg" title={text.emptyTitle} description={text.noTargetText} />;
  }
  if (!proposal.data) return <LoadingState label={text.loading} />;
  return (
    <EditForm
      relationshipId={relationshipId}
      current={state.data.current}
      proposal={proposal.data.items}
      accessToken={accessToken}
    />
  );
}

type DraftCustom = CustomRuleSetItem & { key: string };

const emptyCustom = (): DraftCustom => ({
  key: crypto.randomUUID(),
  kind: 'right',
  group: 'cost',
  title: '',
  description: '',
  cadence: null,
  reason: '',
});

function EditForm({
  relationshipId,
  current,
  proposal,
  accessToken,
}: {
  relationshipId: string;
  current: RuleSet;
  proposal: ProposalItem[];
  accessToken: string;
}) {
  const t = useT();
  const text = t.ruleSets;
  const catalog = t.playbook;
  const localized = useLocalized();
  const refresh = useRefreshRuleSet(relationshipId);
  const goBack = useGoBack(rulesPath(relationshipId));
  const chosen = new Set(
    current.items.flatMap((item) => (item.catalogItemId ? [item.catalogItemId] : [])),
  );
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        proposal.filter((item) => chosen.has(item.catalogItemId)).map((item) => item.catalogItemId),
      ),
  );
  const [reasons, setReasons] = useState<Record<string, string>>(() =>
    Object.fromEntries(current.removed.map((entry) => [entry.item.catalogItemId, entry.reason])),
  );
  const [custom, setCustom] = useState<DraftCustom[]>(() =>
    current.items
      .filter((item) => item.origin === 'custom')
      .map((item) => ({
        key: item.id,
        kind: item.kind,
        group: item.group,
        title: item.title.de,
        description: item.description.de,
        cadence: item.cadence,
        reason: item.reason ?? '',
      })),
  );
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  };
  const updateCustom = (key: string, patch: Partial<DraftCustom>) =>
    setCustom(custom.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailed(false);
    const missing = new Set<string>();
    for (const item of proposal) {
      if (
        !selected.has(item.catalogItemId) &&
        (reasons[item.catalogItemId] ?? '').trim().length < 3
      ) {
        missing.add(item.catalogItemId);
      }
    }
    for (const item of custom) {
      if (item.reason.trim().length < 3) missing.add(`${item.key}:reason`);
      if (item.title.trim() === '') missing.add(`${item.key}:title`);
    }
    setErrors(missing);
    if (missing.size > 0) return;
    const request: SaveRuleSet = {
      selected: [...selected],
      removedReasons: Object.fromEntries(
        proposal
          .filter((item) => !selected.has(item.catalogItemId))
          .map((item) => [item.catalogItemId, (reasons[item.catalogItemId] ?? '').trim()]),
      ),
      custom: custom.map(({ key: _key, ...item }) => ({
        ...item,
        group: item.kind === 'format' ? null : (item.group ?? 'cost'),
        cadence: item.kind === 'format' ? (item.cadence ?? 'annual') : null,
      })),
    };
    setSaving(true);
    try {
      await saveRuleSet(accessToken, relationshipId, request);
      await refresh();
      flash.set(text.saved);
      goBack();
    } catch (error) {
      const body = error instanceof ApiError ? (error.body as { items?: string[] }) : undefined;
      if (body?.items) setErrors(new Set(body.items));
      setFailed(true);
      setSaving(false);
    }
  };

  const groupsOf = (kind: 'right' | 'obligation' | 'format') =>
    proposal.filter((item) => item.kind === kind);

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex max-w-3xl flex-col gap-8"
    >
      {current.status !== 'draft' && (
        <StatusLine message={text.editNewVersion(current.version + 1)} tone="warning" />
      )}
      {(['right', 'obligation', 'format'] as const).map((kind) => (
        <fieldset key={kind} className="flex flex-col gap-4">
          <legend className="mb-2 font-semibold text-lg">
            {kind === 'right'
              ? text.rights
              : kind === 'obligation'
                ? text.obligations
                : text.formats}
          </legend>
          {groupsOf(kind).map((item) => {
            const id = item.catalogItemId;
            const checked = selected.has(id);
            const label = localized(item.title);
            return (
              <div key={id} className="flex flex-col gap-2">
                <div className="flex min-h-11 items-start gap-3">
                  <Checkbox
                    id={`sr-${id}`}
                    checked={checked}
                    onCheckedChange={(next) => toggle(id, next === true)}
                    className="mt-1"
                  />
                  <label htmlFor={`sr-${id}`} className="flex flex-col">
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground text-sm">
                      {item.group
                        ? catalog.groups[item.group]
                        : item.cadence && catalog.cadences[item.cadence]}
                    </span>
                  </label>
                </div>
                {!checked && (
                  <div className="pl-8">
                    <FormField
                      label={`${text.reasonLabel}: ${label}`}
                      error={errors.has(id) ? text.reasonRequired : undefined}
                    >
                      {(field) => (
                        <Textarea
                          {...field}
                          rows={2}
                          maxLength={1000}
                          value={reasons[id] ?? ''}
                          onChange={(event) => setReasons({ ...reasons, [id]: event.target.value })}
                        />
                      )}
                    </FormField>
                  </div>
                )}
              </div>
            );
          })}
        </fieldset>
      ))}
      <section aria-labelledby="sr-eigene" className="flex flex-col gap-4">
        <h2 id="sr-eigene" className="font-semibold text-lg">
          {text.custom}
        </h2>
        {custom.map((item) => (
          <div key={item.key} className="flex flex-col gap-4 rounded-lg bg-secondary p-4">
            <FormField label={text.customKind}>
              {(field) => (
                <NativeSelect
                  {...field}
                  value={item.kind}
                  onChange={(event) => {
                    const kind = event.target.value as DraftCustom['kind'];
                    updateCustom(item.key, {
                      kind,
                      group: kind === 'format' ? null : (item.group ?? 'cost'),
                      cadence: kind === 'format' ? (item.cadence ?? 'annual') : null,
                    });
                  }}
                >
                  {(['right', 'obligation', 'format'] as const).map((kind) => (
                    <option key={kind} value={kind}>
                      {text.kinds[kind]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            {item.kind === 'format' ? (
              <FormField label={text.customCadence}>
                {(field) => (
                  <NativeSelect
                    {...field}
                    value={item.cadence ?? 'annual'}
                    onChange={(event) =>
                      updateCustom(item.key, {
                        cadence: event.target.value as DraftCustom['cadence'],
                      })
                    }
                  >
                    {formatCadences.map((cadence) => (
                      <option key={cadence} value={cadence}>
                        {catalog.cadences[cadence]}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            ) : (
              <FormField label={text.customGroup}>
                {(field) => (
                  <NativeSelect
                    {...field}
                    value={item.group ?? 'cost'}
                    onChange={(event) =>
                      updateCustom(item.key, { group: event.target.value as DraftCustom['group'] })
                    }
                  >
                    {ruleGroups.map((group) => (
                      <option key={group} value={group}>
                        {catalog.groups[group]}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            )}
            <FormField
              label={text.customTitle}
              error={errors.has(`${item.key}:title`) ? catalog.required : undefined}
            >
              {(field) => (
                <Input
                  {...field}
                  maxLength={200}
                  value={item.title}
                  onChange={(event) => updateCustom(item.key, { title: event.target.value })}
                />
              )}
            </FormField>
            <FormField label={text.customDescription}>
              {(field) => (
                <Textarea
                  {...field}
                  rows={2}
                  maxLength={1000}
                  value={item.description}
                  onChange={(event) => updateCustom(item.key, { description: event.target.value })}
                />
              )}
            </FormField>
            <FormField
              label={text.reasonLabel}
              error={errors.has(`${item.key}:reason`) ? text.reasonRequired : undefined}
            >
              {(field) => (
                <Textarea
                  {...field}
                  rows={2}
                  maxLength={1000}
                  value={item.reason}
                  onChange={(event) => updateCustom(item.key, { reason: event.target.value })}
                />
              )}
            </FormField>
            <div>
              <Button
                type="button"
                variant="ghost"
                aria-label={text.removeCustom(item.title || text.custom)}
                onClick={() => setCustom(custom.filter((entry) => entry.key !== item.key))}
              >
                {text.removeShort}
              </Button>
            </div>
          </div>
        ))}
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setCustom([...custom, emptyCustom()])}
          >
            {text.addCustom}
          </Button>
        </div>
      </section>
      {failed && (
        <p role="alert" className="text-destructive">
          {text.saveFailed}
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

/** Mit Lieferant teilen (SEG-10): Vorschau genau so, wie der Lieferant sie sieht, dann bestätigen. */
export function RuleSetSharePage({ relationshipId }: { relationshipId: string }) {
  const text = useT().ruleSets;
  return (
    <SupplierFrame
      relationshipId={relationshipId}
      area="relationship"
      trail={() => [{ label: text.title, href: rulesPath(relationshipId) }]}
      current={text.shareTitle}
      header={<PageHeader title={text.shareTitle} purpose={text.sharePurpose} />}
    >
      {() => <ShareContent relationshipId={relationshipId} />}
    </SupplierFrame>
  );
}

function ShareContent({ relationshipId }: { relationshipId: string }) {
  const text = useT().ruleSets;
  const accessToken = useToken();
  const navigate = useNavigate();
  const refresh = useRefreshRuleSet(relationshipId);
  const query = useQuery({
    ...ruleSetSharePreviewQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  const [failed, setFailed] = useState(false);
  if (query.isError) return <ErrorState title={text.failed} />;
  if (!query.data) return <LoadingState label={text.loading} />;
  const preview = query.data;
  const share = async () => {
    setFailed(false);
    try {
      await shareRuleSet(accessToken, relationshipId);
      await refresh();
      flash.set(text.sharedDone);
      await navigate({
        to: '/lieferanten/$id/beziehung/spielregeln',
        params: { id: relationshipId },
      });
    } catch {
      setFailed(true);
    }
  };
  return (
    <>
      {failed && <StatusLine message={text.shareFailed} tone="warning" />}
      <SharedView
        typeName={preview.typeName}
        typeDescription={preview.typeDescription}
        items={preview.items}
      />
      <ConfirmButton
        variant="default"
        question={text.shareQuestion(preview.version)}
        confirmLabel={text.shareYes}
        cancelLabel={text.shareCancel}
        onConfirm={() => void share()}
      >
        {text.share}
      </ConfirmButton>
    </>
  );
}

/** Was der Lieferant sieht: Typ mit Beschreibung, darunter die Spielregeln (SEG-10). */
export function SharedView({
  typeName,
  typeDescription,
  items,
}: {
  typeName: string;
  typeDescription: string;
  items: Omit<ListedItem, 'key'>[];
}) {
  const text = useT().ruleSets;
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="sr-typ" className="flex flex-col gap-1 rounded-lg bg-secondary p-5">
        <h2 id="sr-typ" className="text-muted-foreground text-sm">
          {text.typeHeading}
        </h2>
        <p className="font-semibold text-lg">{typeName}</p>
        {typeDescription && <p className="text-muted-foreground">{typeDescription}</p>}
      </section>
      <ItemsView items={items.map((item, index) => ({ ...item, key: `${index}` }))} />
    </div>
  );
}
