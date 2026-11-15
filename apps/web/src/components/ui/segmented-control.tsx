import { useId } from 'react';

import { cn } from '@/lib/utils';

/**
 * Schalter der Designsprache aus echten Radio-Knöpfen: Pillen auf line-soft, die aktive weiß mit
 * Schatten. Tab springt hinein, Pfeiltasten wählen.
 */
function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={cn('inline-flex flex-wrap rounded-full bg-line-soft p-1', className)}>
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="relative flex min-h-11 cursor-pointer items-center rounded-full px-4 font-semibold text-muted-strong text-sm transition-colors has-checked:bg-card has-checked:text-ink has-checked:shadow-toggle has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
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
