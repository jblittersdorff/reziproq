import {
  type Executive,
  type FinancialImportResult,
  type FinancialMetric,
  type FinancialValue,
  financialMetrics,
  isRatio,
  parseImportAmount,
  type SupplierProfile,
  saveFinancialSchema,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { KpiLineChart } from '@/components/charts/kpi-line-chart';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { useGoBack } from '@/features/shell/page-path';
import { InternalBadge } from '@/features/workspace/internal-badge';
import {
  importFinancials,
  saveFinancial,
  saveProfileSection,
  supplierProfileQueryOptions,
} from '@/lib/api';
import { flash } from '@/lib/flash';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { SupplierFrame } from './supplier-frame';

// SPL-05: Profil und Finanzen eines Lieferanten, nur beim Käufer und immer intern.

const profilePath = (relationshipId: string) => `/lieferanten/${relationshipId}/strategie/profil`;

export function useSupplierProfile(relationshipId: string) {
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({
    ...supplierProfileQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  return { ...query, accessToken };
}

/** Wert einer Kennzahl lesbar: Beträge kompakt mit Währung, Quoten in Prozent. */
function useFinancialFormat() {
  const format = useFormat();
  return (value: number, metric: FinancialMetric, currency: string | null, compact = true) =>
    isRatio(metric)
      ? `${format.number(value / 100)} %`
      : new Intl.NumberFormat(format.locale, {
          style: 'currency',
          currency: currency ?? 'EUR',
          ...(compact ? { notation: 'compact' as const, maximumFractionDigits: 1 } : {}),
        }).format(value / 100);
}

function Section({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="font-semibold text-lg">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Abschnitte auf Strategie › Profil: Unternehmen, Geschäftsleitung, Kennzahlen, Anteil, Einschätzung. */
export function ProfileFinanceSections({ relationshipId }: { relationshipId: string }) {
  const text = useT().suppliers.profileFinance;
  const query = useSupplierProfile(relationshipId);
  if (query.isError) return <ErrorState title={text.failed} />;
  if (!query.data) return <LoadingState label={text.loading} />;
  return <ProfileFinanceContent data={query.data} relationshipId={relationshipId} />;
}

function ProfileFinanceContent({
  data,
  relationshipId,
}: {
  data: SupplierProfile;
  relationshipId: string;
}) {
  const t = useT();
  const text = t.suppliers.profileFinance;
  const format = useFormat();
  const money = useFinancialFormat();
  const base = profilePath(relationshipId);
  const editLink = (href: string, label: string) =>
    data.canEdit
      ? routerLink({
          href,
          className: buttonVariants({ variant: 'outline' }),
          'aria-label': label,
          children: text.edit,
        })
      : null;
  const value = (entry: string | number | null) =>
    entry === null || entry === '' ? (
      <span className="text-muted-foreground">{text.notRecorded}</span>
    ) : (
      entry
    );
  const byMetric = financialMetrics
    .map((metric) => ({
      metric,
      values: data.financials.filter((entry) => entry.metric === metric),
    }))
    .filter((entry) => entry.values.length > 0);

  return (
    <>
      <Section
        id="profil-unternehmen"
        title={text.company}
        action={editLink(`${base}/unternehmen`, text.companyEdit)}
      >
        <dl className="grid gap-x-6 gap-y-3 rounded-lg bg-card p-4 sm:grid-cols-[max-content_1fr]">
          <dt className="text-muted-foreground text-sm">{text.headquarters}</dt>
          <dd>{value(data.company.headquarters)}</dd>
          <dt className="text-muted-foreground text-sm">{text.foundedYear}</dt>
          <dd className="tabular-nums">{value(data.company.foundedYear)}</dd>
          <dt className="text-muted-foreground text-sm">{text.employees}</dt>
          <dd className="tabular-nums">
            {value(data.company.employees === null ? null : format.number(data.company.employees))}
          </dd>
          <dt className="text-muted-foreground text-sm">{text.businessSegments}</dt>
          <dd className="whitespace-pre-wrap">{value(data.company.businessSegments)}</dd>
        </dl>
      </Section>

      <Section
        id="profil-geschaeftsleitung"
        title={text.executives}
        action={editLink(`${base}/geschaeftsleitung`, text.executivesEdit)}
      >
        {data.executives.length === 0 ? (
          <p className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
            {text.executivesEmpty}
          </p>
        ) : (
          <ul aria-label={text.executives} className="flex flex-col gap-2">
            {data.executives.map((entry) => (
              <li key={entry.id} className="flex flex-wrap gap-x-3 rounded-lg bg-card px-4 py-3">
                <span className="font-medium">{entry.name}</span>
                <span className="text-muted-foreground">
                  {entry.role}
                  {entry.since ? ` · ${text.sinceYear(entry.since)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="profil-anteil" title={text.share}>
        <div className="flex flex-col gap-1 rounded-lg bg-card p-4">
          {data.share?.status === 'ok' ? (
            <>
              <span className="font-semibold text-display tabular-nums">
                {format.number(data.share.basisPoints / 100)} %
              </span>
              <span className="text-muted-foreground text-sm">
                {text.shareText(data.share.year)}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              {data.share ? text.shareCurrency(data.share.year) : text.shareEmpty}
            </span>
          )}
        </div>
      </Section>

      <Section
        id="profil-kennzahlen"
        title={text.financials}
        action={
          data.canEdit ? (
            <div className="flex flex-wrap gap-2">
              {routerLink({
                href: `${base}/kennzahlen/neu`,
                className: buttonVariants({ variant: 'outline' }),
                children: (
                  <>
                    <PlusIcon />
                    {text.addFinancial}
                  </>
                ),
              })}
              {routerLink({
                href: `${base}/kennzahlen/import`,
                className: buttonVariants({ variant: 'outline' }),
                children: (
                  <>
                    <UploadIcon />
                    {text.importTitle}
                  </>
                ),
              })}
            </div>
          ) : null
        }
      >
        <p className="text-muted-foreground text-sm">{text.financialsHint}</p>
        {byMetric.length === 0 ? (
          <p className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
            {text.financialsEmpty}
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {byMetric.map(({ metric, values }) => {
              const last = values.at(-1) as FinancialValue;
              const name = text.metrics[metric] ?? metric;
              return (
                <div key={metric} className="flex flex-col gap-3 rounded-lg bg-card p-4">
                  <KpiLineChart
                    title={text.metricTitle(
                      name,
                      money(last.value, metric, last.currency),
                      last.year,
                    )}
                    points={values.map((entry) => ({ time: entry.year, actual: entry.value }))}
                    names={{ actual: name, plan: name }}
                    formatValue={(number) => money(number, metric, last.currency)}
                    formatTime={(year) => String(year)}
                    empty={{ title: name, description: text.financialsEmpty }}
                  />
                  <ul aria-label={name} className="flex flex-col text-sm">
                    {values.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex min-h-11 flex-wrap items-center gap-x-3 border-line-soft border-t"
                      >
                        <span className="tabular-nums">{entry.year}</span>
                        <span className="font-medium tabular-nums">
                          {money(entry.value, metric, entry.currency, false)}
                        </span>
                        <span className="flex-1 truncate text-muted-foreground">
                          {text.source}: {entry.source}
                        </span>
                        {data.canEdit &&
                          routerLink({
                            href: `${base}/kennzahlen/${entry.id}`,
                            className: buttonVariants({ variant: 'ghost' }),
                            'aria-label': text.editFinancialLabel(name, entry.year),
                            children: text.edit,
                          })}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section
        id="profil-einschaetzung"
        title={text.implications}
        action={editLink(`${base}/einschaetzung`, text.implicationsEdit)}
      >
        <p className="whitespace-pre-wrap rounded-lg bg-card px-4 py-3">
          {data.implications ?? (
            <span className="text-muted-foreground">{text.implicationsEmpty}</span>
          )}
        </p>
      </Section>
    </>
  );
}

/** Rahmen der Bearbeiten-Seiten: Pfad Profil › Abschnitt, Kennzeichen „Intern“. */
function EditFrame({
  relationshipId,
  title,
  purpose,
  children,
}: {
  relationshipId: string;
  title: string;
  purpose: string;
  children: (data: SupplierProfile, accessToken: string) => ReactNode;
}) {
  const t = useT();
  const text = t.suppliers.profileFinance;
  const query = useSupplierProfile(relationshipId);
  return (
    <SupplierFrame
      relationshipId={relationshipId}
      area="strategy"
      trail={() => [{ label: t.workspace.pages.profile.title, href: profilePath(relationshipId) }]}
      current={title}
    >
      {() => (
        <>
          <PageHeader title={title} purpose={purpose} badge={<InternalBadge />} />
          {query.isError ? (
            <ErrorState title={text.failed} />
          ) : !query.data ? (
            <LoadingState label={text.loading} />
          ) : (
            children(query.data, query.accessToken)
          )}
        </>
      )}
    </SupplierFrame>
  );
}

/** Speichern führt zurück zum Profil; Fehler bleiben auf der Seite. */
function useSave(relationshipId: string) {
  const t = useT();
  const queryClient = useQueryClient();
  const goBack = useGoBack(profilePath(relationshipId));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const run = async (work: () => Promise<SupplierProfile>) => {
    setSaving(true);
    setFailed(false);
    try {
      queryClient.setQueryData(['suppliers', relationshipId, 'profil'], await work());
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
      flash.set(t.suppliers.saved);
      goBack();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  return { run, saving, failed, goBack };
}

function Actions({
  saving,
  failed,
  onCancel,
  extra,
}: {
  saving: boolean;
  failed: boolean;
  onCancel: () => void;
  extra?: ReactNode;
}) {
  const t = useT();
  return (
    <>
      {failed && (
        <p role="alert" className="text-destructive">
          {t.suppliers.saveFailed}
        </p>
      )}
      <FormActions>
        {extra}
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t.suppliers.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t.suppliers.saving : t.suppliers.save}
        </Button>
      </FormActions>
    </>
  );
}

const yearOrNull = (value: string) => (/^\d{4}$/.test(value.trim()) ? Number(value) : null);

export function CompanyEditPage({ relationshipId }: { relationshipId: string }) {
  const text = useT().suppliers.profileFinance;
  return (
    <EditFrame
      relationshipId={relationshipId}
      title={text.companyEdit}
      purpose={text.companyPurpose}
    >
      {(data, accessToken) => (
        <CompanyForm data={data} accessToken={accessToken} relationshipId={relationshipId} />
      )}
    </EditFrame>
  );
}

function CompanyForm({
  data,
  accessToken,
  relationshipId,
}: {
  data: SupplierProfile;
  accessToken: string;
  relationshipId: string;
}) {
  const text = useT().suppliers.profileFinance;
  const { run, saving, failed, goBack } = useSave(relationshipId);
  const [form, setForm] = useState({
    headquarters: data.company.headquarters ?? '',
    foundedYear: data.company.foundedYear ? String(data.company.foundedYear) : '',
    employees: data.company.employees === null ? '' : String(data.company.employees),
    businessSegments: data.company.businessSegments ?? '',
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const employees = Number.parseInt(form.employees.replace(/\D/g, ''), 10);
    void run(() =>
      saveProfileSection(accessToken, relationshipId, 'unternehmen', {
        headquarters: form.headquarters.trim() || null,
        foundedYear: yearOrNull(form.foundedYear),
        employees: Number.isNaN(employees) ? null : employees,
        businessSegments: form.businessSegments.trim() || null,
      }),
    );
  };
  const input = (key: keyof typeof form, label: string, inputMode?: 'numeric') => (
    <FormField label={label}>
      {(field) => (
        <Input
          {...field}
          {...(inputMode ? { inputMode } : {})}
          value={form[key]}
          onChange={(event) => setForm({ ...form, [key]: event.target.value })}
        />
      )}
    </FormField>
  );
  return (
    <form noValidate onSubmit={submit} className="flex max-w-xl flex-col gap-6">
      {input('headquarters', text.headquarters)}
      <div className="grid gap-6 sm:grid-cols-2">
        {input('foundedYear', text.foundedYear, 'numeric')}
        {input('employees', text.employees, 'numeric')}
      </div>
      <FormField label={text.businessSegments}>
        {(field) => (
          <Textarea
            {...field}
            rows={4}
            value={form.businessSegments}
            onChange={(event) => setForm({ ...form, businessSegments: event.target.value })}
          />
        )}
      </FormField>
      <Actions saving={saving} failed={failed} onCancel={goBack} />
    </form>
  );
}

export function ImplicationsEditPage({ relationshipId }: { relationshipId: string }) {
  const text = useT().suppliers.profileFinance;
  return (
    <EditFrame
      relationshipId={relationshipId}
      title={text.implicationsEdit}
      purpose={text.implicationsPurpose}
    >
      {(data, accessToken) => (
        <ImplicationsForm data={data} accessToken={accessToken} relationshipId={relationshipId} />
      )}
    </EditFrame>
  );
}

function ImplicationsForm({
  data,
  accessToken,
  relationshipId,
}: {
  data: SupplierProfile;
  accessToken: string;
  relationshipId: string;
}) {
  const text = useT().suppliers.profileFinance;
  const { run, saving, failed, goBack } = useSave(relationshipId);
  const [value, setValue] = useState(data.implications ?? '');
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void run(() =>
          saveProfileSection(accessToken, relationshipId, 'einschaetzung', {
            implications: value.trim() || null,
          }),
        );
      }}
      className="flex max-w-2xl flex-col gap-6"
    >
      <FormField label={text.implications}>
        {(field) => (
          <Textarea {...field} rows={8} value={value} onChange={(e) => setValue(e.target.value)} />
        )}
      </FormField>
      <Actions saving={saving} failed={failed} onCancel={goBack} />
    </form>
  );
}

export function ExecutivesEditPage({ relationshipId }: { relationshipId: string }) {
  const text = useT().suppliers.profileFinance;
  return (
    <EditFrame
      relationshipId={relationshipId}
      title={text.executivesEdit}
      purpose={text.executivesPurpose}
    >
      {(data, accessToken) => (
        <ExecutivesForm data={data} accessToken={accessToken} relationshipId={relationshipId} />
      )}
    </EditFrame>
  );
}

type ExecutiveRow = { key: number; name: string; role: string; since: string };

function ExecutivesForm({
  data,
  accessToken,
  relationshipId,
}: {
  data: SupplierProfile;
  accessToken: string;
  relationshipId: string;
}) {
  const t = useT();
  const text = t.suppliers.profileFinance;
  const { run, saving, failed, goBack } = useSave(relationshipId);
  const [rows, setRows] = useState<ExecutiveRow[]>(
    data.executives.map((entry, index) => ({
      key: index,
      name: entry.name,
      role: entry.role,
      since: entry.since ? String(entry.since) : '',
    })),
  );
  const [missing, setMissing] = useState(false);
  const update = (key: number, change: Partial<ExecutiveRow>) =>
    setRows(rows.map((row) => (row.key === key ? { ...row, ...change } : row)));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const filled = rows.filter((row) => row.name.trim() || row.role.trim());
    if (filled.some((row) => !row.name.trim() || !row.role.trim())) {
      setMissing(true);
      return;
    }
    setMissing(false);
    const executives: Executive[] = filled.map((row) => ({
      name: row.name.trim(),
      role: row.role.trim(),
      since: yearOrNull(row.since),
    }));
    void run(() =>
      saveProfileSection(accessToken, relationshipId, 'geschaeftsleitung', { executives }),
    );
  };
  return (
    <form noValidate onSubmit={submit} className="flex max-w-3xl flex-col gap-6">
      <ul aria-label={text.executives} className="flex flex-col gap-4">
        {rows.map((row, index) => (
          <li
            key={row.key}
            className="flex flex-col gap-3 rounded-lg bg-card p-4 sm:flex-row sm:items-end"
          >
            <FormField label={`${text.name} ${index + 1}`} className="flex-1">
              {(field) => (
                <Input
                  {...field}
                  value={row.name}
                  onChange={(event) => update(row.key, { name: event.target.value })}
                />
              )}
            </FormField>
            <FormField label={`${text.role} ${index + 1}`} className="flex-1">
              {(field) => (
                <Input
                  {...field}
                  value={row.role}
                  onChange={(event) => update(row.key, { role: event.target.value })}
                />
              )}
            </FormField>
            <FormField label={`${text.since} ${index + 1}`} className="sm:w-28">
              {(field) => (
                <Input
                  {...field}
                  inputMode="numeric"
                  value={row.since}
                  onChange={(event) => update(row.key, { since: event.target.value })}
                />
              )}
            </FormField>
            <Button
              type="button"
              variant="ghost"
              aria-label={text.removePerson(row.name)}
              onClick={() => setRows(rows.filter((other) => other.key !== row.key))}
            >
              <Trash2Icon />
            </Button>
          </li>
        ))}
      </ul>
      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setRows([
              ...rows,
              {
                key: Math.max(-1, ...rows.map((row) => row.key)) + 1,
                name: '',
                role: '',
                since: '',
              },
            ])
          }
        >
          <PlusIcon />
          {text.addPerson}
        </Button>
      </div>
      {missing && (
        <p role="alert" className="text-destructive">
          {t.suppliers.errors.required}
        </p>
      )}
      <Actions saving={saving} failed={failed} onCancel={goBack} />
    </form>
  );
}

export function FinancialFormPage({
  relationshipId,
  financialId,
}: {
  relationshipId: string;
  financialId?: string;
}) {
  const text = useT().suppliers.profileFinance;
  return (
    <EditFrame
      relationshipId={relationshipId}
      title={financialId ? text.editFinancial : text.addFinancial}
      purpose={text.financialPurpose}
    >
      {(data, accessToken) => {
        const existing = financialId
          ? data.financials.find((entry) => entry.id === financialId)
          : undefined;
        if (financialId && !existing) return <ErrorState title={text.failed} />;
        return (
          <FinancialForm
            existing={existing}
            accessToken={accessToken}
            relationshipId={relationshipId}
          />
        );
      }}
    </EditFrame>
  );
}

function FinancialForm({
  existing,
  accessToken,
  relationshipId,
}: {
  existing: FinancialValue | undefined;
  accessToken: string;
  relationshipId: string;
}) {
  const t = useT();
  const text = t.suppliers.profileFinance;
  const format = useFormat();
  const { run, saving, failed, goBack } = useSave(relationshipId);
  const [form, setForm] = useState({
    year: String(existing?.year ?? new Date().getFullYear() - 1),
    metric: (existing?.metric ?? 'revenue') as FinancialMetric,
    value: existing ? format.amountInput(existing.value) : '',
    currency: existing?.currency ?? 'EUR',
    source: existing?.source ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const ratio = isRatio(form.metric);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text2 = form.value.trim();
    const negative = text2.startsWith('-');
    const parsed = parseImportAmount(negative ? text2.slice(1) : text2);
    const request = {
      year: Number(form.year),
      metric: form.metric,
      value: parsed === null ? Number.NaN : negative ? -parsed : parsed,
      currency: ratio ? null : form.currency.trim().toUpperCase(),
      source: form.source,
    };
    const result = saveFinancialSchema.safeParse(request);
    const next: Record<string, string> = {};
    if (parsed === null) next.value = text.errors.invalid_value ?? '';
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = String(issue.path[0]);
        if (field === 'source') next.source = text.errors.source_required ?? '';
        if (field === 'year') next.year = text.errors.invalid_year ?? '';
        if (field === 'currency') next.currency = text.errors.invalid_currency ?? '';
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || !result.success) return;
    void run(() => saveFinancial(accessToken, relationshipId, existing?.id ?? null, result.data));
  };
  return (
    <form noValidate onSubmit={submit} className="flex max-w-xl flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField label={text.metric}>
          {(field) => (
            <NativeSelect
              {...field}
              value={form.metric}
              onChange={(event) =>
                setForm({ ...form, metric: event.target.value as FinancialMetric })
              }
            >
              {financialMetrics.map((metric) => (
                <option key={metric} value={metric}>
                  {text.metrics[metric]}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField label={text.year} error={errors.year}>
          {(field) => (
            <Input
              {...field}
              inputMode="numeric"
              value={form.year}
              onChange={(event) => setForm({ ...form, year: event.target.value })}
            />
          )}
        </FormField>
        <FormField
          label={text.value}
          hint={ratio ? text.valuePercentHint : text.valueAmountHint}
          error={errors.value}
        >
          {(field) => (
            <Input
              {...field}
              inputMode="decimal"
              value={form.value}
              onChange={(event) => setForm({ ...form, value: event.target.value })}
            />
          )}
        </FormField>
        {!ratio && (
          <FormField label={text.currency} error={errors.currency}>
            {(field) => (
              <Input
                {...field}
                maxLength={3}
                value={form.currency}
                onChange={(event) => setForm({ ...form, currency: event.target.value })}
              />
            )}
          </FormField>
        )}
      </div>
      <FormField label={text.source} hint={text.sourceHint} error={errors.source}>
        {(field) => (
          <Input
            {...field}
            value={form.source}
            onChange={(event) => setForm({ ...form, source: event.target.value })}
          />
        )}
      </FormField>
      <Actions
        saving={saving}
        failed={failed}
        onCancel={goBack}
        extra={
          existing ? (
            <ConfirmButton
              question={text.removeQuestion}
              confirmLabel={text.removeConfirm}
              cancelLabel={t.suppliers.cancel}
              onConfirm={() =>
                void run(() => saveFinancial(accessToken, relationshipId, existing.id, null))
              }
            >
              {text.remove}
            </ConfirmButton>
          ) : null
        }
      />
    </form>
  );
}

export function FinancialImportPage({ relationshipId }: { relationshipId: string }) {
  const text = useT().suppliers.profileFinance;
  return (
    <EditFrame
      relationshipId={relationshipId}
      title={text.importTitle}
      purpose={text.importPurpose}
    >
      {(_, accessToken) => <ImportForm accessToken={accessToken} relationshipId={relationshipId} />}
    </EditFrame>
  );
}

function ImportForm({
  accessToken,
  relationshipId,
}: {
  accessToken: string;
  relationshipId: string;
}) {
  const t = useT();
  const text = t.suppliers.profileFinance;
  const queryClient = useQueryClient();
  const goBack = useGoBack(profilePath(relationshipId));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FinancialImportResult | null>(null);
  const [failed, setFailed] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setFailed(false);
    try {
      const outcome = await importFinancials(accessToken, relationshipId, file);
      if (outcome.rows.length === 0) {
        await queryClient.invalidateQueries({ queryKey: ['suppliers', relationshipId, 'profil'] });
        flash.set(text.imported(outcome.imported));
        goBack();
      } else {
        setResult(outcome);
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex max-w-2xl flex-col gap-6"
    >
      <FormField label={text.importFile}>
        {(field) => (
          <Input
            {...field}
            type="file"
            accept=".csv,.xlsx"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setResult(null);
            }}
          />
        )}
      </FormField>
      {result && (
        <div role="alert" className="flex flex-col gap-2 rounded-lg bg-destructive-soft p-4">
          <p className="font-medium text-destructive-soft-foreground">{text.importFailed}</p>
          <ul aria-label={text.importFailed} className="flex flex-col gap-1 text-sm">
            {result.rows.map((row) => (
              <li key={row.row}>
                {text.importRow(row.row)}:{' '}
                {row.issues.map((issue) => text.importIssues[issue] ?? issue).join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}
      {failed && (
        <p role="alert" className="text-destructive">
          {t.suppliers.saveFailed}
        </p>
      )}
      <FormActions>
        <Button type="button" variant="secondary" onClick={goBack}>
          {t.suppliers.cancel}
        </Button>
        <Button type="submit" disabled={!file || busy}>
          <UploadIcon />
          {busy ? text.importing : text.importButton}
        </Button>
      </FormActions>
    </form>
  );
}
