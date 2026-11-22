import { ArrowRightIcon, MessageCircleQuestionIcon } from 'lucide-react';
import type * as React from 'react';
import { useEffect } from 'react';

import { AiDraft } from '@/components/ui/ai-draft';
import { Badge } from '@/components/ui/badge';
import { BrandMark, Logo } from '@/components/ui/brand-mark';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, Figure } from '@/components/ui/card';
import { Chain } from '@/components/ui/chain';
import { DateCircle } from '@/components/ui/date-circle';
import { GlobalBar } from '@/components/ui/global-bar';
import { GuideQuestions } from '@/components/ui/guide-questions';
import { LayerItem, LayerPanel } from '@/components/ui/layer-panel';
import {
  ListCard,
  ListCardHeader,
  ListRow,
  ListRowText,
  ListSection,
} from '@/components/ui/list-card';
import { LocalBar, LocalBarProgress } from '@/components/ui/local-bar';
import { MeterBar } from '@/components/ui/meter-bar';
import { Monogram } from '@/components/ui/monogram';
import { NextStep, NextStepArrow } from '@/components/ui/next-step';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StepProgress } from '@/components/ui/step-progress';
import { Steps } from '@/components/ui/steps';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TimelineLanes } from '@/components/ui/timeline-lanes';
import { VisibilityBadge } from '@/components/ui/visibility-badge';
import { type Locale, useLocale, useMessages, useT } from '@/lib/i18n';
import { InsightExample } from './insight-example';
import { designMessages } from './messages';

type SectionId = keyof (typeof designMessages)['de']['sections'];

/** Die Vorlage in docs/design/referenz/ und die Datei im UI-Paket je Baustein */
const blocks: { id: SectionId; reference: string | null; files: string[] }[] = [
  {
    id: 'insights',
    reference: 'Uebersicht.dc.html, D-Diagramme.dc.html',
    files: ['insight.tsx', 'goal-rings.tsx'],
  },
  { id: 'header', reference: 'Header.dc.html', files: ['global-bar.tsx'] },
  { id: 'supplierBar', reference: 'SupplierBar.dc.html', files: ['local-bar.tsx'] },
  { id: 'flow', reference: 'Flow.dc.html', files: ['step-progress.tsx'] },
  { id: 'logo', reference: 'Header.dc.html', files: ['brand-mark.tsx'] },
  { id: 'buttons', reference: 'Lieferanten.dc.html', files: ['button.tsx'] },
  { id: 'chips', reference: null, files: ['badge.tsx', 'visibility-badge.tsx'] },
  { id: 'monogram', reference: 'Aufgaben.dc.html', files: ['monogram.tsx'] },
  { id: 'toggle', reference: 'Aufgaben.dc.html', files: ['segmented-control.tsx'] },
  { id: 'chain', reference: 'Lieferanten.dc.html', files: ['chain.tsx'] },
  {
    id: 'steps',
    reference: 'L-Ueberblick.dc.html, Import.dc.html',
    files: ['steps.tsx', 'step-ring.tsx', 'step-progress.tsx'],
  },
  { id: 'date', reference: 'Main.dc.html', files: ['date-circle.tsx'] },
  { id: 'list', reference: 'Aufgaben.dc.html', files: ['list-card.tsx'] },
  { id: 'layers', reference: 'L-Ueberblick.dc.html', files: ['layer-panel.tsx'] },
  { id: 'draft', reference: 'WG-Markt.dc.html', files: ['ai-draft.tsx'] },
  { id: 'questions', reference: 'WG-Intern.dc.html', files: ['guide-questions.tsx'] },
  { id: 'table', reference: 'P-Scorecard.dc.html', files: ['table.tsx'] },
  { id: 'timeline', reference: 'P-Initiativen.dc.html', files: ['timeline-lanes.tsx'] },
  { id: 'bar', reference: 'WG-Intern.dc.html', files: ['meter-bar.tsx'] },
  { id: 'next', reference: 'Main.dc.html', files: ['next-step.tsx'] },
  { id: 'card', reference: 'L-Ueberblick.dc.html', files: ['card.tsx'] },
];

/**
 * Interne Seite /design: alle Bausteine der Designsprache „Zwei Kreise“ aus dem UI-Paket, mit
 * Vorlage und Datei. Nur mit Login, nicht in der Navigation verlinkt (wie /styleguide).
 */
export function DesignPage() {
  const t = useMessages(designMessages);
  const app = useT();
  const { locale, setLocale } = useLocale();

  useEffect(() => {
    document.title = `${t.title} – Reziproq`;
  }, [t]);

  const examples: Record<SectionId, React.ReactNode> = {
    insights: <InsightExample />,
    header: <HeaderExample />,
    supplierBar: <SupplierBarExample />,
    flow: <FlowExample />,
    logo: (
      <div className="flex flex-wrap items-center gap-8">
        <Logo name={app.app.name} />
        <BrandMark />
      </div>
    ),
    buttons: <Buttons />,
    chips: <Chips />,
    monogram: <Monograms />,
    toggle: <ToggleExample />,
    chain: <ChainExample />,
    steps: <StepsExample />,
    date: <DateExample locale={locale} />,
    list: <ListExample />,
    layers: <LayersExample />,
    draft: <DraftExample />,
    questions: (
      <GuideQuestions
        title={t.samples.questionsTitle}
        questions={t.samples.questions}
        headingAs="h3"
      />
    ),
    table: <TableExample />,
    timeline: <TimelineExample />,
    bar: <BarExample />,
    next: <NextStepExample />,
    card: <CardExample />,
  };

  return (
    <div className="min-h-svh bg-paper">
      <header className="bg-paper">
        <div className="mx-auto flex min-h-17 w-full max-w-300 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-12">
          <Logo name={app.app.name} />
          <SegmentedControl<Locale>
            label={t.language}
            value={locale}
            onChange={setLocale}
            options={[
              { value: 'de', label: 'Deutsch' },
              { value: 'en', label: 'English' },
            ]}
          />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-300 flex-col gap-8 px-4 pt-12 pb-16 sm:px-12">
        <div className="flex max-w-190 flex-col gap-3">
          <h1 className="text-title tracking-title-lg">{t.title}</h1>
          <p className="text-base text-muted-foreground">{t.intro}</p>
        </div>
        <nav aria-label={t.title} className="flex flex-wrap gap-2">
          {blocks.map((block) => (
            <a
              key={block.id}
              href={`#${block.id}`}
              className="inline-flex min-h-11 items-center rounded-full bg-card px-4 font-semibold text-sm text-text no-underline shadow-inset-line outline-none hover:bg-line-soft focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t.sections[block.id]}
            </a>
          ))}
        </nav>
        {blocks.map((block) => (
          <section
            key={block.id}
            id={block.id}
            aria-labelledby={`${block.id}-title`}
            data-block={block.id}
            className="flex scroll-mt-6 flex-col gap-5 rounded-lg bg-card p-5 shadow-card sm:p-7"
          >
            <div className="flex flex-col gap-1">
              <h2 id={`${block.id}-title`} className="font-semibold text-section tracking-section">
                {t.sections[block.id]}
              </h2>
              <p className="text-muted-foreground text-sm">{t.descriptions[block.id]}</p>
              <p className="flex flex-wrap gap-x-3 text-chip text-muted-foreground">
                <span>
                  {t.reference}:{' '}
                  {block.reference ? (
                    <code className="text-text">{block.reference}</code>
                  ) : (
                    t.everywhere
                  )}
                </span>
                <span className="min-w-0">
                  {t.source}:{' '}
                  {block.files.map((file) => (
                    <code key={file} className="mr-2 break-all text-text">
                      components/ui/{file}
                    </code>
                  ))}
                </span>
              </p>
            </div>
            <div className="min-w-0">{examples[block.id]}</div>
          </section>
        ))}
      </main>
    </div>
  );
}

function Buttons() {
  const s = useMessages(designMessages).samples;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button>{s.primary}</Button>
        <Button variant="secondary">{s.secondary}</Button>
        <Button variant="ghost">{s.ghost}</Button>
        <Button variant="link">{s.link}</Button>
        <Button size="sm" variant="secondary">
          {s.small}
        </Button>
        <Button loading>{s.loading}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-ink p-5">
        <Button variant="dark">{s.dark}</Button>
        <Button variant="mint" size="hero">
          {s.mint}
          <NextStepArrow />
        </Button>
      </div>
    </div>
  );
}

function Chips() {
  const s = useMessages(designMessages).samples;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>{s.chipNeutral}</Badge>
      <Badge variant="shared">{s.chipShared}</Badge>
      <Badge variant="success">{s.chipOk}</Badge>
      <Badge variant="warning">{s.chipWarn}</Badge>
      <Badge variant="danger">{s.chipRisk}</Badge>
      <Badge variant="ink">{s.chipInk}</Badge>
      <VisibilityBadge visibility="internal" label={s.internal} />
      <VisibilityBadge visibility="shared" label={s.shared} />
    </div>
  );
}

function Monograms() {
  const s = useMessages(designMessages).samples;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Monogram name={s.supplierA} tone="warning" />
      <Monogram name={s.supplierA} tone="shared" />
      <Monogram name={s.supplierC} tone="danger" />
      <Monogram name={s.supplierB} />
      <Monogram name={s.supplierB} tone="ink" />
      <Monogram name={s.supplierA} size="sm" />
      <Monogram name={s.supplierA} size="lg" ring />
    </div>
  );
}

function ToggleExample() {
  const s = useMessages(designMessages).samples;
  return (
    <SegmentedControl
      label={s.toggleLabel}
      value="mine"
      onChange={() => undefined}
      options={[
        { value: 'mine', label: s.toggleMine },
        { value: 'waiting', label: s.toggleWaiting },
        { value: 'actions', label: s.toggleActions },
      ]}
    />
  );
}

function ChainExample() {
  const s = useMessages(designMessages).samples;
  return (
    <Card className="flex max-w-80 flex-col gap-3.5 p-5.5">
      <span className="flex items-center justify-between gap-2.5">
        <strong className="font-display font-semibold text-base">{s.supplierA}</strong>
        <Badge variant="shared">{s.chipShared}</Badge>
      </span>
      <Chain label={s.chainLabel} steps={['done', 'done', 'done', 'current', 'open', 'open']} />
      <span className="text-muted-foreground text-sm">{s.chainText}</span>
    </Card>
  );
}

function StepsExample() {
  const s = useMessages(designMessages).samples;
  const states = ['done', 'done', 'done', 'current', 'open', 'open'] as const;
  return (
    <div className="flex flex-col gap-8">
      <Steps
        label={s.stepsLabel}
        doneLabel={s.done}
        items={s.steps.map((step, index) => ({
          key: step.title,
          title: step.title,
          detail: step.detail,
          state: states[index] ?? 'open',
        }))}
      />
      <Steps
        variant="inline"
        label={s.importLabel}
        doneLabel={s.done}
        items={s.importSteps.map((title, index) => ({
          key: title,
          title,
          state: index === 0 ? 'done' : index === 1 ? 'current' : 'open',
        }))}
      />
      <div className="max-w-120">
        <StepProgress
          current={2}
          total={4}
          label={s.progress}
          stepTitle={s.progressTitle}
          doneLabel={s.done}
        />
      </div>
    </div>
  );
}

function DateExample({ locale }: { locale: string }) {
  const s = useMessages(designMessages).samples;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card className="flex items-center gap-3.5 p-4">
        <DateCircle date="2026-12-04" locale={locale} next />
        <span className="flex flex-col gap-0.5">
          <strong className="font-semibold">{s.meetingA}</strong>
          <span className="text-muted-foreground text-sm">{s.meetingADetail}</span>
        </span>
      </Card>
      <Card className="flex items-center gap-3.5 p-4">
        <DateCircle date="2026-12-10" locale={locale} />
        <span className="flex flex-col gap-0.5">
          <strong className="font-semibold">{s.meetingB}</strong>
          <span className="text-muted-foreground text-sm">{s.meetingBDetail}</span>
        </span>
      </Card>
    </div>
  );
}

function ListExample() {
  const s = useMessages(designMessages).samples;
  return (
    <ListCard aria-labelledby="design-tasks" className="max-w-180">
      <ListCardHeader
        id="design-tasks"
        headingAs="h3"
        title={s.tasks}
        action={
          <Button variant="link" className="px-0">
            {s.link}
          </Button>
        }
      />
      <ListSection>{s.thisWeek}</ListSection>
      <ListRow>
        <Monogram name={s.supplierB} tone="warning" />
        <ListRowText title={s.taskA} detail={s.taskADetail} />
        <Badge variant="warning">{s.chipWarn}</Badge>
      </ListRow>
      <ListRow>
        <Monogram name={s.supplierA} tone="shared" />
        <ListRowText title={s.taskB} detail={s.taskBDetail} />
        <Badge>{s.chipNeutral}</Badge>
      </ListRow>
      <ListSection>{s.waiting}</ListSection>
      <ListRow>
        <Monogram name={s.supplierA} />
        <ListRowText title={s.taskC} detail={s.taskCDetail} />
        <Button variant="link" size="sm" className="px-0">
          {s.remind}
        </Button>
      </ListRow>
    </ListCard>
  );
}

function LayersExample() {
  const s = useMessages(designMessages).samples;
  return (
    <div className="flex flex-wrap gap-5">
      <LayerPanel
        layer="private"
        headingAs="h3"
        className="min-w-0 flex-1 basis-80"
        title={s.privateTitle}
        chip={s.privateChip}
        description={s.privateText}
      >
        <LayerItem layer="private" title={s.privateItem} detail={s.privateItemDetail} />
      </LayerPanel>
      <LayerPanel
        layer="shared"
        headingAs="h3"
        className="min-w-0 flex-1 basis-80"
        title={s.sharedTitle}
        chip={s.sharedChip}
        description={s.sharedText}
      >
        <LayerItem layer="shared" title={s.sharedItem} detail={s.sharedItemDetail} />
      </LayerPanel>
    </div>
  );
}

function DraftExample() {
  const s = useMessages(designMessages).samples;
  const sources = [
    { key: 'a', label: s.sourceA, href: '#draft' },
    { key: 'b', label: s.sourceB, href: '#draft' },
  ];
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <AiDraft
        heading={s.draftHeading}
        sourcesLabel={s.sources}
        sources={sources}
        actions={
          <>
            <Button>{s.adopt}</Button>
            <Button variant="secondary">{s.adjust}</Button>
            <Button variant="ghost">{s.discard}</Button>
          </>
        }
      >
        <p>{s.draftText}</p>
      </AiDraft>
      <AiDraft
        confirmed
        heading={`${s.draftHeading} · ${s.draftConfirmed}`}
        sourcesLabel={s.sources}
        sources={sources}
      >
        <p>{s.draftText}</p>
      </AiDraft>
    </div>
  );
}

function TableExample() {
  const s = useMessages(designMessages).samples;
  return (
    <Table>
      <TableCaption className="sr-only">{s.tableCaption}</TableCaption>
      <TableHeader>
        <TableRow>
          {s.tableHead.map((head) => (
            <TableHead key={head}>{head}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {s.tableRows.map(([name, target, actual, status]) => (
          <TableRow key={name}>
            <TableCell className="font-semibold">{name}</TableCell>
            <TableCell>{target}</TableCell>
            <TableCell>{actual}</TableCell>
            <TableCell>
              <Badge variant={status === s.chipOk ? 'success' : 'warning'}>{status}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TimelineExample() {
  const s = useMessages(designMessages).samples;
  return (
    <TimelineLanes
      label={s.timelineLabel}
      columns={s.quarters}
      milestoneLabel={s.milestone}
      stateLabels={{ running: s.running, planned: s.planned, done: s.finished }}
      rows={[
        {
          key: 'a',
          title: s.laneA,
          detail: s.laneADetail,
          bars: [
            { key: 'a1', start: 0, end: 1, state: 'done', label: s.barDone },
            { key: 'a2', start: 1, end: 3, state: 'running', label: s.barRunning },
          ],
          milestones: [{ key: 'm1', at: 3, label: s.milestoneA }],
        },
        {
          key: 'b',
          title: s.laneB,
          detail: s.laneBDetail,
          bars: [{ key: 'b1', start: 2, end: 4, state: 'planned', label: s.barPlanned }],
        },
      ]}
    />
  );
}

function BarExample() {
  const s = useMessages(designMessages).samples;
  return (
    <div className="flex max-w-120 flex-col gap-2">
      <span className="flex justify-between gap-3 text-sm">
        <strong className="font-semibold">{s.barLabel}</strong>
        <span className="text-muted-foreground tabular-nums">{s.barValue}</span>
      </span>
      <MeterBar value={0.46} label={`${s.barLabel}: ${s.barValue}`} />
    </div>
  );
}

function NextStepExample() {
  const s = useMessages(designMessages).samples;
  return (
    <div className="flex flex-col gap-5">
      <NextStep
        headingAs="h3"
        headingId="design-next"
        eyebrow={s.nextEyebrow}
        title={s.nextTitle}
        text={s.nextText}
        action={
          <Button variant="mint" size="hero" asChild>
            <a href="#next">
              {s.nextAction}
              <NextStepArrow />
            </a>
          </Button>
        }
      />
      <Card className="p-7">
        <NextStep
          nested
          headingAs="h3"
          headingId="design-next-nested"
          eyebrow={s.nestedEyebrow}
          title={s.nestedTitle}
          action={
            <Button variant="mint" size="lg" className="pr-2" asChild>
              <a href="#next">
                {s.nestedAction}
                <NextStepArrow />
              </a>
            </Button>
          }
        />
      </Card>
    </div>
  );
}

function CardExample() {
  const s = useMessages(designMessages).samples;
  return (
    <div className="flex flex-col gap-3.5 rounded-lg bg-paper p-5">
      <CardTitle as="h3">{s.cardTitle}</CardTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <Figure label={s.figureLabel} value={s.figureValue} note={s.figureNote} />
        <Figure label={s.figureLabelB} value="–" note={s.figureNoteB} />
      </div>
    </div>
  );
}

function HeaderExample() {
  const s = useMessages(designMessages).samples;
  const app = useT();
  return (
    // Schmal zeigt die Kopfleiste nur den Menüknopf; das Beispiel steht in einem Rahmen.
    <div className="overflow-hidden rounded-lg shadow-card">
      <GlobalBar
        sticky={false}
        label={s.navLabel}
        brand={app.app.name}
        brandHref="#header"
        items={s.navItems.map((label, index) => ({ key: `n${index}`, label, href: '#header' }))}
        activeKey="n1"
        actions={[
          {
            key: 'q',
            label: s.questionsLink,
            href: '#header',
            icon: <MessageCircleQuestionIcon aria-hidden />,
          },
          { key: 'p', label: s.profile, href: '#header', icon: null, initials: 'AS' },
        ]}
        menuHref="#header"
        menuLabel={s.menu}
      />
    </div>
  );
}

function SupplierBarExample() {
  const s = useMessages(designMessages).samples;
  return (
    <div className="overflow-hidden rounded-lg shadow-card">
      <LocalBar
        sticky={false}
        label={s.areasLabel}
        name={s.supplierA}
        nameIcon={<Monogram name={s.supplierA} size="lg" ring />}
        nameHref="#supplierBar"
        subtitle={s.supplierLine}
        progress={
          <LocalBarProgress>
            <Chain
              surface="paper"
              label={s.position}
              steps={['done', 'done', 'done', 'current', 'open', 'open']}
            />
            <span aria-hidden>{s.position}</span>
          </LocalBarProgress>
        }
        items={s.areas.map((label, index) => ({ key: `a${index}`, label, href: '#supplierBar' }))}
        activeKey="a3"
        subItems={s.pages.map((label, index) => ({
          key: `p${index}`,
          label,
          href: '#supplierBar',
        }))}
        subLabel={s.pagesLabel}
        activeSubKey="p2"
      />
    </div>
  );
}

function FlowExample() {
  const s = useMessages(designMessages).samples;
  return (
    <div className="rounded-lg bg-paper p-4 sm:p-6">
      <StepProgress
        chip={s.flowChip}
        title={s.flowTitle}
        current={2}
        total={6}
        label={s.progress}
        steps={s.pages}
        stepTitle={s.pages[1] ?? ''}
        doneLabel={s.done}
        doneWhen={{ label: s.doneLabel, text: s.doneText }}
        actions={
          <>
            <Button variant="ghost">{s.back}</Button>
            <Button variant="secondary">
              {s.next}
              <ArrowRightIcon aria-hidden />
            </Button>
          </>
        }
      />
    </div>
  );
}
