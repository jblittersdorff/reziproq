import { PlusIcon, XIcon } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';

export interface RowsEditorColumn {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'month' | 'select';
  options?: { value: string; label: string }[];
  /** Anteil der Breite ab Tablet: 1 schmal, 2 normal, 3 breit */
  span?: 1 | 2 | 3;
}

type Row = Record<string, string>;

/**
 * Zeilen pflegen (WG-07): je Zeile die Felder nebeneinander, auf Telefonbreite untereinander, dazu
 * „Entfernen“ je Zeile und „Hinzufügen“ darunter. Werte sind Text; das Formular wandelt sie um.
 */
function RowsEditor({
  legend,
  columns,
  rows,
  onChange,
  addLabel,
  removeLabel,
  max = 20,
  className,
}: {
  legend: string;
  columns: RowsEditorColumn[];
  rows: Row[];
  onChange: (rows: Row[]) => void;
  addLabel: string;
  removeLabel: (index: number) => string;
  max?: number;
  className?: string;
}) {
  const id = useId();
  const empty = () => Object.fromEntries(columns.map((column) => [column.key, '']));
  const set = (index: number, key: string, value: string) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  const spans = { 1: 'sm:col-span-1', 2: 'sm:col-span-2', 3: 'sm:col-span-3' } as const;
  return (
    <fieldset className={cn('flex flex-col gap-3', className)}>
      <legend className="mb-1 font-semibold text-sm">{legend}</legend>
      {rows.map((row, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: Zeilen haben keine eigene Id
          key={index}
          className="grid grid-cols-1 items-end gap-2 rounded-lg bg-paper p-3 sm:grid-cols-6"
        >
          {columns.map((column) => {
            const fieldId = `${id}-${index}-${column.key}`;
            return (
              <div
                key={column.key}
                className={cn('flex min-w-0 flex-col gap-1', spans[column.span ?? 2])}
              >
                <label htmlFor={fieldId} className="text-muted-foreground text-xs">
                  {column.label}
                </label>
                {column.type === 'select' ? (
                  <NativeSelect
                    id={fieldId}
                    value={row[column.key] ?? ''}
                    onChange={(event) => set(index, column.key, event.target.value)}
                  >
                    <option value="" />
                    {column.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <Input
                    id={fieldId}
                    type={
                      column.type === 'number'
                        ? 'number'
                        : column.type === 'month'
                          ? 'month'
                          : 'text'
                    }
                    step={column.type === 'number' ? 'any' : undefined}
                    value={row[column.key] ?? ''}
                    onChange={(event) => set(index, column.key, event.target.value)}
                  />
                )}
              </div>
            );
          })}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={removeLabel(index)}
            className="justify-self-start sm:col-span-6"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            <XIcon aria-hidden />
            {removeLabel(index)}
          </Button>
        </div>
      ))}
      {rows.length < max && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => onChange([...rows, empty()])}
        >
          <PlusIcon aria-hidden />
          {addLabel}
        </Button>
      )}
    </fieldset>
  );
}

export { RowsEditor };
