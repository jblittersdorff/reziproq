import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { useT } from '@/lib/i18n';

/** Betrag in Euro aus dem Eingabefeld, z. B. „600000“ oder „600.000,50“ → Cent */
const centsOf = (value: string) => {
  const number = Number(value.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) : null;
};

/** Ein Betrag mit Speichern und Abbrechen (Jahresziel, Ziel des Lieferanten) */
export function AmountForm({
  label,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  label: string;
  submitLabel: string;
  onSubmit: (cents: number) => Promise<void>;
  onCancel: () => void;
}) {
  const text = useT().insights;
  const [value, setValue] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <form
      aria-label={label}
      className="flex flex-wrap items-end gap-3"
      onSubmit={async (event: FormEvent) => {
        event.preventDefault();
        const cents = centsOf(value);
        if (cents === null) {
          setFailed(true);
          return;
        }
        setBusy(true);
        setFailed(false);
        try {
          await onSubmit(cents);
        } catch {
          setFailed(true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <FormField
        label={label}
        className="min-w-0 grow"
        error={failed ? text.goalFailed : undefined}
      >
        {(field) => (
          <Input
            {...field}
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
      </FormField>
      <FormActions>
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {text.cancel}
        </Button>
      </FormActions>
    </form>
  );
}
