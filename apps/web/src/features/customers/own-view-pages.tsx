import type { AccountObjective, AccountPlan } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { VisibilityBadge } from '@/components/ui/visibility-badge';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import {
  accountPlanQueryOptions,
  saveAccountObjective,
  saveAccountSummary,
  saveAccountView,
} from '@/lib/api';
import { flash, useFlash } from '@/lib/flash';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { CustomerFrame } from './customer-frame';

// LIF-03: Eigene Sicht des Lieferanten auf einen Kunden, nur für die Lieferantenseite. Jede Seite
// trägt das Kennzeichen „Nur für Sie sichtbar“.

const ownPath = (relationshipId: string) => `/kunden/${relationshipId}/eigene-sicht`;

function OnlyYou() {
  const text = useT().ownView;
  return (
    <div className="flex flex-wrap items-center gap-3" data-slot="only-you">
      <VisibilityBadge visibility="internal" label={text.onlyYou} />
      <span className="text-muted-foreground text-sm">{text.onlyYouHint}</span>
    </div>
  );
}

function usePlan(relationshipId: string) {
  const accessToken = useToken();
  const query = useQuery({
    ...accountPlanQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  return { query, accessToken };
}

function Frame({
  relationshipId,
  title,
  purpose,
  sub,
  children,
}: {
  relationshipId: string;
  title: string;
  purpose: string;
  sub?: boolean;
  children: ReactNode;
}) {
  const text = useT().ownView;
  // Der Bereich „Eigene Sicht“ steht schon im Pfad; Unterseiten hängen nur ihren Titel an.
  return (
    <CustomerFrame relationshipId={relationshipId} area="own" current={sub ? title : text.title}>
      <PageHeader title={title} purpose={purpose} />
      <OnlyYou />
      {children}
    </CustomerFrame>
  );
}

function Section({
  id,
  title,
  edit,
  children,
}: {
  id: string;
  title: string;
  edit?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-lg bg-card shadow-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="font-display font-semibold text-xl tracking-title">
          {title}
        </h2>
        {edit}
      </div>
      {children}
    </section>
  );
}

export function OwnViewPage({ relationshipId }: { relationshipId: string }) {
  const text = useT().ownView;
  const format = useFormat();
  const [message, hideMessage] = useFlash();
  const { query } = usePlan(relationshipId);
  const base = ownPath(relationshipId);
  const data = query.data;
  const link = (href: string, label: string) =>
    routerLink({ href, className: buttonVariants({ variant: 'outline' }), children: label });
  return (
    <Frame relationshipId={relationshipId} title={text.title} purpose={text.purpose}>
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !data ? (
        <LoadingState label={text.loading} />
      ) : (
        <div className="flex max-w-4xl flex-col gap-6">
          {!data.canEdit && (
            <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
              {text.readOnly}
            </p>
          )}
          <Section
            id="eigene-zusammenfassung"
            title={text.summary}
            edit={data.canEdit && link(`${base}/zusammenfassung`, text.edit)}
          >
            <p className={data.plan?.summary ? 'whitespace-pre-line' : 'text-muted-foreground'}>
              {data.plan?.summary ?? text.summaryEmpty}
            </p>
          </Section>
          <Section
            id="eigene-sicht-kunde"
            title={text.view}
            edit={data.canEdit && link(`${base}/sicht`, text.edit)}
          >
            <p className={data.plan?.ownView ? 'whitespace-pre-line' : 'text-muted-foreground'}>
              {data.plan?.ownView ?? text.viewEmpty}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">{text.importance}: </span>
              {data.plan?.importance
                ? text.importanceValue(data.plan.importance)
                : text.importanceNone}
            </p>
          </Section>
          <Section
            id="eigene-ziele"
            title={text.objectives}
            edit={
              data.canEdit &&
              routerLink({
                href: `${base}/ziele/neu`,
                className: buttonVariants({ variant: 'outline' }),
                children: (
                  <>
                    <PlusIcon aria-hidden />
                    {text.addObjective}
                  </>
                ),
              })
            }
          >
            {data.objectives.length === 0 ? (
              <p className="text-muted-foreground">{text.objectivesEmpty}</p>
            ) : (
              <ul className="flex flex-col">
                {data.objectives.map((objective) => (
                  <li
                    key={objective.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-line-soft border-t py-3"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      {data.canEdit ? (
                        routerLink({
                          href: `${base}/ziele/${objective.id}`,
                          className: 'font-medium underline-offset-4 hover:underline',
                          children: objective.text,
                        })
                      ) : (
                        <span className="font-medium">{objective.text}</span>
                      )}
                      <span className="text-muted-foreground text-sm">
                        {text.yearLine(objective.targetYear, objective.ownerName)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          {data.plan && (
            <p className="text-muted-foreground text-sm">
              {text.updated(data.plan.updatedByName, format.dateTime(data.plan.updatedAt))}
            </p>
          )}
        </div>
      )}
    </Frame>
  );
}

function useSaved(relationshipId: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const text = useT().ownView;
  return async (next: AccountPlan) => {
    queryClient.setQueryData(['eigene-sicht', relationshipId], next);
    flash.set(text.saved);
    await navigate({ to: ownPath(relationshipId) });
  };
}

function Loader({
  relationshipId,
  children,
}: {
  relationshipId: string;
  children: (data: AccountPlan, accessToken: string) => ReactNode;
}) {
  const text = useT().ownView;
  const { query, accessToken } = usePlan(relationshipId);
  if (query.isError) return <ErrorState title={text.failed} />;
  if (!query.data) return <LoadingState label={text.loading} />;
  if (!query.data.canEdit) {
    return (
      <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
        {text.readOnly}
      </p>
    );
  }
  return <>{children(query.data, accessToken)}</>;
}

export function OwnSummaryPage({ relationshipId }: { relationshipId: string }) {
  const text = useT().ownView;
  return (
    <Frame relationshipId={relationshipId} title={text.editSummary} purpose={text.purpose} sub>
      <Loader relationshipId={relationshipId}>
        {(data, accessToken) => (
          <TextForm
            relationshipId={relationshipId}
            label={text.summary}
            initial={data.plan?.summary ?? ''}
            onSave={(value) =>
              saveAccountSummary(accessToken, relationshipId, { summary: value || null })
            }
          />
        )}
      </Loader>
    </Frame>
  );
}

function TextForm({
  relationshipId,
  label,
  initial,
  onSave,
  extra,
}: {
  relationshipId: string;
  label: string;
  initial: string;
  onSave: (value: string) => Promise<AccountPlan>;
  extra?: ReactNode;
}) {
  const text = useT().ownView;
  const navigate = useNavigate();
  const saved = useSaved(relationshipId);
  const [value, setValue] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFailed(false);
    try {
      await saved(await onSave(value.trim()));
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
      <FormField label={label}>
        {(field) => (
          <Textarea
            {...field}
            rows={6}
            maxLength={4000}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        )}
      </FormField>
      {extra}
      {failed && (
        <p role="alert" className="text-destructive">
          {text.saveFailed}
        </p>
      )}
      <FormActions>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void navigate({ to: ownPath(relationshipId) })}
        >
          {text.cancel}
        </Button>
        <Button type="submit" loading={saving}>
          {text.save}
        </Button>
      </FormActions>
    </form>
  );
}

export function OwnViewEditPage({ relationshipId }: { relationshipId: string }) {
  const text = useT().ownView;
  return (
    <Frame relationshipId={relationshipId} title={text.editView} purpose={text.purpose} sub>
      <Loader relationshipId={relationshipId}>
        {(data, accessToken) => (
          <ViewForm relationshipId={relationshipId} data={data} accessToken={accessToken} />
        )}
      </Loader>
    </Frame>
  );
}

function ViewForm({
  relationshipId,
  data,
  accessToken,
}: {
  relationshipId: string;
  data: AccountPlan;
  accessToken: string;
}) {
  const text = useT().ownView;
  const [importance, setImportance] = useState(String(data.plan?.importance ?? ''));
  return (
    <TextForm
      relationshipId={relationshipId}
      label={text.view}
      initial={data.plan?.ownView ?? ''}
      onSave={(value) =>
        saveAccountView(accessToken, relationshipId, {
          ownView: value || null,
          importance: importance ? Number(importance) : null,
        })
      }
      extra={
        <FormField label={text.importance}>
          {(field) => (
            <NativeSelect
              {...field}
              className="w-48"
              value={importance}
              onChange={(event) => setImportance(event.target.value)}
            >
              <option value="">{text.importanceNone}</option>
              {[1, 2, 3, 4, 5].map((step) => (
                <option key={step} value={step}>
                  {text.importanceValue(step)}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      }
    />
  );
}

export function OwnObjectivePage({
  relationshipId,
  objectiveId,
}: {
  relationshipId: string;
  objectiveId?: string;
}) {
  const text = useT().ownView;
  return (
    <Frame
      relationshipId={relationshipId}
      title={objectiveId ? text.editObjective : text.newObjective}
      purpose={text.purpose}
      sub
    >
      <Loader relationshipId={relationshipId}>
        {(data, accessToken) => {
          const existing = objectiveId
            ? data.objectives.find((entry) => entry.id === objectiveId)
            : undefined;
          if (objectiveId && !existing) return <ErrorState title={text.notFound} />;
          return (
            <ObjectiveForm
              relationshipId={relationshipId}
              data={data}
              existing={existing}
              accessToken={accessToken}
            />
          );
        }}
      </Loader>
    </Frame>
  );
}

function ObjectiveForm({
  relationshipId,
  data,
  existing,
  accessToken,
}: {
  relationshipId: string;
  data: AccountPlan;
  existing: AccountObjective | undefined;
  accessToken: string;
}) {
  const text = useT().ownView;
  const navigate = useNavigate();
  const saved = useSaved(relationshipId);
  const [value, setValue] = useState(existing?.text ?? '');
  const [owner, setOwner] = useState(existing?.ownerUserId ?? '');
  const [year, setYear] = useState(String(existing?.targetYear ?? new Date().getFullYear() + 1));
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) {
      setError(text.required);
      return;
    }
    setError(null);
    setSaving(true);
    setFailed(false);
    try {
      await saved(
        await saveAccountObjective(accessToken, relationshipId, existing?.id ?? null, {
          text: value.trim(),
          ownerUserId: owner || null,
          targetYear: Number(year),
        }),
      );
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!existing) return;
    try {
      await saved(await saveAccountObjective(accessToken, relationshipId, existing.id, null));
    } catch {
      setFailed(true);
    }
  };
  const thisYear = new Date().getFullYear();
  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex max-w-2xl flex-col gap-6"
    >
      <FormField label={text.objectiveText} error={error ?? undefined}>
        {(field) => (
          <Input
            {...field}
            maxLength={500}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        )}
      </FormField>
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField label={text.owner}>
          {(field) => (
            <NativeSelect
              {...field}
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
            >
              <option value="">{text.nobody}</option>
              {data.people.map((person) => (
                <option key={person.userId} value={person.userId}>
                  {person.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField label={text.targetYear}>
          {(field) => (
            <NativeSelect {...field} value={year} onChange={(event) => setYear(event.target.value)}>
              {Array.from({ length: 6 }, (_, index) => thisYear + index).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </div>
      {failed && (
        <p role="alert" className="text-destructive">
          {text.saveFailed}
        </p>
      )}
      <FormActions>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void navigate({ to: ownPath(relationshipId) })}
        >
          {text.cancel}
        </Button>
        <Button type="submit" loading={saving}>
          {text.save}
        </Button>
      </FormActions>
      {existing && (
        <div className="border-line-soft border-t pt-4">
          <ConfirmButton
            question={text.removeQuestion}
            confirmLabel={text.removeConfirm}
            cancelLabel={text.cancel}
            onConfirm={() => void remove()}
          >
            {text.remove}
          </ConfirmButton>
        </div>
      )}
    </form>
  );
}
