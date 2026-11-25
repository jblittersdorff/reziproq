import type * as React from 'react';
import { cn } from '@/lib/utils';
import { defaultRenderLink, type RenderLink } from './nav-link';

/** Ziel ohne Inhalt oder nur „#“: eine Karte „Als Nächstes“ ohne Ziel ist ein Fehler (UX-20). */
export function assertNextTarget(href: string | undefined): asserts href is string {
  if (!href || href.trim() === '' || href.trim() === '#') {
    throw new Error('NextCard braucht ein Ziel: ein Hauptknopf ohne Ziel ist eine Sackgasse.');
  }
}

/**
 * „Als Nächstes“ (UX-20 `NextCard`, Designsprache 2, Vorlage `Main.dc.html`): Tinte-Karte mit
 * Kurzzeile in Mint, Titel, höchstens einem Satz, genau einem Mint-Knopf mit Ziel und höchstens
 * einem Zweitknopf (`secondary`, z. B. „Morgen erinnern“ als Button variant="dark"). Auf dem
 * Telefon sind die Knöpfe so breit wie die Karte; in Prozessschritten (`sticky`) steht die Karte
 * unten fest über der Tab-Leiste. Ohne Ziel wirft die Karte einen Fehler.
 */
function NextCard({
  kicker,
  title,
  text,
  action,
  secondary,
  sticky = false,
  headingAs: Heading = 'h2',
  renderLink = defaultRenderLink,
  className,
}: {
  /** z. B. „Als Nächstes · überfällig seit 2 Tagen · 2 Min.“ */
  kicker: React.ReactNode;
  title: React.ReactNode;
  text?: React.ReactNode;
  /** `ariaLabel`, wenn der Text allein das Ziel nicht nennt (z. B. „Öffnen“) */
  action: { label: string; href: string; ariaLabel?: string };
  /** Höchstens ein Zweitknopf neben dem Hauptknopf */
  secondary?: React.ReactNode;
  sticky?: boolean;
  headingAs?: 'h2' | 'h3';
  renderLink?: RenderLink;
  className?: string;
}) {
  assertNextTarget(action.href);
  const primary = renderLink({
    href: action.href,
    ...(action.ariaLabel ? { 'aria-label': action.ariaLabel } : {}),
    className:
      'flex min-h-13 w-full items-center justify-center rounded-md bg-mint px-7 font-semibold text-ink text-lg no-underline hover:bg-mint/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-mint/60 shell:w-auto',
    children: action.label,
  });
  const card = (
    <section
      data-slot="next-card"
      data-href={action.href}
      className={cn(
        // Vorlage Main: Kurzzeile, Titel und Satz untereinander, darunter die Knöpfe
        'flex flex-col gap-3 rounded-xl bg-ink p-5 text-on-dark shell:p-6',
        className,
      )}
    >
      <span className="font-semibold text-mint text-sm">{kicker}</span>
      <Heading className="text-balance font-display font-semibold text-section tracking-section">
        {title}
      </Heading>
      {text && <p className="text-base text-on-dark-muted leading-relaxed">{text}</p>}
      <div className="flex flex-col gap-2.5 pt-1 shell:flex-row shell:flex-wrap shell:items-center">
        {primary}
        {secondary}
      </div>
    </section>
  );
  if (!sticky) return card;
  // In Prozessschritten steht die Karte auf dem Telefon fest über der Tab-Leiste.
  return (
    <div
      data-slot="next-card-sticky"
      className="sticky bottom-23 z-10 bg-background pt-3 shell:static shell:p-0"
    >
      {card}
    </div>
  );
}

export { NextCard };
