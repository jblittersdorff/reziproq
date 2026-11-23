import { CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { defaultRenderLink, type RenderLink } from './nav-link';

export type ChainState = 'done' | 'current' | 'open';

export interface ChainStep {
  key: string;
  label: string;
  /** Ziel des Glieds; ohne Ziel oder ohne Recht erscheint das Glied grau und ohne Link */
  href?: string;
  state: ChainState;
  /** false: die Person darf den Schritt nicht sehen (UX-20) */
  allowed?: boolean;
}

/**
 * Kette der Schritte einer Funktion (UX-20 `ProcessChain`, Designsprache 2 „Schrittfolge“,
 * Vorlagen `PF-Konsolidieren.dc.html`, `A-Lieferant.dc.html`): weiße Gruppe, Kreise 26 px mit
 * Linie; erledigt Petrol mit Haken, aktuell Mint mit Tinte-Rand und fettem Text, offen grau.
 * Jedes Glied ist ein Link; ein Schritt ohne Recht ist grau und ohne Link. Auch die Schrittfolge
 * mit vier Phasen im Überblick nutzt diese Kette.
 */
function ProcessChain({
  label,
  steps,
  stateLabels,
  renderLink = defaultRenderLink,
  className,
}: {
  /** z. B. „Ablauf Segmentierung“; steht als Abschnittslabel und für Screenreader */
  label: string;
  steps: ChainStep[];
  /** Zustände für Screenreader in der Sprache der Seite, z. B. erledigt, jetzt, offen */
  stateLabels: Record<ChainState, string>;
  renderLink?: RenderLink;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      data-slot="process-chain"
      className={cn('flex min-w-0 flex-col gap-2', className)}
    >
      <span className="px-1 font-semibold text-input-border text-sm uppercase tracking-label">
        {label}
      </span>
      <ol className="flex items-start gap-1.5 overflow-x-auto rounded-md bg-card p-3.5">
        {steps.map((step, index) => {
          const allowed = step.allowed !== false;
          const state = allowed ? step.state : 'open';
          const circle = (
            <span
              aria-hidden
              className={cn(
                'flex size-6.5 items-center justify-center rounded-full font-display font-semibold text-chip',
                state === 'done' && 'bg-petrol text-primary-foreground',
                state === 'current' && 'bg-mint text-ink ring-3 ring-ink',
                state === 'open' && 'bg-line-soft text-input-border',
              )}
            >
              {state === 'done' ? <CheckIcon className="size-3.5" /> : index + 1}
            </span>
          );
          const text = (
            <span
              className={cn(
                // Lange Wörter auf dem Telefon trennen statt in die Nachbarn zu laufen
                'w-full hyphens-auto text-center text-chip [overflow-wrap:anywhere]',
                state === 'current' ? 'font-bold text-ink' : 'text-input-border',
              )}
            >
              {step.label}
              <span className="sr-only">{` · ${stateLabels[state]}`}</span>
            </span>
          );
          const content = (
            <>
              {circle}
              {text}
            </>
          );
          const item = 'flex min-h-11 min-w-11 flex-1 flex-col items-center gap-1.5';
          return (
            <li
              key={step.key}
              data-state={state}
              aria-current={state === 'current' ? 'step' : undefined}
              className="flex min-w-0 flex-1 items-start gap-1.5"
            >
              {index > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    'mt-3 h-0.5 min-w-2 flex-1 rounded-full',
                    steps[index - 1]?.state === 'done' && state !== 'open'
                      ? 'bg-petrol'
                      : 'bg-sidebar-line',
                  )}
                />
              )}
              {allowed && step.href ? (
                renderLink({
                  href: step.href,
                  className: cn(
                    item,
                    'rounded-nav no-underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  ),
                  children: content,
                })
              ) : (
                <span data-slot="chain-step-locked" className={item}>
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { ProcessChain };
