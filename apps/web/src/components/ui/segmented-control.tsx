import { useId } from 'react';

import { cn } from '@/lib/utils';

/** Umschalter aus echten Radio-Knöpfen: Tab springt hinein, Pfeiltasten wählen. */
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
    <fieldset className={cn('inline-flex rounded-md bg-secondary p-0.5', className)}>
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="relative cursor-pointer rounded-sm px-3 py-1 font-medium text-sm text-muted-foreground transition-colors has-checked:bg-background has-checked:text-foreground has-checked:shadow-xs has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
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
