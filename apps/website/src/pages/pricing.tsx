import { ArrowRightIcon, CheckIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { Range } from '@/components/ui/range';
import { cn } from '@/lib/utils';
import {
  Body,
  CardTitle,
  Eyebrow,
  Faq,
  Heading,
  LinkPill,
  NumberCircle,
  PageHero,
  Section,
  SectionHead,
  Wrap,
} from '../components/site';
import { useSite } from '../i18n';
import { formatEuro, formatEuroShort, formatPercent, formatRatio, priceYear } from '../pricing';

// WEB-01, Seite „Preise“ nach Vorlage Pricing: zwei Preise, was als Wert zählt, drei Beispiele,
// Rechner, sechs Regeln, Pilot, häufige Fragen. Der Rechner rechnet in Cent (pricing.ts).

function PriceCard({
  number,
  ink,
  name,
  price,
  unit,
  items,
}: {
  number: number;
  ink: boolean;
  name: string;
  price: string;
  unit: string;
  items: string[];
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-site p-8',
        ink ? 'bg-ink text-on-dark' : 'bg-card ring-2 ring-petrol',
      )}
    >
      <span
        className={cn(
          'flex items-center gap-2.5 font-semibold text-sm',
          ink ? 'text-mint' : 'text-petrol-dark',
        )}
      >
        <NumberCircle accent={ink}>{number}</NumberCircle>
        {name}
      </span>
      <span
        className={cn(
          'font-display font-semibold text-site-figure tracking-title-lg',
          ink ? 'text-on-dark' : 'text-ink',
        )}
      >
        {price}
      </span>
      <span className={cn('text-base', ink ? 'text-on-dark-muted' : 'text-muted-strong')}>
        {unit}
      </span>
      <ul className="mt-2 flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-base">
            <CheckIcon
              aria-hidden
              className={cn('mt-0.5 size-5 shrink-0', ink ? 'text-mint' : 'text-petrol')}
            />
            <span className={ink ? 'text-on-dark' : 'text-text'}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Slider({
  label,
  display,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  display: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className="font-semibold text-base text-ink">
          {label}
        </label>
        <output htmlFor={id} className="font-display font-semibold text-ink text-xl tabular-nums">
          {display}
        </output>
      </div>
      <Range
        id={id}
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={display}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

/** Voreinstellung wie das mittlere Beispiel „Wachsend“ */
export const calculatorStart = { relationships: 50, ebitEuro: 10_000_000, capitalEuro: 20_000_000 };

export function Calculator() {
  const { text, locale } = useSite();
  const calc = text.pricing.calculator;
  const [relationships, setRelationships] = useState(calculatorStart.relationships);
  const [ebitEuro, setEbit] = useState(calculatorStart.ebitEuro);
  const [capitalEuro, setCapital] = useState(calculatorStart.capitalEuro);
  const result = priceYear({
    relationships,
    ebitCents: ebitEuro * 100,
    capitalCents: capitalEuro * 100,
  });
  const rows: [string, number, boolean][] = [
    [calc.value, result.valueCents, false],
    [calc.fees, result.feesCents, false],
    [calc.share, result.shareCents, false],
  ];
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(96),100%),1fr))] items-start gap-5">
      <div className="flex flex-col gap-6 rounded-site bg-background p-7">
        <Slider
          label={calc.relationships}
          display={String(relationships)}
          value={relationships}
          min={10}
          max={200}
          step={5}
          onChange={setRelationships}
        />
        <Slider
          label={calc.ebit}
          display={formatEuroShort(ebitEuro * 100, locale)}
          value={ebitEuro}
          min={0}
          max={120_000_000}
          step={500_000}
          onChange={setEbit}
        />
        <Slider
          label={calc.capital}
          display={formatEuroShort(capitalEuro * 100, locale)}
          value={capitalEuro}
          min={0}
          max={200_000_000}
          step={1_000_000}
          onChange={setCapital}
        />
        <ul className="grid grid-cols-3 gap-2.5">
          {calc.tiers.map((tier) => (
            <li key={tier.name} className="flex flex-col gap-1 rounded-lg bg-card px-3.5 py-3">
              <span className="text-muted-strong text-sm">{tier.name}</span>
              <strong className="font-display font-semibold text-ink text-xl">{tier.rate}</strong>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col rounded-site bg-card p-7 shadow-card" aria-live="polite">
        <dl className="flex flex-col">
          {rows.map(([label, cents], index) => (
            <div
              key={label}
              className={cn(
                'flex items-baseline justify-between gap-4 py-3.5',
                index > 0 && 'border-line-soft border-t',
              )}
            >
              <dt className="text-base text-muted-strong">{label}</dt>
              <dd className="font-semibold text-ink tabular-nums">{formatEuro(cents, locale)}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 border-ink border-t-2 py-3.5">
            <dt className="font-semibold text-base text-ink">{calc.pay}</dt>
            <dd className="font-semibold text-ink tabular-nums">
              {formatEuro(result.payCents, locale)}
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-line-soft border-t py-3.5">
            <dt className="font-semibold text-base text-ink">{calc.keep}</dt>
            <dd className="font-display font-semibold text-petrol text-xl tabular-nums sm:text-2xl">
              {formatEuro(result.keepCents, locale)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 rounded-lg bg-mint-soft px-4 py-3 text-base text-petrol-dark">
          {calc.summary(
            result.payPercent === null ? '–' : formatPercent(result.payPercent, locale),
            result.returnPerEuro === null ? '–' : formatRatio(result.returnPerEuro, locale),
          )}
        </p>
      </div>
    </div>
  );
}

export function PricingPage() {
  const { text, href } = useSite();
  const page = text.pricing;
  const kindTones = [
    'bg-card ring-2 ring-petrol',
    'bg-card ring-2 ring-mint',
    'bg-background ring-1 ring-line',
  ];
  return (
    <>
      <PageHero eyebrow={page.eyebrow} title={page.title} lead={page.lead} />

      <section className="pb-site-section">
        <Wrap className="flex flex-col gap-5">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(96),100%),1fr))] gap-5">
            <PriceCard number={1} ink={false} {...page.use} />
            <PriceCard number={2} ink {...page.success} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-mint-soft px-6 py-4.5">
            <span className="font-semibold text-base text-petrol-dark">{page.free}</span>
            <LinkPill href={href('suppliers')} variant="link" size="default" className="px-0">
              {page.forSuppliers}
              <ArrowRightIcon aria-hidden />
            </LinkPill>
          </div>
        </Wrap>
      </section>

      <Section tone="card">
        <Wrap className="flex flex-col gap-10">
          <SectionHead
            eyebrow={page.counts.eyebrow}
            title={page.counts.title}
            lead={page.counts.lead}
          />
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(68),100%),1fr))] gap-5">
            {page.counts.kinds.map((kind, index) => {
              const counted = index < 2;
              return (
                <li
                  key={kind.name}
                  className={cn('flex flex-col gap-3 rounded-site p-7', kindTones[index])}
                >
                  <span
                    className={cn(
                      'font-semibold text-sm',
                      counted ? 'text-petrol-dark' : 'text-muted-foreground',
                    )}
                  >
                    {kind.name}
                  </span>
                  <span
                    className={cn(
                      'font-display font-semibold text-site-figure tracking-title-lg',
                      counted ? 'text-ink' : 'text-muted-foreground',
                    )}
                  >
                    {kind.share}
                  </span>
                  <span className="text-base text-muted-strong">{kind.rule}</span>
                  <span
                    className={cn(
                      'mt-2 rounded-lg px-4 py-3 text-sm',
                      counted ? 'bg-background' : 'bg-card',
                    )}
                  >
                    {kind.example} → <strong>{kind.result}</strong>
                  </span>
                </li>
              );
            })}
          </ul>
          <Body className="max-w-3xl">{page.counts.note}</Body>
        </Wrap>
      </Section>

      <Section>
        <Wrap className="flex flex-col gap-10">
          <SectionHead
            eyebrow={page.examples.eyebrow}
            title={page.examples.title}
            lead={page.examples.lead}
          />
          {/* Tabelle mit drei Zahlenspalten; auf dem Telefon scrollt nur die Tabelle, nie die Seite */}
          <section
            aria-label={page.examples.title}
            className="overflow-x-auto rounded-site bg-card shadow-card"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollbarer Bereich per Tastatur
            tabIndex={0}
          >
            <table className="w-full min-w-150 border-collapse text-left text-base">
              <thead>
                <tr className="text-muted-foreground text-sm">
                  <td className="px-6 py-4" />
                  {page.examples.columns.map((column) => (
                    <th key={column} scope="col" className="px-6 py-4 text-right font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {page.examples.rows.map((row, index) => {
                  const [label, ...values] = row;
                  const pay = index === 6;
                  const keep = index === 7;
                  const value = index === 3;
                  return (
                    <tr
                      key={label}
                      className={cn(
                        'border-line-soft border-t',
                        pay && 'border-ink border-t-2 font-semibold text-ink',
                        keep && 'font-semibold text-petrol',
                        value && 'bg-mint-soft font-semibold text-ink',
                      )}
                    >
                      <th
                        scope="row"
                        className={cn(
                          'px-6 py-3',
                          pay || keep || value ? 'font-semibold' : 'font-normal',
                        )}
                      >
                        {label}
                      </th>
                      {values.map((cell, column) => (
                        <td
                          // biome-ignore lint/suspicious/noArrayIndexKey: feste Spalten
                          key={column}
                          className="px-6 py-3 text-right tabular-nums"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
          <Body>{page.examples.note}</Body>
        </Wrap>
      </Section>

      <Section tone="card" id="rechner">
        <Wrap className="flex flex-col gap-10">
          <SectionHead eyebrow={page.calculator.eyebrow} title={page.calculator.title} />
          <Calculator />
        </Wrap>
      </Section>

      <Section>
        <Wrap className="flex flex-col gap-10">
          <SectionHead eyebrow={page.rules.eyebrow} title={page.rules.title} />
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(68),100%),1fr))] gap-x-10 gap-y-8">
            {page.rules.items.map((rule) => (
              <li key={rule.title} className="flex flex-col gap-2 border-petrol border-t-2 pt-4">
                <CardTitle>{rule.title}</CardTitle>
                <Body>{rule.text}</Body>
              </li>
            ))}
          </ul>
        </Wrap>
      </Section>

      <section className="pb-site-section">
        <Wrap>
          <div className="flex flex-wrap items-center justify-between gap-x-12 gap-y-6 rounded-site-lg bg-ink p-8 text-on-dark sm:p-12">
            <div className="flex min-w-0 flex-1 basis-105 flex-col gap-2.5">
              <Eyebrow onDark>{page.pilot.title}</Eyebrow>
              <Heading onDark as="h2">
                {page.pilot.text}
              </Heading>
              <span className="text-base text-on-dark-muted">{page.pilot.detail}</span>
            </div>
            <LinkPill href={href('pilot')} variant="mint">
              {page.pilot.link}
            </LinkPill>
          </div>
        </Wrap>
      </section>

      <section className="pb-site-section">
        <Wrap className="flex flex-wrap gap-x-16 gap-y-12">
          <div className="flex min-w-0 flex-1 basis-75 flex-col gap-5">
            <Eyebrow>{page.faq.eyebrow}</Eyebrow>
            <Heading>{page.faq.title}</Heading>
            <LinkPill href={href('contact')} className="self-start">
              {text.common.talk}
            </LinkPill>
          </div>
          <div className="min-w-0 flex-[1.6] basis-130">
            <Faq items={page.faq.items} />
          </div>
        </Wrap>
      </section>
    </>
  );
}
