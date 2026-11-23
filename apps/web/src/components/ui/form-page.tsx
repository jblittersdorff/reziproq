import type * as React from 'react';
import { cn } from '@/lib/utils';
import { defaultRenderLink, type RenderLink } from './nav-link';

/**
 * Formularseite (UX-20 `FormPage`, Designsprache 2, Vorlage `B-Einladen.dc.html`): Felder in
 * weißen Gruppen, unten genau ein Hauptknopf (Petrol, Speichern oder Senden) und höchstens ein
 * Zweitknopf (grau). Formulare haben keine Karte „Als Nächstes“; der Hauptknopf ist ihre
 * Hauptaktion.
 */
function FormPage({
  label,
  onSubmit,
  primary,
  secondary,
  busy = false,
  renderLink = defaultRenderLink,
  className,
  children,
}: {
  /** Name des Formulars für Screenreader */
  label: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  primary: string;
  /** Abbrechen o. Ä.: als Link oder als Knopf */
  secondary?: { label: string; href: string } | { label: string; onClick: () => void };
  busy?: boolean;
  renderLink?: RenderLink;
  className?: string;
  children: React.ReactNode;
}) {
  const secondaryClass =
    'inline-flex min-h-11 items-center justify-center rounded-full bg-control px-5 font-semibold text-base text-ink no-underline hover:bg-line focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50';
  return (
    <form
      aria-label={label}
      data-slot="form-page"
      className={cn('flex flex-col gap-5.5', className)}
      onSubmit={onSubmit}
    >
      {children}
      <div className="flex flex-col-reverse gap-2.5 shell:flex-row shell:justify-end">
        {secondary &&
          ('href' in secondary ? (
            renderLink({
              href: secondary.href,
              className: secondaryClass,
              children: secondary.label,
            })
          ) : (
            <button type="button" className={secondaryClass} onClick={secondary.onClick}>
              {secondary.label}
            </button>
          ))}
        <button
          type="submit"
          disabled={busy}
          data-slot="form-primary"
          className="inline-flex min-h-13 items-center justify-center rounded-full bg-petrol px-7 font-semibold text-lg text-primary-foreground hover:bg-petrol-dark focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
        >
          {primary}
        </button>
      </div>
    </form>
  );
}

/** Weiße Gruppe für Felder einer Formularseite, optional mit Abschnittslabel */
function FormGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      {label && (
        <legend className="mb-2 px-1 font-semibold text-input-border text-sm uppercase tracking-label">
          {label}
        </legend>
      )}
      <div className="flex flex-col gap-4 rounded-lg bg-card p-5">{children}</div>
    </fieldset>
  );
}

export { FormGroup, FormPage };
