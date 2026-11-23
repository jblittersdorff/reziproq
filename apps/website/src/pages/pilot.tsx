import { cn } from '@/lib/utils';
import {
  Actions,
  Body,
  Card,
  CardTitle,
  CheckList,
  Eyebrow,
  InkCallout,
  LinkPill,
  NumberCircle,
  PageHero,
  Section,
  SectionHead,
  Wrap,
} from '../components/site';
import { useSite } from '../i18n';

// WEB-01, Seite „Pilot“ nach Vorlage Pilot: Eckdaten, sechs Schritte, drei Kriterien,
// Zusammenarbeit, Gebühr, Tinte-Karte für das Design-Partner-Programm.

export function PilotPage() {
  const { text, href } = useSite();
  const page = text.pilot;
  return (
    <>
      <PageHero eyebrow={page.eyebrow} title={page.title} lead={page.lead}>
        <Actions>
          <LinkPill href={href('contact')}>{page.apply}</LinkPill>
          <LinkPill href={href('contact')} variant="secondary">
            {page.demoFirst}
          </LinkPill>
        </Actions>
        <dl className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(58),100%),1fr))] gap-5">
          {page.facts.map((fact) => (
            <div
              key={fact.text}
              className="flex flex-col-reverse gap-2 rounded-xl bg-card p-6 shadow-card"
            >
              <dt className="text-base text-muted-strong">{fact.text}</dt>
              <dd className="font-display font-semibold text-petrol text-site-title tracking-title-lg">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </PageHero>

      <Section tone="card">
        <Wrap className="flex flex-col gap-12">
          <SectionHead eyebrow={page.run.eyebrow} title={page.run.title} />
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(75),100%),1fr))] gap-5">
            {page.run.steps.map((step, index) => {
              const last = index === page.run.steps.length - 1;
              return (
                <li
                  key={step.title}
                  className={cn(
                    'flex flex-col gap-3 rounded-site p-7',
                    last ? 'bg-ink' : 'bg-background',
                  )}
                >
                  <NumberCircle accent={last}>{index + 1}</NumberCircle>
                  <span
                    className={cn(
                      'font-semibold text-sm',
                      last ? 'text-on-dark-muted' : 'text-petrol-dark',
                    )}
                  >
                    {step.when}
                  </span>
                  <CardTitle className={last ? 'text-on-dark' : undefined}>{step.title}</CardTitle>
                  <p className={cn('text-base', last ? 'text-on-dark-muted' : 'text-muted-strong')}>
                    {step.text}
                  </p>
                </li>
              );
            })}
          </ol>
        </Wrap>
      </Section>

      <Section>
        <Wrap className="flex flex-col gap-12">
          <SectionHead
            eyebrow={page.criteria.eyebrow}
            title={page.criteria.title}
            lead={page.criteria.lead}
          />
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(75),100%),1fr))] gap-5">
            {page.criteria.items.map((item) => (
              <li key={item.title}>
                <Card className="h-full">
                  <span className="font-display font-semibold text-petrol text-site-figure tracking-title-lg">
                    {item.value}
                  </span>
                  <CardTitle>{item.title}</CardTitle>
                  <Body>{item.text}</Body>
                </Card>
              </li>
            ))}
          </ul>
          <Body className="max-w-3xl">{page.criteria.note}</Body>
        </Wrap>
      </Section>

      <Section tone="card">
        <Wrap className="flex flex-col gap-12">
          <SectionHead eyebrow={page.together.eyebrow} title={page.together.title} />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(84),100%),1fr))] gap-5">
            <Card className="bg-mint-soft shadow-none">
              <CardTitle>{page.together.we}</CardTitle>
              <CheckList items={page.together.weItems} />
            </Card>
            <Card className="bg-background shadow-none">
              <CardTitle>{page.together.you}</CardTitle>
              <CheckList items={page.together.youItems} />
            </Card>
          </div>
        </Wrap>
      </Section>

      <Section>
        <Wrap>
          <div className="flex flex-wrap items-center justify-between gap-x-12 gap-y-6 rounded-site-lg bg-card p-8 shadow-card sm:p-12">
            <div className="flex flex-col gap-2">
              <Eyebrow>{page.together.fee}</Eyebrow>
              <span className="font-display font-semibold text-ink text-site-title tracking-title-lg">
                {page.together.feeText}
              </span>
            </div>
            <LinkPill href={href('pricing')} variant="secondary">
              {text.common.seePricing}
            </LinkPill>
          </div>
        </Wrap>
      </Section>

      <InkCallout chip={page.partner.chip} title={page.partner.title} lead={page.partner.lead}>
        <LinkPill href={href('contact')} variant="mint">
          {page.apply}
        </LinkPill>
        <LinkPill href={href('security')} variant="dark">
          {page.partner.trust}
        </LinkPill>
      </InkCallout>
    </>
  );
}
