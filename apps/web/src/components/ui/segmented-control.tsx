import { useId } from 'react';

import { cn } from '@/lib/utils';

/**
 * Schalter der Designsprache aus echten Radio-Knöpfen: Pillen auf line-soft, die aktive weiß mit
 * Schatten. Tab springt hinein, Pfeiltasten wählen. Eine Option mit `disabled` ist ausgegraut und
 * nicht wählbar (z. B. eine Stufe, die eine Aufgabe nicht erlaubt, Vorlage Mein-Agent); `disabled`
 * am Schalter macht ihn ganz schreibgeschützt.
 */
function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset
      disabled={disabled}
      className={cn('inline-flex flex-wrap rounded-full bg-line-soft p-1', className)}
    >
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="relative flex min-h-11 cursor-pointer items-center rounded-full px-4 font-semibold text-muted-strong text-sm transition-colors has-checked:bg-card has-checked:text-ink has-checked:shadow-toggle has-disabled:cursor-not-allowed has-[:disabled:not(:checked)]:opacity-50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}

export { SegmentedControl };
