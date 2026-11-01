import {
  lastFullYear,
  parseEuroToCents,
  type SupplierDetail,
  spendYearSchema,
} from '@reziproq/shared';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/features/shell/page-header';
import { useGoBack } from '@/features/shell/page-path';
import { InternalBadge } from '@/features/workspace/internal-badge';
import { putSpend } from '@/lib/api';
import { flash } from '@/lib/flash';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { SupplierFrame } from './supplier-frame';
import { apiFieldErrors, useRefreshSupplier, useSupplier } from './use-supplier';

/**
 * Spend eines Jahres anlegen (year leer) oder ändern (PLT-03b). Der Betrag wird in Euro
 * eingegeben und in Cent gespeichert.
 */
export function SpendFormPage({ relationshipId, year }: { relationshipId: string; year?: number }) {
  const t = useT();
  const spendPage = `/lieferanten/${relationshipId}/strategie/spend`;
  return (
    <SupplierFrame
      relationshipId={relationshipId}
      area="strategy"
      trail={() => [{ label: t.suppliers.spend, href: spendPage }]}
      current={year ? String(year) : t.suppliers.spendNewTitle}
    >
      {(supplier) => <SpendForm supplier={supplier} year={year} spendPage={spendPage} />}
    </SupplierFrame>
  );
}

function SpendForm({
  supplier,
  year,
  spendPage,
}: {
  supplier: SupplierDetail;
  year: number | undefined;
  spendPage: string;
}) {
  const t = useT();
  const format = useFormat();
  const { accessToken } = useSupplier(supplier.relationshipId);
  const refresh = useRefreshSupplier();
  const goBack = useGoBack(spendPage);
  const existing = supplier.spend.find((entry) => entry.year === year);
  const [form, setForm] = useState({
    year: String(year ?? lastFullYear()),
    amount: existing ? format.amountInput(existing.amount.amountCents) : '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailed(false);
    const next: Record<string, string> = {};
    const parsedYear = spendYearSchema.safeParse(Number(form.year));
    if (!parsedYear.success) next.year = t.suppliers.errors.invalid_year;
    else if (!year && supplier.spend.some((entry) => entry.year === parsedYear.data)) {
      next.year = t.suppliers.yearTaken;
    }
    const cents = parseEuroToCents(form.amount, format.locale);
    if (form.amount.trim() === '') next.amountCents = t.suppliers.errors.required;
    else if (cents === null) next.amountCents = t.suppliers.errors.invalid_amount;
    setErrors(next);
    if (Object.keys(next).length > 0 || !parsedYear.success || cents === null) return;

    setSaving(true);
    try {
      await putSpend(accessToken, supplier.relationshipId, parsedYear.data, { amountCents: cents });
      refresh(supplier.relationshipId);
      flash.set(t.suppliers.saved);
      goBack();
    } catch (error) {
      const fieldErrors = apiFieldErrors(error, t);
      if (fieldErrors) setErrors(fieldErrors);
      else setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title={year ? t.suppliers.spendEditTitle(year) : t.suppliers.spendNewTitle}
        purpose={t.suppliers.spendFormPurpose}
        badge={<InternalBadge />}
      />
      <form
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex max-w-xl flex-col gap-6"
      >
        {!year && (
          <FormField label={t.suppliers.spendYear} error={errors.year}>
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
        )}
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
        {failed && (
          <p role="alert" className="text-destructive">
            {t.suppliers.saveFailed}
          </p>
        )}
        <FormActions>
          <Button type="button" variant="secondary" onClick={goBack}>
            {t.suppliers.cancel}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? t.suppliers.saving : t.suppliers.save}
          </Button>
        </FormActions>
      </form>
    </>
  );
}
