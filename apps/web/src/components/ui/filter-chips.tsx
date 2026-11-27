import { cn } from '@/lib/utils';

export interface FilterChip<T extends string> {
  value: T;
  label: string;
  /** Zahl hinter dem Namen, z. B. „Meine · 6“ */
  count?: number;
}

const pill =
  'inline-flex min-h-11 items-center rounded-full px-3.5 font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50';
const on = 'bg-ink text-on-dark';
const off = 'bg-card text-muted-strong ring-1 ring-line ring-inset hover:bg-paper';

/**
 * Filter als Pillen (Vorlage Lieferanten): genau einer ist gewählt (Tinte), die übrigen weiß mit
 * Rand; je Pille Name und Zahl. `more` ist der Knopf „Mehr Filter“, der einen Bereich darunter
 * öffnet; mit gesetzten Filtern trägt er deren Zahl. Bedienflächen 44 px (Designsprache).
 */
function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
  more,
  className,
}: {
  /** Name der Gruppe für Screenreader, z. B. „Filter“ */
  label: string;
  options: FilterChip<T>[];
  value: T;
  onChange: (value: T) => void;
  more?: {
    label: string;
    expanded: boolean;
    /** Zahl der gesetzten weiteren Filter */
    active: number;
    onToggle: () => void;
    /** id des Bereichs, den der Knopf öffnet */
    controls: string;
  };
  className?: string;
}) {
  return (
    <fieldset
      data-slot="filter-chips"
      className={cn('m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0', className)}
    >
      <legend className="sr-only">{label}</legend>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            className={cn(pill, selected ? on : off)}
            onClick={() => onChange(option.value)}
          >
            {option.count === undefined ? option.label : `${option.label} · ${option.count}`}
          </button>
        );
      })}
      {more && (
        <button
          type="button"
          aria-expanded={more.expanded}
          aria-controls={more.controls}
          className={cn(pill, more.active > 0 ? on : off)}
          onClick={more.onToggle}
        >
          {more.active > 0 ? `${more.label} · ${more.active}` : more.label}
        </button>
      )}
    </fieldset>
  );
}

export { FilterChips };
