import {
  lastFullYear,
  parseEuroToCents,
  type SaveSpendEntry,
  type SpendEntry,
  type SpendKind,
  type SpendOverview,
  saveSpendEntrySchema,
} from '@reziproq/shared';
import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { PageHeader } from '@/features/shell/page-header';
import { useGoBack } from '@/features/shell/page-path';
import { InternalBadge } from '@/features/workspace/internal-badge';
import { ApiError, saveSpendEntry } from '@/lib/api';
import { flash } from '@/lib/flash';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { SupplierFrame } from './supplier-frame';
import { useSpendOverview } from './supplier-spend-page';

/**
 * Einen Spend-Eintrag anlegen (entryId leer) oder ändern (PLT-03b, SPL-04): Jahr, Ist oder Plan,
 * optional Business Unit und Warengruppe. Der Betrag wird in Euro eingegeben und in Cent gespeichert.
 */
export function SpendFormPage({
  relationshipId,
  entryId,
}: {
  relationshipId: string;
  entryId?: string;
}) {
  const t = useT();
  const text = t.suppliers.spendDevelopment;
  const spendPage = `/lieferanten/${relationshipId}/strategie/spend`;
  const query = useSpendOverview(relationshipId);
  const existing = entryId ? query.data?.entries.find((entry) => entry.id === entryId) : undefined;
  const title = entryId ? text.editTitle : text.newTitle;
  return (
    <SupplierFrame
      relationshipId={relationshipId}
      area="strategy"
      trail={() => [{ label: t.suppliers.spend, href: spendPage }]}
      current={title}
    >
      {() => (
        <>
          <PageHeader title={title} purpose={text.formPurpose} badge={<InternalBadge />} />
          {query.isError ? (
            <ErrorState title={text.failed} />
          ) : !query.data ? (
            <LoadingState label={text.loading} />
          ) : entryId && !existing ? (
            <ErrorState title={text.notFound} />
          ) : (
            <SpendForm
              data={query.data}
              existing={existing}
              relationshipId={relationshipId}
              accessToken={query.accessToken}
              spendPage={spendPage}
            />
          )}
        </>
      )}
    </SupplierFrame>
  );
}

function SpendForm({
  data,
  existing,
  relationshipId,
  accessToken,
  spendPage,
}: {
  data: SpendOverview;
  existing: SpendEntry | undefined;
  relationshipId: string;
  accessToken: string;
  spendPage: string;
}) {
  const t = useT();
  const text = t.suppliers.spendDevelopment;
  const format = useFormat();
  const queryClient = useQueryClient();
  const goBack = useGoBack(spendPage);
  const [form, setForm] = useState({
    year: String(existing?.year ?? lastFullYear()),
    kind: (existing?.kind ?? 'actual') as SpendKind,
    businessUnitId: existing?.businessUnit?.id ?? '',
    materialGroupId: existing?.materialGroup?.id ?? '',
    amount: existing ? format.amountInput(existing.amount.amountCents) : '',
    currency: existing?.amount.currency ?? data.currency ?? 'EUR',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const done = (overview: SpendOverview, message: string) => {
    queryClient.setQueryData(['suppliers', relationshipId, 'spend'], overview);
    // Detail, Liste und Kachel lesen die Summe je Jahr neu.
    void queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    flash.set(message);
    goBack();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailed(false);
    const next: Record<string, string> = {};
    const cents = parseEuroToCents(form.amount, format.locale);
    if (form.amount.trim() === '') next.amountCents = t.suppliers.errors.required;
    else if (cents === null) next.amountCents = t.suppliers.errors.invalid_amount;
    const request: SaveSpendEntry = {
      year: Number(form.year),
      kind: form.kind,
      businessUnitId: form.businessUnitId || null,
      materialGroupId: form.materialGroupId || null,
      amountCents: cents ?? 0,
      currency: form.currency.trim().toUpperCase(),
    };
    const parsed = saveSpendEntrySchema.safeParse(request);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]);
        if (field === 'year') next.year = text.invalidYear;
        else if (field === 'currency') next.currency = text.invalidCurrency;
        else if (field === 'amountCents' && !next.amountCents) {
          next.amountCents = t.suppliers.errors.invalid_amount;
        }
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || !parsed.success) return;
    setSaving(true);
    try {
      done(
        await saveSpendEntry(accessToken, relationshipId, existing?.id ?? null, parsed.data),
        t.suppliers.saved,
      );
    } catch (error) {
      const code =
        error instanceof ApiError ? (error.body as { code?: string } | null)?.code : undefined;
      if (code === 'duplicate_entry') setErrors({ year: text.duplicate });
      else setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    try {
      done(await saveSpendEntry(accessToken, relationshipId, existing.id, null), text.removed);
    } catch {
      setFailed(true);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex max-w-xl flex-col gap-6"
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField label={text.year} error={errors.year}>
          {(field) => (
            <Input
              {...field}
              name="year"
              inputMode="numeric"
              value={form.year}
              onChange={(event) => setForm({ ...form, year: event.target.value })}
            />
          )}
        </FormField>
        <FormField label={text.kind}>
          {(field) => (
            <NativeSelect
              {...field}
              value={form.kind}
              onChange={(event) => setForm({ ...form, kind: event.target.value as SpendKind })}
            >
              <option value="actual">{text.kinds.actual}</option>
              <option value="plan">{text.kinds.plan}</option>
            </NativeSelect>
          )}
        </FormField>
        <FormField label={text.businessUnit}>
          {(field) => (
            <NativeSelect
              {...field}
              value={form.businessUnitId}
              onChange={(event) => setForm({ ...form, businessUnitId: event.target.value })}
            >
              <option value="">{text.none}</option>
              {data.options.businessUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField label={text.materialGroup}>
          {(field) => (
            <NativeSelect
              {...field}
              value={form.materialGroupId}
              onChange={(event) => setForm({ ...form, materialGroupId: event.target.value })}
            >
              <option value="">{text.none}</option>
              {data.options.materialGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField
          label={t.suppliers.spendAmount}
          hint={t.suppliers.spendAmountHint}
          error={errors.amountCents}
        >
          {(field) => (
            <Input
              {...field}
              name="amount"
              inputMode="decimal"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
            />
          )}
        </FormField>
        <FormField label={text.currency} error={errors.currency}>
          {(field) => (
            <Input
              {...field}
              name="currency"
              maxLength={3}
              value={form.currency}
              onChange={(event) => setForm({ ...form, currency: event.target.value })}
            />
          )}
        </FormField>
      </div>
      {failed && (
        <p role="alert" className="text-destructive">
          {t.suppliers.saveFailed}
        </p>
      )}
      <FormActions>
        {existing && (
          <ConfirmButton
            question={text.removeQuestion}
            confirmLabel={text.removeConfirm}
            cancelLabel={t.suppliers.cancel}
            onConfirm={() => void remove()}
          >
            {text.remove}
          </ConfirmButton>
        )}
        <Button type="button" variant="secondary" onClick={goBack}>
          {t.suppliers.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t.suppliers.saving : t.suppliers.save}
        </Button>
      </FormActions>
    </form>
  );
}
