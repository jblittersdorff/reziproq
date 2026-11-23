import { ChevronDownIcon, LockIcon } from 'lucide-react';
import { BrandMark } from '@/components/ui/brand-mark';
import { cn } from '@/lib/utils';
import {
  Actions,
  Body,
  Card,
  CardTitle,
  Chip,
  Eyebrow,
  Faq,
  FootNote,
  Heading,
  Lead,
  LinkPill,
  NumberCircle,
  PageTitle,
  ProductFrame,
  Section,
  SectionHead,
  Wrap,
} from '../components/site';
import { useSite } from '../i18n';

// WEB-01, Seite „Für Lieferanten“ nach Vorlage Suppliers: Portal mit Beispieldaten, Zahlen,
// Nutzen, KAM-Liste, private Ebenen auf Tinte, häufige Fragen.

function Portal() {
  const { text } = useSite();
  const portal = text.suppliers.portal;
  return (
    <ProductFrame
      note={portal.note}
      bar={
        <>
          <span className="flex items-center gap-2 font-display font-semibold text-base text-ink">
            <BrandMark />
            {portal.name}
          </span>
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-chip text-muted-strong shadow-inset-line">
            {portal.customer}
            <ChevronDownIcon aria-hidden className="size-3.5" />
          </span>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <span className="font-semibold text-chip text-muted-foreground">{portal.relationship}</span>
        <span className="font-display font-semibold text-2xl text-ink tracking-title-work">
          {portal.type}
        </span>
        <span className="text-chip text-muted-foreground">{portal.released}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {[
          [portal.yours, '3'],
          [portal.theirs, '2'],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 rounded-lg bg-background px-4 py-3.5">
            <span className="font-semibold text-chip text-muted-foreground">{label}</span>
            <span className="font-display font-semibold text-2xl text-ink">{value}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-mint-soft p-4">
        <span className="flex flex-col gap-0.5">
          <strong className="text-base text-ink">{portal.pulse}</strong>
          <span className="text-chip text-petrol-dark">{portal.pulseNote}</span>
        </span>
        {/* Nur Ansicht: kein echter Knopf auf der Website */}
        <span className="inline-flex min-h-10 items-center rounded-full bg-primary px-4 font-semibold text-primary-foreground text-sm">
          {portal.start}
        </span>
      </div>
      <div className="flex justify-between gap-3 text-muted-strong text-sm">
        <span>{portal.review}</span>
        <strong className="text-ink">{portal.reviewDate}</strong>
      </div>
    </ProductFrame>
  );
}

export function SuppliersPage() {
  const { text, href } = useSite();
  const page = text.suppliers;
  return (
    <>
      <section className="py-site-section">
        <Wrap className="flex flex-wrap items-center gap-x-16 gap-y-12">
          <div className="flex min-w-0 flex-[1.1] basis-110 flex-col gap-6.5">
            <Chip>{page.chip}</Chip>
            <PageTitle>{page.title}</PageTitle>
            <Lead>{page.lead}</Lead>
            <Actions>
              <LinkPill href={href('contact')}>{page.questions}</LinkPill>
              <LinkPill href="#faq" variant="secondary">
                {page.faqLink}
              </LinkPill>
            </Actions>
          </div>
          <div className="min-w-0 flex-1 basis-105">
            <Portal />
          </div>
        </Wrap>
      </section>

      <Section tone="card">
        <Wrap className="flex flex-col gap-12">
          <Heading className="max-w-4xl">{page.why.title}</Heading>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(84),100%),1fr))] gap-5">
            {page.why.figures.map((figure, index) => (
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
          <FootNote>{page.why.sources}</FootNote>
        </Wrap>
      </Section>

      <Section>
        <Wrap className="flex flex-col gap-12">
          <SectionHead eyebrow={page.get.eyebrow} title={page.get.title} />
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(62),100%),1fr))] gap-5">
            {page.get.items.map((item, index) => (
              <li key={item.title}>
                <Card className="h-full">
                  <NumberCircle>{index + 1}</NumberCircle>
                  <CardTitle>{item.title}</CardTitle>
                  <Body>{item.text}</Body>
                </Card>
              </li>
            ))}
          </ol>
        </Wrap>
      </Section>

      <Section tone="card">
        <Wrap className="flex flex-wrap items-start gap-x-16 gap-y-12">
          <SectionHead
            className="min-w-0 flex-1 basis-90"
            eyebrow={page.kam.eyebrow}
            title={page.kam.title}
            lead={page.kam.lead}
          />
          <dl className="flex min-w-0 flex-[1.2] basis-110 flex-col">
            {page.kam.items.map((item) => (
              <div
                key={item.title}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-line-soft border-t py-4.5 last:border-b"
              >
                <dt className="shrink-0 grow-0 basis-50 font-display font-semibold text-ink text-lg">
                  {item.title}
                </dt>
                <dd className="text-base text-muted-strong">{item.text}</dd>
              </div>
            ))}
          </dl>
        </Wrap>
      </Section>

      <Section>
        <Wrap>
          <div className="flex flex-wrap items-center gap-10 rounded-site-lg bg-ink p-7 text-on-dark sm:p-14">
            <SectionHead
              className="min-w-0 flex-1 basis-95"
              onDark
              eyebrow={page.private.eyebrow}
              title={page.private.title}
              lead={page.private.lead}
            />
            <ul className="flex min-w-0 flex-1 basis-90 flex-col gap-2.5">
              {page.private.layers.map((layer, index) => {
                const shared = index === 1;
                return (
                  <li
                    key={layer.name}
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-3 rounded-lg px-5 py-4.5',
                      shared
                        ? 'border-2 border-mint bg-dark-2'
                        : 'border-2 border-dark-2 border-dashed',
                    )}
                  >
                    <span
                      className={cn(
                        'flex items-center gap-2.5 text-base',
                        shared ? 'font-semibold text-on-dark' : 'text-on-dark-muted',
                      )}
                    >
                      {shared ? <BrandMark /> : <LockIcon aria-hidden className="size-4.5" />}
                      {layer.name}
                    </span>
                    <Chip tone={shared ? 'mintStrong' : 'onDark'}>{layer.chip}</Chip>
                  </li>
                );
              })}
            </ul>
          </div>
        </Wrap>
      </Section>

      <Section id="faq" className="pt-0">
        <Wrap className="flex flex-wrap gap-x-16 gap-y-12">
          <div className="flex min-w-0 flex-1 basis-75 flex-col gap-5">
            <Eyebrow>{page.faq.eyebrow}</Eyebrow>
            <Heading>{page.faq.title}</Heading>
            <LinkPill href={href('contact')} variant="secondary" className="self-start">
              {page.faq.ask}
            </LinkPill>
          </div>
          <div className="min-w-0 flex-[1.6] basis-130">
            <Faq items={page.faq.items} />
          </div>
        </Wrap>
      </Section>
    </>
  );
}
