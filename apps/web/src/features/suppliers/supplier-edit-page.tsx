import type { SupplierDetail } from '@reziproq/shared';
import { updateSupplierRequestSchema } from '@reziproq/shared';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/features/shell/page-header';
import { useGoBack } from '@/features/shell/page-path';
import { updateSupplier } from '@/lib/api';
import { flash } from '@/lib/flash';
import { useT } from '@/lib/i18n';
import { SupplierFrame } from './supplier-frame';
import {
  apiFieldErrors,
  translateFieldErrors,
  useRefreshSupplier,
  useSupplier,
} from './use-supplier';

/** Profil › Bearbeiten (PLT-03b): eigene Werte als Formularseite; Stammdaten bleiben unberührt. */
export function SupplierEditPage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const profile = `/lieferanten/${relationshipId}/strategie/profil`;
  return (
    <SupplierFrame
      relationshipId={relationshipId}
      trail={(supplier) => [{ label: supplier.name, href: profile }]}
      current={t.suppliers.edit}
    >
      {(supplier) => <EditForm supplier={supplier} profile={profile} />}
    </SupplierFrame>
  );
}

function EditForm({ supplier, profile }: { supplier: SupplierDetail; profile: string }) {
  const t = useT();
  const { accessToken } = useSupplier(supplier.relationshipId);
  const refresh = useRefreshSupplier();
  const goBack = useGoBack(profile);
  const [form, setForm] = useState({
    displayName: supplier.name,
    externalRef: supplier.externalRef ?? '',
    notes: supplier.notes ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailed(false);
    const parsed = updateSupplierRequestSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(translateFieldErrors(parsed.error.issues, t));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await updateSupplier(accessToken, supplier.relationshipId, parsed.data);
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
      <PageHeader title={t.suppliers.editTitle} purpose={t.suppliers.editPurpose} />
      <form
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex max-w-xl flex-col gap-6"
      >
        <FormField label={t.suppliers.displayName} error={errors.displayName}>
          {(field) => (
            <Input
              {...field}
              name="displayName"
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
            />
          )}
        </FormField>
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
              onChange={(event) => setForm({ ...form, externalRef: event.target.value })}
            />
          )}
        </FormField>
        <FormField label={t.suppliers.notes} error={errors.notes}>
          {(field) => (
            <Textarea
              {...field}
              name="notes"
              rows={5}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
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
