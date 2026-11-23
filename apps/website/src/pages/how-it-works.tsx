import { cn } from '@/lib/utils';
import {
  Body,
  Card,
  CardTitle,
  InkCallout,
  LinkPill,
  NumberCircle,
  PageHero,
  RingsMark,
  Section,
  SectionHead,
  Wrap,
} from '../components/site';
import { useSite } from '../i18n';

// WEB-01, Seite „So funktioniert es“ nach Vorlage HowItWorks: drei Phasen mit je zwei
// Schritten, Tiefe je Beziehungstyp, Ergebnis, Tinte-Karte.

const phaseTones = [
  {
    box: 'bg-line-soft',
    name: 'text-petrol-dark',
    title: 'text-ink',
    question: 'text-muted-strong',
  },
  {
    box: 'bg-mint-soft',
    name: 'text-petrol-dark',
    title: 'text-ink',
    question: 'text-muted-strong',
  },
  { box: 'bg-ink', name: 'text-mint', title: 'text-on-dark', question: 'text-on-dark-muted' },
] as const;

/** Eingeschlossen: Kreis Petrol; nicht nötig: grau gestrichelter Kreis. Immer mit Text. */
function Included({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'block size-4.5 shrink-0 rounded-full',
        on ? 'bg-petrol' : 'border-2 border-ring-open border-dashed',
      )}
    />
  );
}

function DepthTable() {
  const { text } = useSite();
  const depth = text.howItWorks.depth;
  return (
    <>
      {/* Breite Bildschirme: Tabelle mit sechs Schritten */}
      <div className="hidden overflow-hidden rounded-site bg-background md:block">
        <table className="w-full table-fixed border-collapse text-left">
          <thead>
            <tr className="font-semibold text-chip text-muted-foreground">
              <th scope="col" className="w-48 px-4.5 py-4">
                <span className="sr-only">{depth.eyebrow}</span>
              </th>
              {depth.columns.map((column) => (
                <th key={column} scope="col" className="px-3.5 py-4 align-bottom font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {depth.rows.map((row) => (
              <tr key={row.name} className="border-track border-t bg-card">
                <th scope="row" className="px-4.5 py-4.5 text-left align-middle">
                  <span className="block font-display font-semibold text-ink text-lg">
                    {row.name}
                  </span>
                  <span className="block font-normal text-chip text-muted-foreground">
                    {row.note}
                  </span>
                </th>
                {row.cells.map((cell, index) => (
                  <td
                    key={depth.columns[index]}
                    className={cn(
                      'px-3.5 py-4.5 align-top text-chip',
                      cell.on ? 'text-text' : 'text-muted-foreground',
                    )}
                  >
                    <span className="flex flex-col items-start gap-2">
                      <Included on={cell.on} />
                      {cell.text}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Telefon: je Beziehungstyp eine Karte, Schritte untereinander */}
      <div className="flex flex-col gap-4 md:hidden">
        {depth.rows.map((row) => (
          <Card key={row.name} className="bg-background shadow-none">
            <CardTitle>{row.name}</CardTitle>
            <span className="text-muted-foreground text-sm">{row.note}</span>
            <ul className="flex flex-col">
              {row.cells.map((cell, index) => (
                <li
                  key={depth.columns[index]}
                  className="flex items-center gap-3 border-track border-t py-3 text-sm"
                >
                  <Included on={cell.on} />
                  <span className="min-w-0 flex-1 text-muted-strong">{depth.columns[index]}</span>
                  <span className={cell.on ? 'text-text' : 'text-muted-foreground'}>
                    {cell.text}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}

export function HowItWorksPage() {
  const { text, href } = useSite();
  const page = text.howItWorks;
  let number = 0;
  return (
    <>
      <PageHero eyebrow={page.eyebrow} title={page.title} lead={page.lead} />

      <section className="pb-site-section">
        <Wrap>
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(84),100%),1fr))] gap-5">
            {page.phases.map((phase, phaseIndex) => {
              const tone = phaseTones[phaseIndex] ?? phaseTones[0];
              return (
                <li
                  key={phase.name}
                  className={cn('flex flex-col gap-4 rounded-site p-5', tone.box)}
                >
                  <div className="flex flex-col gap-1 px-1.5 pt-1 pb-1.5">
                    <span className={cn('font-semibold text-chip', tone.name)}>{phase.name}</span>
                    <h2
                      className={cn(
                        'font-display font-semibold text-2xl tracking-title-work',
                        tone.title,
                      )}
                    >
                      {phase.title}
                    </h2>
                    <span className={cn('text-base', tone.question)}>{phase.question}</span>
                  </div>
                  <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(60),100%),1fr))] gap-3">
                    {phase.steps.map((step) => {
                      number += 1;
                      return (
                        <li
                          key={step.title}
                          className="flex flex-col gap-2.5 rounded-xl bg-card p-5 shadow-card"
                        >
                          <NumberCircle accent={number === 6}>{number}</NumberCircle>
                          <h3 className="font-display font-semibold text-ink text-section tracking-section-sm">
                            {step.title}
                          </h3>
                          <span className="text-base text-muted-strong">{step.text}</span>
                          <span className="mt-auto self-start rounded-full bg-line-soft px-2.5 py-1 font-semibold text-chip text-muted-strong">
                            {step.who}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </li>
              );
            })}
          </ol>
        </Wrap>
      </section>

      <Section tone="card">
        <Wrap className="flex flex-col gap-12">
          <SectionHead
            eyebrow={page.depth.eyebrow}
            title={page.depth.title}
            lead={page.depth.lead}
          />
          <DepthTable />
        </Wrap>
      </Section>

      <Section>
        <Wrap className="flex flex-col gap-12">
          <SectionHead eyebrow={page.result.eyebrow} title={page.result.title} />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(--spacing(62),100%),1fr))] gap-5">
            {page.result.items.map((item) => (
              <Card key={item.title}>
                <CardTitle>{item.title}</CardTitle>
                <Body>{item.text}</Body>
              </Card>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-site bg-ink px-7 py-6 text-on-dark">
            <span className="flex items-center gap-3 font-semibold text-lg">
              <RingsMark onDark />
              {page.result.suppliers}
            </span>
            <LinkPill href={href('suppliers')} variant="mint" size="default">
              {page.result.suppliersLink}
            </LinkPill>
          </div>
        </Wrap>
      </Section>

      <InkCallout title={page.cta}>
        <LinkPill href={href('contact')} variant="mint">
          {text.nav.demo}
        </LinkPill>
        <LinkPill href={href('platform')} variant="dark">
          {text.common.seePlatform}
        </LinkPill>
      </InkCallout>
    </>
  );
}
