import { GoalRings } from '@/components/ui/goal-rings';
import {
  EvidenceCard,
  EvidenceRow,
  InsightHeading,
  QuestionSuggestions,
  RankedBars,
} from '@/components/ui/insight';
import { ListCard } from '@/components/ui/list-card';
import { defineMessages, useLocale, useMessages } from '@/lib/i18n';

const messages = defineMessages({
  de: {
    attribution: 'Zusammengefasst von Reziproq',
    headline: (share: string) => `Das Jahresziel ist zu ${share} erreicht.`,
    explanation:
      'Die Rechnung umfasst die vom Controlling bestätigten EBIT-Ergebnisse. Die Beziehungen zeigen, wie viele Fokuslieferanten einen freigegebenen gemeinsamen Plan haben.',
    ledger: 'Impact-Ledger',
    plans: 'Gemeinsame Pläne',
    coverageTitle: (count: number, total: number) =>
      `${count} von ${total} Fokuslieferanten haben einen freigegebenen Plan.`,
    result: 'Gesichertes EBIT',
    relationships: 'Fokuslieferanten mit Plan',
    amount: (value: string) => `${value} T€`,
    moneyRatio: (a: number, b: number) => `${a} von ${b} T€`,
    ratio: (actual: number, target: number) => `${actual} von ${target}`,
    source: 'Beispieldaten · Jahresabschluss 2026',
    gap: 'Bis zum Jahresziel',
    gapDetail: 'Differenz zum bestätigten EBIT',
    questions: 'Mehr wissen? Frag Reziproq',
    breakdown: 'Wie setzt sich das Ergebnis zusammen?',
    remaining: 'Was fehlt zum Ziel?',
    coverage: 'Wie viele Pläne fehlen?',
    details: 'Rechenweg ansehen',
    suppliers: ['Guss', 'Elektronik', 'Kunststoff'],
    rank: (value: string) => `Guss trägt mit ${value} am meisten bei.`,
    gapAnswer: (value: string) => `Bis zum Jahresziel fehlen ${value}.`,
    plansAnswer: (count: number) => `Für ${count} Fokuslieferanten steht die Freigabe noch aus.`,
  },
  en: {
    attribution: 'Summarised by Reziproq',
    headline: (share: string) => `Confirmed results reach ${share} of the annual target.`,
    explanation:
      'The calculation includes EBIT results confirmed by Controlling. The relationship measure counts focus suppliers with an approved joint plan.',
    ledger: 'Impact ledger',
    plans: 'Joint business plans',
    coverageTitle: (count: number, total: number) =>
      `${count} of ${total} focus suppliers have an approved plan.`,
    result: 'Confirmed EBIT',
    relationships: 'Focus suppliers with a plan',
    amount: (value: string) => `€${value}k`,
    moneyRatio: (a: number, b: number) => `€${a}k of €${b}k`,
    ratio: (actual: number, target: number) => `${actual} of ${target}`,
    source: 'Example data · Year-end 2026',
    gap: 'Remaining to target',
    gapDetail: 'Annual target less confirmed EBIT',
    questions: 'Ask Reziproq',
    breakdown: 'What makes up the result?',
    remaining: 'How much remains?',
    coverage: 'How many plans still need approval?',
    details: 'View calculation',
    suppliers: ['Castings', 'Electronics', 'Plastics'],
    rank: (value: string) => `Castings contribute the most at ${value}.`,
    gapAnswer: (value: string) => `${value} remains to reach the annual target.`,
    plansAnswer: (count: number) => `Plans for ${count} focus suppliers still need approval.`,
  },
});

export function InsightExample() {
  const t = useMessages(messages);
  const { locale } = useLocale();
  const amounts = [180, 144, 88] as const;
  const confirmed = amounts.reduce((sum, value) => sum + value, 0);
  const target = 600;
  const approved = 9;
  const focusSuppliers = 12;
  const number = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: 'percent' }).format(confirmed / target);
  const gap = t.amount(number.format(target - confirmed));
  const questions = [
    { label: t.breakdown, href: '#design-breakdown' },
    { label: t.remaining, href: '#design-gap' },
    { label: t.coverage, href: '#design-plans' },
  ];
  return (
    <div className="flex flex-col gap-6 rounded-lg bg-paper p-4 sm:p-8">
      <InsightHeading
        attribution={t.attribution}
        headline={t.headline(percent)}
        explanation={t.explanation}
        sources={[
          { key: 'ledger', label: t.ledger, href: '#design-breakdown' },
          { key: 'plans', label: t.plans, href: '#design-plans' },
        ]}
      />
      <EvidenceCard title={t.coverageTitle(approved, focusSuppliers)} source={t.source}>
        <GoalRings
          result={{
            label: `${t.result} · ${percent}`,
            actual: confirmed,
            target,
            format: (value, goal) =>
              goal === null ? t.amount(number.format(value)) : t.moneyRatio(value, goal),
          }}
          relationships={{
            label: t.relationships,
            actual: approved,
            target: focusSuppliers,
            format: (value, goal) => (goal === null ? number.format(value) : t.ratio(value, goal)),
          }}
        />
      </EvidenceCard>
      <ListCard aria-label={t.gap}>
        <EvidenceRow href="#design-gap" title={t.gap} detail={t.gapDetail} value={gap} />
      </ListCard>
      <QuestionSuggestions title={t.questions} questions={questions} />
      <details className="rounded-lg bg-card p-4">
        <summary className="w-fit cursor-pointer rounded-full px-3 py-3 font-semibold text-petrol-dark focus-visible:outline-ring">
          {t.details}
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          <div id="design-breakdown" tabIndex={-1}>
            <EvidenceCard title={t.rank(t.amount(number.format(amounts[0])))} source={t.source}>
              <RankedBars
                rows={t.suppliers.map((label, index) => ({ label, value: amounts[index] ?? 0 }))}
                format={(value) => t.amount(number.format(value))}
              />
            </EvidenceCard>
          </div>
          <p id="design-gap" tabIndex={-1}>
            {t.gapAnswer(gap)}
          </p>
          <div id="design-plans" tabIndex={-1}>
            <GoalRings
              result={{
                label: t.plansAnswer(focusSuppliers - approved),
                actual: approved,
                target: focusSuppliers,
                format: (value, goal) =>
                  goal === null ? number.format(value) : t.ratio(value, goal),
              }}
            />
          </div>
        </div>
      </details>
    </div>
  );
}
