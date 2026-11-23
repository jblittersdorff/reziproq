import { ChevronRightIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';
import { defaultRenderLink, type RenderLink } from './nav-link';

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
      <div className="divide-y divide-line-soft overflow-hidden rounded-lg bg-card shadow-card">
        {children}
      </div>
    </fieldset>
  );
}

function SettingsRow({
  label,
  description,
  htmlFor,
  wide = false,
  children,
}: {
  label: string;
  description?: string;
  htmlFor?: string;
  /** Breitere rechte Spalte, z. B. für zwei Auswahlfelder nebeneinander (IN-06) */
  wide?: boolean;
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
      <div className={cn('flex shrink-0 sm:justify-end', wide ? 'sm:w-96' : 'sm:w-64')}>
        {children}
      </div>
    </div>
  );
}

/**
 * Zeile, die zu einer eigenen Seite führt (NAV-02), z. B. Profil › Erscheinungsbild. Zeigt rechts
 * den aktuellen Wert und einen Pfeil; die ganze Zeile ist klickbar.
 */
function SettingsLinkRow({
  href,
  label,
  description,
  value,
  icon,
  renderLink = defaultRenderLink,
}: {
  href: string;
  label: string;
  description?: string;
  value?: string;
  icon?: React.ReactNode;
  renderLink?: RenderLink;
}) {
  return renderLink({
    href,
    className:
      'flex min-h-11 items-center gap-3 px-4 py-3 transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-paper focus-visible:relative focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-5 [&_svg]:shrink-0',
    children: (
      <>
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="flex flex-1 flex-col">
          <span className="text-base">{label}</span>
          {description && <span className="text-muted-foreground text-sm">{description}</span>}
        </span>
        {value && <span className="text-muted-foreground">{value}</span>}
        <ChevronRightIcon className="text-muted-foreground" aria-hidden />
      </>
    ),
  });
}

export { SettingsGroup, SettingsLinkRow, SettingsRow };
