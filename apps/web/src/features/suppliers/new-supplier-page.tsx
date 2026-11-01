import { createSupplierRequestSchema, lastFullYear, parseEuroToCents } from '@reziproq/shared';
import { Link, useNavigate } from '@tanstack/react-router';
import { LinkIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Button } from '@/components/ui/button';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath, useGoBack } from '@/features/shell/page-path';
import { ApiError, createSupplier, lookupSupplier } from '@/lib/api';
import { flash } from '@/lib/flash';
import { useT } from '@/lib/i18n';
import { countryOptions } from './countries';
import { apiFieldErrors, translateFieldErrors, useRefreshSupplier } from './use-supplier';

/**
 * Lieferant hinzufügen (PLT-03b) als eigene Seite. Gibt es die Organisation über USt-IdNr. oder
 * D-U-N-S schon, sagt die Seite nur, dass verknüpft wird, und nennt nichts Fremdes.
 */
export function NewSupplierPage() {
  const t = useT();
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const navigate = useNavigate();
  const goBack = useGoBack('/lieferanten');
  const refresh = useRefreshSupplier();

  const [form, setForm] = useState({
    name: '',
    country: '',
    vatId: '',
    duns: '',
    externalRef: '',
    amount: '',
    year: String(lastFullYear()),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [linked, setLinked] = useState(false);
  const [existing, setExisting] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (field: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  /** Nach dem Verlassen von USt-IdNr. oder D-U-N-S: nur „bekannt ja/nein“. */
  const checkKnown = async () => {
    const ids = createSupplierRequestSchema
      .pick({ vatId: true, duns: true })
      .safeParse({ vatId: form.vatId, duns: form.duns });
    if (!ids.success || (!ids.data.vatId && !ids.data.duns)) {
      setLinked(false);
      return;
    }
    try {
      const answer = await lookupSupplier(accessToken, {
        ...(ids.data.vatId ? { ust: ids.data.vatId } : {}),
        ...(ids.data.duns ? { duns: ids.data.duns } : {}),
      });
      setLinked(answer.known);
    } catch {
      setLinked(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailed(false);
    setExisting(null);
    const amountCents = form.amount.trim() === '' ? undefined : parseEuroToCents(form.amount);
    const request = {
      name: form.name,
      country: form.country,
      vatId: form.vatId,
      duns: form.duns,
      externalRef: form.externalRef,
      ...(amountCents === undefined
        ? {}
        : { spend: { year: Number(form.year), amountCents: amountCents ?? Number.NaN } }),
    };
    const parsed = createSupplierRequestSchema.safeParse(request);
    if (!parsed.success) {
      setErrors(translateFieldErrors(parsed.error.issues, t));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const created = await createSupplier(accessToken, parsed.data);
      refresh(created.relationshipId);
      flash.set(created.linked ? t.suppliers.linked : t.suppliers.saved);
      await navigate({
        to: '/lieferanten/$id/strategie/profil',
        params: { id: created.relationshipId },
        replace: true,
      });
    } catch (error) {
      const fieldErrors = apiFieldErrors(error, t);
      if (fieldErrors) setErrors(fieldErrors);
      else if (error instanceof ApiError && error.status === 409) {
        setExisting((error.body as { relationshipId?: string } | null)?.relationshipId ?? '');
      } else setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PagePath
        trail={[{ label: t.suppliers.title, href: '/lieferanten' }]}
        current={t.suppliers.newTitle}
      />
      <PageHeader title={t.suppliers.newTitle} purpose={t.suppliers.newPurpose} />
      <form
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex max-w-xl flex-col gap-6"
      >
        <FormField label={t.suppliers.name} error={errors.name}>
          {(field) => (
            <Input
              {...field}
              name="name"
              autoComplete="organization"
              value={form.name}
              onChange={(event) => set('name')(event.target.value)}
            />
          )}
        </FormField>
        <FormField label={t.suppliers.country} error={errors.country}>
          {(field) => (
            <NativeSelect
              {...field}
              name="country"
              value={form.country}
              onChange={(event) => set('country')(event.target.value)}
            >
              <option value="">{t.suppliers.countryPlaceholder}</option>
              {countryOptions.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField label={t.suppliers.vatId} hint={t.suppliers.vatIdHint} error={errors.vatId}>
            {(field) => (
              <Input
                {...field}
                name="vatId"
                value={form.vatId}
                onChange={(event) => set('vatId')(event.target.value)}
                onBlur={() => void checkKnown()}
              />
            )}
          </FormField>
          <FormField label={t.suppliers.duns} hint={t.suppliers.dunsHint} error={errors.duns}>
            {(field) => (
              <Input
                {...field}
                name="duns"
                inputMode="numeric"
                value={form.duns}
                onChange={(event) => set('duns')(event.target.value)}
                onBlur={() => void checkKnown()}
              />
            )}
          </FormField>
        </div>
        {linked && (
          <p role="status" className="flex items-center gap-2 rounded-lg bg-muted px-4 py-3">
            <LinkIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            {t.suppliers.linked}
          </p>
        )}
        <FormField
          label={t.suppliers.externalRef}
          hint={t.suppliers.externalRefHint}
          error={errors.externalRef}
        >
          {(field) => (
            <Input
              {...field}
              name="externalRef"
              value={form.externalRef}
              onChange={(event) => set('externalRef')(event.target.value)}
            />
          )}
        </FormField>
        <div className="grid gap-6 sm:grid-cols-[1fr_10rem]">
          <FormField
            label={t.suppliers.spendAmount}
            hint={t.suppliers.spendAmountHint}
            error={errors['spend.amountCents']}
          >
            {(field) => (
              <Input
                {...field}
                name="amount"
                inputMode="decimal"
                value={form.amount}
                onChange={(event) => set('amount')(event.target.value)}
              />
            )}
          </FormField>
          <FormField label={t.suppliers.spendYear} error={errors['spend.year']}>
            {(field) => (
              <Input
                {...field}
                name="year"
                inputMode="numeric"
                value={form.year}
                onChange={(event) => set('year')(event.target.value)}
              />
            )}
          </FormField>
        </div>

        {existing !== null && (
          <p
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-lg bg-warning-soft px-4 py-3 text-warning-soft-foreground"
          >
            {t.suppliers.alreadyInList}
            {existing && (
              <Link
                to="/lieferanten/$id/strategie/profil"
                params={{ id: existing }}
                className="font-medium underline underline-offset-4"
              >
                {t.suppliers.openExisting}
              </Link>
            )}
          </p>
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
          <Button type="submit" disabled={saving}>
            {saving ? t.suppliers.saving : t.suppliers.save}
          </Button>
        </FormActions>
      </form>
    </>
  );
}
