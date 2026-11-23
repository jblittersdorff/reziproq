import { ArrowRightIcon, LockIcon } from 'lucide-react';
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
  Lead,
  LinkPill,
  PageTitle,
  ProductFrame,
  RingsDecor,
  RingsMark,
  Section,
  Wrap,
} from '../components/site';
import { useSite } from '../i18n';

/** Ringpaar wie in der App: außen Ergebnisse (Petrol), innen Beziehungen (Mint) */
function Rings({ outer, inner, label }: { outer: number; inner: number; label: string }) {
  const arc = (radius: number, share: number) => {
    const length = 2 * Math.PI * radius;
    return `${(length * share).toFixed(1)} ${length.toFixed(1)}`;
  };
  return (
    <svg viewBox="0 0 240 240" role="img" aria-label={label} className="size-44 shrink-0">
      <circle cx="120" cy="120" r="104" fill="none" strokeWidth="22" className="stroke-track" />
      <circle
        cx="120"
        cy="120"
        r="104"
        fill="none"
        strokeWidth="22"
        strokeLinecap="round"
        strokeDasharray={arc(104, outer)}
        transform="rotate(-90 120 120)"
        className="stroke-petrol"
      />
      <circle cx="120" cy="120" r="74" fill="none" strokeWidth="22" className="stroke-track" />
      <circle
        cx="120"
        cy="120"
        r="74"
        fill="none"
        strokeWidth="22"
        strokeLinecap="round"
        strokeDasharray={arc(74, inner)}
        transform="rotate(-90 120 120)"
        className="stroke-mint"
      />
    </svg>
  );
}

/** Ebenen einer Beziehung: privat grau gestrichelt mit Schloss, geteilt Mint mit Doppelring */
export function Layers({
  layers,
  onDark = false,
}: {
  layers: { who: string; what: string }[];
  onDark?: boolean;
}) {
  return (
    <ul className="flex flex-col gap-2.5">
      {layers.map((layer, index) => {
        const shared = index === 1;
        return (
          <li
            key={layer.who}
            className={cn(
              'flex flex-wrap items-center justify-between gap-3 rounded-lg px-5 py-4',
              shared
                ? 'bg-mint-soft shadow-inset-mint'
                : onDark
                  ? 'border-2 border-dark-2 border-dashed'
                  : 'border-2 border-line border-dashed bg-card',
            )}
          >
            <span className="flex items-center gap-2.5">
              {shared ? (
                <BrandMark />
              ) : (
                <LockIcon
                  aria-hidden
                  className={cn(
                    'size-4.5',
                    onDark ? 'text-on-dark-muted' : 'text-muted-foreground',
                  )}
                />
              )}
              <strong
                className={cn(
                  'font-semibold',
                  shared ? 'text-ink' : onDark ? 'text-on-dark' : 'text-ink',
                )}
              >
                {layer.who}
              </strong>
            </span>
            <span
              className={cn(
                'text-base',
                shared ? 'text-petrol-dark' : onDark ? 'text-on-dark-muted' : 'text-muted-strong',
              )}
            >
              {layer.what}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function AiCards() {
  const { text } = useSite();
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(60),100%),1fr))] gap-5">
      {text.aiFeatures.map((feature) => (
        <Card key={feature.title}>
          <RingsMark />
          <CardTitle>{feature.title}</CardTitle>
          <Body>{feature.text}</Body>
        </Card>
      ))}
    </div>
  );
}

export function HomePage() {
  const { text, href } = useSite();
  const home = text.home;
  const product = home.product;
  return (
    <>
      <section className="relative py-site-section">
        <RingsDecor className="-right-40 top-10 hidden h-128 w-180 md:block" />
        <Wrap className="relative flex flex-col gap-7">
          <Chip>{home.chip}</Chip>
          <PageTitle className="max-w-5xl">{home.title}</PageTitle>
          <Lead className="max-w-xl">{home.lead}</Lead>
          <Actions>
            <LinkPill href={href('contact')}>{text.nav.demo}</LinkPill>
            <LinkPill href={href('howItWorks')} variant="secondary">
              {text.common.seeHow}
            </LinkPill>
          </Actions>
          <ProductFrame
            className="mt-9"
            note={text.common.illustrative}
            bar={
              <>
                <span className="flex items-center gap-2 font-display font-semibold text-ink">
                  <BrandMark />
                  Reziproq
                </span>
                <span className="mx-auto flex flex-wrap gap-0.5 rounded-full bg-line-soft p-0.5 text-sm">
                  {product.tabs.map((tab, index) => (
                    <span
                      key={tab}
                      className={cn(
                        'rounded-full px-4 py-1.5',
                        index === 0
                          ? 'bg-card font-semibold text-ink shadow-toggle'
                          : 'text-muted-strong',
                      )}
                    >
                      {tab}
                    </span>
                  ))}
                </span>
                <span className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-muted-strong text-sm shadow-inset-line">
                  {product.ask}
                  <span className="rounded-sm bg-background px-1.5 font-semibold text-chip text-muted-foreground">
                    ⌘K
                  </span>
                </span>
              </>
            }
          >
            <div className="flex flex-wrap items-center gap-x-12 gap-y-8">
              <div className="flex min-w-0 flex-1 basis-100 flex-col gap-3.5">
                <span className="flex items-center gap-2 font-semibold text-petrol-dark text-sm">
                  <BrandMark />
                  {product.summarised}
                </span>
                <p className="text-balance font-display font-semibold text-ink text-insight tracking-title-work">
                  {product.insight}
                </p>
                <Body>{product.insightText}</Body>
              </div>
              <div className="flex flex-wrap items-center gap-7">
                <Rings outer={0.69} inner={0.75} label={product.ringsLabel} />
                <dl className="flex flex-col gap-4.5">
                  {[
                    [product.results, product.resultsValue, product.resultsNote, 'bg-petrol'],
                    [
                      product.relationships,
                      product.relationshipsValue,
                      product.relationshipsNote,
                      'bg-mint',
                    ],
                  ].map(([label, value, note, dot]) => (
                    <div key={label} className="flex flex-col gap-1">
                      <dt className="flex items-center gap-2 font-semibold text-muted-foreground text-sm">
                        <span aria-hidden className={cn('size-3 rounded-full', dot)} />
                        {label}
                      </dt>
                      <dd className="font-display font-semibold text-ink text-xl tabular-nums tracking-title-work">
                        {value}
                      </dd>
                      <dd className="text-muted-foreground text-sm">{note}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(56),100%),1fr))] gap-3">
              {product.tiles.map((tile) => (
                <div
                  key={tile.title}
                  className="flex flex-col gap-1.5 rounded-lg bg-background px-5 py-4"
                >
                  <span className="font-semibold text-muted-foreground text-sm">{tile.title}</span>
                  <span className="text-base text-text">{tile.text}</span>
                </div>
              ))}
            </div>
          </ProductFrame>
        </Wrap>
      </section>

      <Section tone="card">
        <Wrap className="flex flex-col gap-12">
          <Heading className="max-w-4xl">{home.problem.title}</Heading>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(64),100%),1fr))] gap-5">
            {home.problem.figures.map((figure, index) => (
              <Card key={figure.value} className="bg-background shadow-none">
                <span className="font-display font-semibold text-petrol text-site-figure tracking-title-lg">
                  {figure.value}
                </span>
                <Body>
                  {figure.text}
                  <sup>{index + 1}</sup>
                </Body>
              </Card>
            ))}
          </div>
          <FootNote>{home.problem.sources}</FootNote>
        </Wrap>
      </Section>

      <Section>
        <Wrap className="flex flex-col gap-12">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex max-w-3xl flex-col gap-5">
              <Eyebrow>{home.steps.eyebrow}</Eyebrow>
              <Heading>{home.steps.title}</Heading>
            </div>
            <LinkPill href={href('howItWorks')} variant="link" className="px-0">
              {home.steps.all}
              <ArrowRightIcon aria-hidden />
            </LinkPill>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(72),100%),1fr))] gap-5">
            {home.steps.phases.map((phase, index) => (
              <Card key={phase.name} className={index === 2 ? 'bg-ink text-on-dark' : undefined}>
                <span
                  className={cn(
                    'font-semibold text-sm',
                    index === 2 ? 'text-mint' : 'text-petrol-dark',
                  )}
                >
                  {phase.name}
                </span>
                <CardTitle className={index === 2 ? 'text-on-dark' : undefined}>
                  {phase.title}
                </CardTitle>
                <span
                  className={cn(
                    'text-sm',
                    index === 2 ? 'text-on-dark-muted' : 'text-muted-foreground',
                  )}
                >
                  {phase.steps}
                </span>
              </Card>
            ))}
          </div>
        </Wrap>
      </Section>

      <Section tone="card">
        <Wrap className="flex flex-wrap items-center gap-x-16 gap-y-10">
          <div className="flex min-w-0 flex-1 basis-96 flex-col gap-5">
            <Eyebrow>{home.twoSided.eyebrow}</Eyebrow>
            <Heading>{home.twoSided.title}</Heading>
            <Lead>{home.twoSided.lead}</Lead>
            <LinkPill href={href('suppliers')} variant="link" className="self-start px-0">
              {home.twoSided.link}
              <ArrowRightIcon aria-hidden />
            </LinkPill>
          </div>
          <div className="min-w-0 flex-1 basis-96">
            <Layers layers={home.twoSided.layers} />
          </div>
        </Wrap>
      </Section>

      <Section>
        <Wrap className="flex flex-wrap items-center gap-x-16 gap-y-10">
          <div className="flex min-w-0 flex-1 basis-96 flex-col gap-5">
            <Eyebrow>{home.impact.eyebrow}</Eyebrow>
            <Heading>{home.impact.title}</Heading>
            <Lead>{home.impact.lead}</Lead>
          </div>
          <figure className="flex min-w-0 flex-1 basis-96 flex-col gap-2.5">
            <div className="flex flex-col gap-4 rounded-site bg-card p-7 shadow-card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-display font-semibold text-ink text-lg">
                  {home.impact.pipeline}
                </span>
                <span className="text-muted-foreground text-sm">{home.impact.perYear}</span>
              </div>
              <ul className="flex flex-col gap-3">
                {home.impact.stages.map((stage, index) => (
                  <li
                    key={stage.name}
                    className="grid grid-cols-[minmax(0,--spacing(28))_minmax(0,1fr)_auto] items-center gap-3 text-sm"
                  >
                    <span className="text-muted-strong">{stage.name}</span>
                    <span className="h-3 overflow-hidden rounded-full bg-line-soft">
                      <span
                        className={cn(
                          'block h-full rounded-full',
                          index === 4 ? 'bg-petrol' : 'bg-mint-line',
                        )}
                        style={{ width: `${stage.share}%` }}
                      />
                    </span>
                    <span className="font-semibold text-ink tabular-nums">{stage.value}</span>
                  </li>
                ))}
              </ul>
            </div>
            <figcaption className="text-chip text-muted-foreground">
              {text.common.illustrativeShort}
            </figcaption>
          </figure>
        </Wrap>
      </Section>

      <Section tone="card">
        <Wrap className="flex flex-col gap-12">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex max-w-3xl flex-col gap-5">
              <Eyebrow>{home.ai.eyebrow}</Eyebrow>
              <Heading>{home.ai.title}</Heading>
            </div>
            <LinkPill href={href('platform', 'ai')} variant="link" className="px-0">
              {home.ai.more}
              <ArrowRightIcon aria-hidden />
            </LinkPill>
          </div>
          <AiCards />
        </Wrap>
      </Section>

      <Section>
        <Wrap>
          <div className="flex flex-col gap-10 rounded-site-lg bg-ink p-9 text-on-dark sm:p-14">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <Heading onDark className="max-w-3xl">
                {home.data.title}
              </Heading>
              <LinkPill href={href('security')} variant="mint">
                {home.data.link}
              </LinkPill>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(56),100%),1fr))] gap-5">
              {home.data.points.map((point) => (
                <div
                  key={point.title}
                  className="flex flex-col gap-1.5 border-dark-2 border-t pt-4"
                >
                  <strong className="font-display font-semibold text-on-dark text-lg">
                    {point.title}
                  </strong>
                  <span className="text-base text-on-dark-muted">{point.text}</span>
                </div>
              ))}
            </div>
          </div>
        </Wrap>
      </Section>

      <Section tone="card">
        <Wrap className="flex flex-col gap-6">
          <Eyebrow>{home.pricing.eyebrow}</Eyebrow>
          <Heading className="max-w-3xl">{home.pricing.title}</Heading>
          <Lead className="max-w-2xl">{home.pricing.lead}</Lead>
          <Actions>
            <LinkPill href={href('contact')}>{text.nav.demo}</LinkPill>
            <LinkPill href={href('pricing')} variant="secondary">
              {text.common.seePricing}
            </LinkPill>
          </Actions>
        </Wrap>
      </Section>
    </>
  );
}
