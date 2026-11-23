import { CheckIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { BrandMark } from '@/components/ui/brand-mark';
import { cn } from '@/lib/utils';
import {
  Actions,
  Body,
  Card,
  CardTitle,
  Chip,
  Eyebrow,
  FootNote,
  Heading,
  InkCallout,
  Lead,
  LinkPill,
  PageHero,
  RingsMark,
  Section,
  SectionHead,
  Split,
  Wrap,
} from '../components/site';
import { useSite } from '../i18n';

// WEB-01, Seite „Plattform“ nach Vorlage Platform: sechs Bereiche mit je einer Ansicht aus
// Beispieldaten, dazu Stack und Tinte-Karte. Kundenstimmen bleiben aus, bis es echte gibt.

function Points({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-base text-muted-strong">
          <CheckIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-petrol" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function Copy({
  eyebrow,
  title,
  lead,
  points,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  points?: string[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <Eyebrow>{eyebrow}</Eyebrow>
      <Heading>{title}</Heading>
      <Body>{lead}</Body>
      {points && <Points items={points} />}
    </div>
  );
}

function ViewTitle({ children }: { children: ReactNode }) {
  return <span className="font-display font-semibold text-ink text-lg">{children}</span>;
}

function Matrix() {
  const { text } = useSite();
  const seg = text.platform.segmentation;
  return (
    <Card className="gap-4.5 bg-background shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ViewTitle>{seg.matrix}</ViewTitle>
        <Chip>{seg.matrixNote}</Chip>
      </div>
      <div className="grid grid-cols-[--spacing(6)_minmax(0,1fr)] gap-2.5">
        <span className="rotate-180 text-center font-semibold text-chip text-muted-foreground [writing-mode:vertical-rl]">
          {seg.yAxis} →
        </span>
        <ul className="grid grid-cols-3 gap-1.5">
          {seg.grid.map((tags, index) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: feste Felder der Matrix
              key={index}
              className={cn(
                'flex min-h-24 flex-col items-start gap-1.5 rounded-md p-2.5',
                index === seg.focus ? 'bg-mint-soft' : 'bg-card',
              )}
            >
              {tags.map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    'max-w-full break-words rounded-full px-2 py-1 font-semibold text-chip sm:px-2.5',
                    index === seg.target
                      ? 'border-2 border-petrol border-dashed text-petrol-dark'
                      : 'bg-card text-text shadow-inset-line',
                  )}
                >
                  {tag}
                </span>
              ))}
            </li>
          ))}
        </ul>
        <span />
        <span className="text-center font-semibold text-chip text-muted-foreground">
          {seg.xAxis} →
        </span>
      </div>
      <FootNote>{seg.footnote}</FootNote>
    </Card>
  );
}

/** Position auf der Skala 1 bis 5 in Prozent */
const onScale = (value: number) => ((value - 1) / 4) * 100;

function PulseGaps() {
  const { text, locale } = useSite();
  const pulse = text.platform.pulse;
  const format = (value: number) =>
    value.toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  return (
    <Card className="gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ViewTitle>{pulse.chart}</ViewTitle>
        <Chip tone="neutral">{pulse.chartNote}</Chip>
      </div>
      <div className="flex flex-wrap gap-5 text-chip text-muted-strong">
        <span className="flex items-center gap-2">
          <span aria-hidden className="size-3.5 rounded-full bg-petrol" />
          {pulse.yours}
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden className="size-3.5 rounded-full border-2 border-ink bg-mint" />
          {pulse.theirs}
        </span>
      </div>
      <ul className="flex flex-col gap-3.5">
        {pulse.dimensions.map((dimension) => {
          const low = Math.min(dimension.yours, dimension.theirs);
          const high = Math.max(dimension.yours, dimension.theirs);
          return (
            <li
              key={dimension.name}
              className="grid grid-cols-[minmax(0,--spacing(28))_minmax(0,1fr)_--spacing(11)] items-center gap-3.5"
            >
              <span className="text-muted-strong text-sm">{dimension.name}</span>
              <span className="relative block h-7">
                <span className="absolute inset-x-0 top-3.25 h-0.5 bg-track" />
                <span
                  className="absolute top-3 h-1 bg-mint-line"
                  style={{ left: `${onScale(low)}%`, width: `${onScale(high) - onScale(low)}%` }}
                />
                <span
                  className="-ml-2 absolute top-1.5 size-4 rounded-full border-2 border-ink bg-mint"
                  style={{ left: `${onScale(dimension.theirs)}%` }}
                />
                <span
                  className="-ml-2 absolute top-1.5 size-4 rounded-full bg-petrol"
                  style={{ left: `${onScale(dimension.yours)}%` }}
                />
                <span className="sr-only">
                  {pulse.yours} {format(dimension.yours)}, {pulse.theirs} {format(dimension.theirs)}
                </span>
              </span>
              <span className="text-right font-display font-semibold text-ink text-sm tabular-nums">
                <span className="sr-only">{pulse.gap} </span>
                {format(high - low)}
              </span>
            </li>
          );
        })}
        <li
          aria-hidden
          className="grid grid-cols-[minmax(0,--spacing(28))_minmax(0,1fr)_--spacing(11)] gap-3.5 text-chip text-muted-foreground"
        >
          <span />
          <span className="flex justify-between">
            {[1, 2, 3, 4, 5].map((step) => (
              <span key={step}>{step}</span>
            ))}
          </span>
          <span />
        </li>
      </ul>
      <FootNote>{pulse.footnote}</FootNote>
    </Card>
  );
}

function JointPlan() {
  const { text } = useSite();
  const plans = text.platform.plans;
  return (
    <Card className="gap-5 bg-background shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="font-display font-semibold text-ink text-xl">{plans.card}</span>
          <span className="text-muted-foreground text-sm">{plans.supplier}</span>
        </div>
        <Chip className="bg-success-soft text-success-soft-foreground">{plans.status}</Chip>
      </div>
      <table className="w-full overflow-hidden rounded-lg bg-card text-left text-sm">
        <thead>
          <tr className="text-chip text-muted-foreground">
            <th scope="col" className="px-4.5 py-3 font-semibold">
              {plans.kpi}
            </th>
            <th scope="col" className="px-3 py-3 font-semibold">
              {plans.today}
            </th>
            <th scope="col" className="px-3 py-3 font-semibold">
              {plans.target}
            </th>
          </tr>
        </thead>
        <tbody>
          {plans.kpis.map((kpi) => (
            <tr key={kpi.name} className="border-line-soft border-t">
              <th scope="row" className="px-4.5 py-3 font-normal">
                {kpi.name}
              </th>
              <td className="px-3 py-3 tabular-nums">{kpi.today}</td>
              <td className="px-3 py-3 font-semibold tabular-nums">{kpi.target}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(55),100%),1fr))] gap-3">
        {[
          [plans.we, plans.weItems],
          [plans.they, plans.theyItems],
        ].map(([label, items]) => (
          <div key={label as string} className="flex flex-col gap-2 rounded-lg bg-card px-4.5 py-4">
            <span className="font-semibold text-chip text-muted-foreground">{label}</span>
            {(items as string[]).map((item) => (
              <span key={item} className="text-sm">
                {item}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-muted-strong text-sm">
        <span>{plans.next}</span>
        <Chip>{plans.preRead}</Chip>
      </div>
      <FootNote>{text.common.illustrativeShort}</FootNote>
    </Card>
  );
}

function Ledger() {
  const { text } = useSite();
  const ledger = text.platform.ledger;
  return (
    <Card className="gap-5.5">
      <div className="flex flex-col gap-0.5">
        <span className="font-display font-semibold text-ink text-xl">{ledger.card}</span>
        <span className="text-muted-foreground text-sm">{ledger.source}</span>
      </div>
      <ol className="grid grid-cols-5 gap-1.5">
        {ledger.stages.map((stage, index) => {
          const done = index <= ledger.current;
          return (
            <li key={stage} className="flex min-w-0 flex-col gap-2">
              <span
                aria-hidden
                className={cn(
                  'h-2 rounded-full',
                  done ? 'bg-petrol' : 'border-2 border-petrol bg-track',
                )}
              />
              <span
                className={cn(
                  'truncate font-semibold text-chip',
                  done ? 'text-muted-strong' : 'text-ink',
                )}
              >
                {stage}
              </span>
            </li>
          );
        })}
      </ol>
      <dl className="flex flex-col">
        {ledger.facts.map((fact, index) => (
          <div
            key={fact.label}
            className="flex items-baseline justify-between gap-3 border-line-soft border-t py-2.75 text-sm"
          >
            <dt className="text-muted-foreground">{fact.label}</dt>
            <dd
              className={cn(
                'text-right',
                index === ledger.facts.length - 1 && 'font-display font-semibold text-ink text-xl',
              )}
            >
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg bg-warning-soft px-4 py-3.5 text-warning-soft-foreground">
        <span className="font-semibold text-sm">{ledger.waiting}</span>
        <span className="text-chip">{ledger.requested}</span>
      </div>
      <FootNote>{text.common.illustrativeShort}</FootNote>
    </Card>
  );
}

function AiSection() {
  const { text } = useSite();
  const ai = text.platform.ai;
  return (
    <Section tone="ink" id="ai">
      <Wrap className="flex flex-col gap-12">
        <div className="flex flex-wrap items-start gap-x-16 gap-y-10 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:basis-96">
          <div className="flex flex-col gap-5">
            <Eyebrow onDark>{ai.eyebrow}</Eyebrow>
            <Heading onDark>{ai.title}</Heading>
            <Lead onDark>{ai.lead}</Lead>
          </div>
          <figure className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-full bg-card px-5 py-4 text-base text-muted-strong">
              <BrandMark />
              <span>{ai.question}</span>
            </div>
            {/* KI-Entwurf: gestrichelt Petrol mit Quellen (Designsprache) */}
            <div className="flex flex-col gap-3 rounded-xl border-2 border-mint border-dashed bg-dark-2 p-6">
              <span className="font-semibold text-chip text-mint">{ai.draft}</span>
              <p className="text-base text-on-dark">{ai.answer}</p>
              <div className="flex flex-wrap gap-1.5">
                {ai.sources.map((source) => (
                  <Chip key={source} tone="onDark" className="bg-ink text-chip">
                    {source}
                  </Chip>
                ))}
              </div>
            </div>
            <figcaption className="text-chip text-on-dark-muted">
              {text.common.illustrativeShort}
            </figcaption>
          </figure>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(62),100%),1fr))] gap-5">
          {text.aiFeatures.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col gap-3 rounded-site border border-dark-2 p-7"
            >
              <RingsMark onDark />
              <CardTitle className="text-on-dark">{feature.title}</CardTitle>
              <p className="text-base text-on-dark-muted">{feature.text}</p>
            </div>
          ))}
        </div>
      </Wrap>
    </Section>
  );
}

function Categories() {
  const { text } = useSite();
  const categories = text.platform.categories;
  return (
    <Card className="gap-4 bg-background shadow-none">
      <ViewTitle>{categories.card}</ViewTitle>
      <ul className="flex flex-col gap-2.5">
        {categories.rows.map((row, index) => (
          <li
            key={row.category}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card px-4.5 py-3.5 text-base"
          >
            <span>{row.category}</span>
            <Chip tone={index < 2 ? 'mint' : 'neutral'}>{row.type}</Chip>
          </li>
        ))}
        <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-ink px-4.5 py-3.5 text-base text-on-dark">
          <span className="font-semibold">{categories.company}</span>
          <span className="font-semibold text-mint">{categories.companyType}</span>
        </li>
      </ul>
      <FootNote>{text.common.illustrativeShort}</FootNote>
    </Card>
  );
}

export function PlatformPage() {
  const { text, href } = useSite();
  const page = text.platform;
  const anchors = ['segment', 'pulse', 'plans', 'impact', 'ai', 'categories'];
  return (
    <>
      <PageHero eyebrow={page.eyebrow} title={page.title} lead={page.lead}>
        <Actions>
          <LinkPill href={href('contact')}>{text.nav.demo}</LinkPill>
          <LinkPill href={href('howItWorks')} variant="secondary">
            {text.common.seeHow}
          </LinkPill>
        </Actions>
        <nav aria-label={page.jumpLabel} className="mt-5 flex flex-wrap gap-2">
          {page.jump.map((label, index) => (
            <a
              key={label}
              href={`#${anchors[index]}`}
              className="inline-flex min-h-11 items-center rounded-full bg-card px-4 font-semibold text-sm text-text no-underline shadow-inset-line hover:bg-line-soft"
            >
              {label}
            </a>
          ))}
        </nav>
      </PageHero>

      <Section tone="card" id="segment">
        <Split>
          <Copy {...page.segmentation} />
          <Matrix />
        </Split>
      </Section>

      <Section id="pulse">
        <Split reverse>
          <Copy {...page.pulse} />
          <PulseGaps />
        </Split>
      </Section>

      <Section tone="card" id="plans">
        <Split>
          <Copy {...page.plans} />
          <JointPlan />
        </Split>
      </Section>

      <Section id="impact">
        <Split reverse>
          <Copy {...page.ledger} />
          <Ledger />
        </Split>
      </Section>

      <AiSection />

      <Section tone="card" id="categories">
        <Split>
          <Copy {...page.categories} />
          <Categories />
        </Split>
      </Section>

      <Section>
        <Wrap className="flex flex-col gap-12">
          <SectionHead
            eyebrow={page.stack.eyebrow}
            title={page.stack.title}
            lead={page.stack.lead}
          />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(75),100%),1fr))] gap-5">
            {page.stack.stages.map((stage, index) => (
              <Card key={stage.name}>
                <Chip tone={index === 0 ? 'mint' : 'neutral'}>{stage.name}</Chip>
                <Body>{stage.items}</Body>
              </Card>
            ))}
          </div>
        </Wrap>
      </Section>

      <InkCallout title={page.cta}>
        <LinkPill href={href('contact')} variant="mint">
          {text.nav.demo}
        </LinkPill>
        <LinkPill href={href('pricing')} variant="dark">
          {text.common.seePricing}
        </LinkPill>
      </InkCallout>
    </>
  );
}
