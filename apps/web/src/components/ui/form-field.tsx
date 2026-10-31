import type * as React from 'react';
import { useId } from 'react';

import { cn } from '@/lib/utils';
import { Checkbox } from './checkbox';

/**
 * Ein Feld einer Formularseite (PLT-10): Beschriftung oben, Hinweis darunter, Fehlermeldung direkt
 * am Feld. Das Feld bekommt seine id, aria-invalid und aria-describedby über die Render-Funktion.
 */
function FormField({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: (field: {
    id: string;
    'aria-invalid': boolean | undefined;
    'aria-describedby': string | undefined;
  }) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div data-slot="form-field" className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="font-medium text-base">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-muted-foreground text-sm">
          {hint}
        </p>
      )}
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error && (
        <p id={errorId} className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

/** Mehrfachauswahl als Liste von Checkboxen, ohne aufklappende Liste (PLT-10). */
function CheckboxGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { value: T; label: string }[];
  value: T[];
  onChange: (value: T[]) => void;
}) {
  const id = useId();
  return (
    <fieldset data-slot="checkbox-group" className="flex flex-col gap-1">
      <legend className="mb-2 font-medium text-base">{legend}</legend>
      {options.map((option) => {
        const optionId = `${id}-${option.value}`;
        const checked = value.includes(option.value);
        return (
          <div key={option.value} className="flex min-h-11 items-center gap-3">
            <Checkbox
              id={optionId}
              checked={checked}
              onCheckedChange={(next) =>
                onChange(
                  next === true
                    ? [...value, option.value]
                    : value.filter((entry) => entry !== option.value),
                )
              }
            />
            <label htmlFor={optionId} className="text-base">
              {option.label}
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}

/** Speichern und Abbrechen unten auf einer Formularseite; beides führt zur vorigen Seite (PLT-11). */
function FormActions({ children }: { children: React.ReactNode }) {
  return (
    <div data-slot="form-actions" className="flex flex-wrap justify-end gap-3 pt-2">
      {children}
    </div>
  );
}

export { CheckboxGroup, FormActions, FormField };
