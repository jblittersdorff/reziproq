import { ChevronRightIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { defaultRenderLink, type RenderLink } from './nav-link';
import type { ChainState } from './process-chain';

/**
 * Ablauf-Leiste (UX-20 `FlowBar`, NAV-10 Ablauf 13, Vorlage `Flow.dc.html`): weiße Gruppe mit
 * Titel, „Schritt n von m“, Zurück und Weiter als Zweitknöpfe, alle Schritte als Kreise mit
 * Linie und die Zeile „Fertig, wenn …“. Die Hauptaktion steht in der Karte „Als Nächstes“.
 */
function FlowBar({
  title,
  stepLabel,
  context,
  prev,
  next,
  steps,
  doneWhenLabel,
  doneWhen,
  renderLink = defaultRenderLink,
}: {
  title: string;
  /** z. B. „Schritt 2 von 6“ */
  stepLabel: string;
  context?: string;
  prev?: { label: string; href: string };
  next?: { label: string; href: string };
  steps: { key: string; label: string; href: string; state: ChainState; stateLabel: string }[];
  doneWhenLabel: string;
  doneWhen: string;
  renderLink?: RenderLink;
}) {
  return (
    <section
      aria-label={title}
      data-slot="flow-bar"
      className="flex min-w-0 flex-col gap-4.5 rounded-md bg-card px-5 py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <strong className="font-display font-semibold text-flow">{title}</strong>
          <span className="text-muted-foreground text-sm">
            {stepLabel}
            {context ? ` · ${context}` : ''}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {prev &&
            renderLink({
              href: prev.href,
              className:
                'inline-flex min-h-11 items-center rounded-full px-4 font-semibold text-detail text-muted-strong no-underline hover:text-ink',
              children: prev.label,
            })}
          {next &&
            renderLink({
              href: next.href,
              className:
                'inline-flex min-h-11 items-center gap-2 rounded-full bg-control px-4.5 font-semibold text-detail text-ink no-underline hover:bg-line',
              children: (
                <>
                  {next.label}
                  <ChevronRightIcon aria-hidden className="size-4" />
                </>
              ),
            })}
        </div>
      </div>
      <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(24)),1fr))] gap-y-3.5">
        {steps.map((step, index) => (
          <li
            key={step.key}
            data-state={step.state}
            aria-current={step.state === 'current' ? 'step' : undefined}
          >
            {renderLink({
              href: step.href,
              className: 'flex min-h-11 flex-col gap-2 text-text no-underline',
              children: (
                <>
                  <span className="flex items-center">
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full font-display font-semibold text-sm',
                        step.state === 'done' && 'bg-petrol text-primary-foreground',
                        step.state === 'current' && 'bg-mint text-ink ring-3 ring-ink',
                        step.state === 'open' &&
                          'border-2 border-ring-open bg-card text-input-border',
                      )}
                    >
                      {index + 1}
                    </span>
                    {index < steps.length - 1 && (
                      <span
                        aria-hidden
                        className={cn(
                          'h-0.5 flex-1 rounded-full',
                          step.state === 'done' ? 'bg-petrol' : 'bg-sidebar-line',
                        )}
                      />
                    )}
                  </span>
                  <span
                    className={cn(
                      'text-detail',
                      step.state === 'current' ? 'font-bold text-ink' : 'font-medium',
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="text-chip text-muted-foreground">{step.stateLabel}</span>
                </>
              ),
            })}
          </li>
        ))}
      </ol>
      <p className="rounded-md bg-paper px-4 py-3 text-detail leading-relaxed">
        <strong className="font-semibold">{doneWhenLabel}</strong> {doneWhen}
      </p>
    </section>
  );
}

export { FlowBar };
