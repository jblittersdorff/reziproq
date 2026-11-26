import type { Hint } from '@reziproq/shared';
import { ChartCard, ChartFigures } from '@/components/ui/chart-card';
import { NextCard } from '@/components/ui/next-card';
import { ProcessChain } from '@/components/ui/process-chain';
import { SoWhat, type SoWhatTone } from '@/components/ui/so-what';
import { routerLink } from '@/features/shell/navigation';
import { defineMessages, useMessages, useT } from '@/lib/i18n';
import { isActive, useHintWhy } from './hint-panel';

const messages = defineMessages({
  de: {
    chain: 'Ablauf Aufgabe',
    steps: ['Anlass', 'Anlegen', 'Verfolgen'],
    states: { done: 'erledigt', current: 'jetzt', open: 'offen' },
    kicker: (severity: string) => `Als Nächstes · ${severity} Wirkung`,
    impact: { high: 'hohe', medium: 'mittlere', low: 'niedrige' },
    heading: 'Das Wichtigste',
    statement: (open: number, high: number, names: string) =>
      high === 0
        ? `${open} ${open === 1 ? 'Hinweis' : 'Hinweise'}, keiner mit hoher Wirkung.`
        : `${open} ${open === 1 ? 'Hinweis' : 'Hinweise'}, ${high} mit hoher Wirkung: ${names}.`,
    chips: { high: 'Hoch', medium: 'Mittel', low: 'Niedrig' },
    bySeverity: 'Nach Schwere',
    counts: (high: number, medium: number, low: number) =>
      `${high} hoch, ${medium} mittel, ${low} niedrig`,
    and: ' und ',
  },
  en: {
    chain: 'Task flow',
    steps: ['Trigger', 'Create', 'Follow up'],
    states: { done: 'done', current: 'now', open: 'open' },
    kicker: (severity: string) => `Up next · ${severity} impact`,
    impact: { high: 'high', medium: 'medium', low: 'low' },
    heading: 'What matters',
    statement: (open: number, high: number, names: string) =>
      high === 0
        ? `${open} ${open === 1 ? 'hint' : 'hints'}, none with high impact.`
        : `${open} ${open === 1 ? 'hint' : 'hints'}, ${high} with high impact: ${names}.`,
    chips: { high: 'High', medium: 'Medium', low: 'Low' },
    bySeverity: 'By severity',
    counts: (high: number, medium: number, low: number) =>
      `${high} high, ${medium} medium, ${low} low`,
    and: ' and ',
  },
});

const tones: Record<Hint['severity'], SoWhatTone> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
};

/**
 * Kopf der Hinweise (Vorlage `Hinweise.dc.html`): Ablauf Maßnahme, „Als Nächstes“ mit dem
 * offenen Hinweis mit der höchsten Wirkung und „Das Wichtigste“ mit Zählung nach Schwere. Alle
 * Zahlen kommen aus der Liste; nichts davon formuliert eine KI.
 */
export function HintsSummary({ hints }: { hints: Hint[] }) {
  const t = useT().hints;
  const text = useMessages(messages);
  const why = useHintWhy();
  const active = hints.filter(isActive);
  const [top] = active;
  if (!top) return null;
  const label = (hint: Hint) => [hint.supplier, hint.title ?? why(hint)].filter(Boolean).join(': ');
  const count = (severity: Hint['severity']) =>
    active.filter((hint) => hint.severity === severity).length;
  const high = active.filter((hint) => hint.severity === 'high');
  return (
    <>
      <ProcessChain
        label={text.chain}
        stateLabels={text.states}
        steps={text.steps.map((step, index) => ({
          key: step,
          label: step,
          state: index === 0 ? 'current' : 'open',
        }))}
      />
      <NextCard
        kicker={text.kicker(text.impact[top.severity])}
        title={label(top)}
        action={{ label: t.nextSteps[top.ruleKey] ?? t.fix, href: top.href }}
        renderLink={routerLink}
      />
      <SoWhat
        heading={text.heading}
        statement={text.statement(
          active.length,
          high.length,
          [...new Set(high.map((hint) => hint.supplier).filter(Boolean))]
            .slice(0, 2)
            .join(text.and),
        )}
        points={active.slice(0, 3).map((hint) => ({
          key: hint.id,
          status: text.chips[hint.severity],
          tone: tones[hint.severity],
          text: label(hint),
          href: `/warum/${hint.id}`,
        }))}
        aside={
          <ChartCard
            title={text.counts(count('high'), count('medium'), count('low'))}
            label={text.bySeverity}
          >
            <ChartFigures
              items={(['high', 'medium', 'low'] as const).map((severity) => ({
                key: severity,
                value: String(count(severity)),
                label: t.severities[severity],
              }))}
            />
          </ChartCard>
        }
        renderLink={routerLink}
      />
    </>
  );
}
