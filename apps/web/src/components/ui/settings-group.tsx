import type * as React from 'react';

import { cn } from '@/lib/utils';

/** Formulargruppe wie in den macOS-Einstellungen: Zeilen mit Beschriftung links, Feld rechts. */
function SettingsGroup({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn('flex flex-col gap-2', className)}>
      {title && <legend className="mb-2 px-4 font-semibold text-sm">{title}</legend>}
      <div className="divide-y divide-border rounded-lg bg-muted">{children}</div>
    </fieldset>
  );
}

function SettingsRow({
  label,
  description,
  htmlFor,
  children,
}: {
  label: string;
  description?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex flex-col">
        <label htmlFor={htmlFor} className="text-base">
          {label}
        </label>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      <div className="flex shrink-0 sm:w-64 sm:justify-end">{children}</div>
    </div>
  );
}

export { SettingsGroup, SettingsRow };
