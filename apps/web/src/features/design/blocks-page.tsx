import {
  ChartScatterIcon,
  HouseIcon,
  LayersIcon,
  MessageCircleQuestionIcon,
  SettingsIcon,
  UsersRoundIcon,
} from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { AppShell, ShellContent } from '@/components/ui/app-shell';
import { ChartBars, ChartCard, ChartColumns, ChartFigures } from '@/components/ui/chart-card';
import { Collapsible } from '@/components/ui/collapsible';
import { DateList } from '@/components/ui/date-list';
import { CategoryHeader, SupplierHeader } from '@/components/ui/entity-header';
import { FlowBar } from '@/components/ui/flow-bar';
import { FormField } from '@/components/ui/form-field';
import { FormGroup, FormPage } from '@/components/ui/form-page';
import { Input } from '@/components/ui/input';
import { Monogram } from '@/components/ui/monogram';
import { NextCard } from '@/components/ui/next-card';
import { type ChainState, ProcessChain } from '@/components/ui/process-chain';
import { Row, RowGroup } from '@/components/ui/row-group';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SoWhat, type SoWhatTone } from '@/components/ui/so-what';
import { StatusDot } from '@/components/ui/status-dot';
import { StatusLine } from '@/components/ui/status-line';
import { TimelineRail } from '@/components/ui/timeline-rail';
import { routerLink } from '@/features/shell/navigation';
import { type Locale, useLocale, useMessages } from '@/lib/i18n';
import { blocksMessages } from './blocks-messages';

const stateOf = (index: number, current: number): ChainState =>
  index < current ? 'done' : index === current ? 'current' : 'open';
const tones: SoWhatTone[] = ['danger', 'warning', 'success'];

/**
 * Testseite /bausteine (UX-20 Phase 1): jeder Baustein aus UX-20 einmal, im neuen Rahmen
 * `AppShell`, mit den Texten der Vorlagen. Nur mit Login, nicht in der Navigation verlinkt.
 */
export function BlocksPage() {
  const t = useMessages(blocksMessages);
  const { locale, setLocale } = useLocale();
  const [sent, setSent] = useState(false);
  useEffect(() => {
    document.title = `${t.title} – Reziproq`;
  }, [t]);

  const items = [
    {
      key: 'overview',
      label: t.nav.overview,
      href: '/uebersicht',
      icon: <ChartScatterIcon aria-hidden />,
    },
    {
      key: 'myDay',
      label: t.nav.myDay,
      href: '/mein-tag',
      icon: <HouseIcon aria-hidden />,
      badge: 3,
    },
    {
      key: 'suppliers',
      label: t.nav.suppliers,
      href: '/lieferanten',
      icon: <UsersRoundIcon aria-hidden />,
    },
    {
      key: 'categories',
      label: t.nav.categories,
      href: '/warengruppen',
      icon: <LayersIcon aria-hidden />,
    },
  ];
  const section = (id: string, label: string) => (
    <h2
      id={id}
      className="px-1 pt-4 font-semibold text-input-border text-sm uppercase tracking-label"
    >
      {label}
    </h2>
  );

  return (
    <AppShell
      label={t.nav.label}
      brand="Reziproq"
      brandHref="/bausteine"
      search={{ key: 'ask', label: t.nav.search, href: '/fragen', shortcut: '⌘K' }}
      items={items}
      settings={{
        key: 'settings',
        label: t.nav.settings,
        href: '/einstellungen',
        icon: <SettingsIcon aria-hidden />,
      }}
      person={{ initials: 'JL', name: 'Jan-Luka', href: '/profil', label: t.nav.profile }}
      tabs={[
        ...items,
        {
          key: 'ask',
          label: t.nav.ask,
          href: '/fragen',
          icon: <MessageCircleQuestionIcon aria-hidden />,
        },
      ]}
      activeKey="myDay"
      renderLink={routerLink}
    >
      <ShellContent id="inhalt">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-balance font-display font-bold text-title-phone tracking-title shell:text-title">
              {t.title}
            </h1>
            <span className="text-base text-muted-foreground">{t.where}</span>
          </div>
          <SegmentedControl<Locale>
            label={t.language}
            value={locale}
            onChange={setLocale}
            options={[
              { value: 'de', label: 'Deutsch' },
              { value: 'en', label: 'English' },
            ]}
          />
        </header>

        {section('next', t.sections.next)}
        <NextCard
          kicker={t.next.kicker}
          title={t.next.title}
          text={t.next.text}
          action={{ label: t.next.action, href: '/lieferanten' }}
          renderLink={routerLink}
        />

        {section('so-what', t.sections.soWhat)}
        <SoWhat
          heading={t.soWhat.heading}
          statement={t.soWhat.statement}
          points={t.soWhat.points.map(([status, text], index) => ({
            key: status,
            status,
            text,
            tone: tones[index] ?? 'neutral',
            ...(index < 2 ? { href: '/mein-tag' } : {}),
          }))}
          aside={
            <ChartCard title={t.soWhat.figuresTitle} source={t.soWhat.figuresSource}>
              <ChartFigures
                items={t.soWhat.figures.map(([value, label]) => ({ key: label, value, label }))}
              />
            </ChartCard>
          }
          renderLink={routerLink}
        />

        {section('chart', t.sections.chart)}
        <div className="grid gap-5.5 wide:grid-cols-2">
          <ChartCard
            label={t.chart.label}
            title={t.chart.title}
            source={t.chart.source}
            link={{ label: t.chart.link, href: '/warengruppen' }}
            renderLink={routerLink}
          >
            <ChartBars
              items={t.chart.bars.map(([label, share, value], index) => ({
                key: label,
                label,
                share,
                value,
                ...(index === 2 ? { potential: 0.78 } : {}),
              }))}
            />
          </ChartCard>
        </div>

        {section('rail', t.sections.rail)}
        <ChartCard label={t.rail.kicker} title={t.rail.label}>
          <TimelineRail
            label={t.rail.label}
            locale={locale}
            today={{
              key: 'today',
              date: '2026-11-23',
              kind: t.rail.today[0],
              title: t.rail.today[1],
              sub: t.rail.today[2],
              href: '/mein-tag',
            }}
            items={t.rail.items.map(([kind, title, sub, tone, day]) => ({
              key: title,
              date: `2026-12-${String(day - 7).padStart(2, '0')}`,
              kind,
              title,
              sub,
              tone,
              href: '/lieferanten',
            }))}
            renderLink={routerLink}
          />
        </ChartCard>

        {section('dates', t.sections.dates)}
        <div className="grid gap-5.5 wide:grid-cols-2">
          <ChartCard label={t.dates.kicker} title={t.dates.title}>
            <DateList
              locale={locale}
              items={t.dates.items.map(([title, sub, chip, day]) => ({
                key: title,
                date: `2026-12-${String(day - 7).padStart(2, '0')}`,
                title,
                sub,
                chip: { label: chip, tone: 'shared' as const },
                href: '/lieferanten',
              }))}
              renderLink={routerLink}
            />
          </ChartCard>
          <ChartCard title={t.columns.label}>
            <ChartColumns
              label={t.columns.label}
              items={t.columns.items.map(([label, value, share]) => ({
                key: label,
                label,
                value,
                share,
              }))}
            />
          </ChartCard>
        </div>

        {section('dots', t.sections.dots)}
        <div className="flex flex-wrap gap-5 rounded-lg bg-card p-5 text-sm">
          {t.dots.map(([tone, label]) => (
            <StatusDot key={label} tone={tone} label={label} />
          ))}
        </div>

        {section('chain', t.sections.chain)}
        <ProcessChain
          label={t.chain.label}
          stateLabels={t.flow.states}
          steps={t.chain.steps.map((label, index) => ({
            key: label,
            label,
            href: '/lieferanten',
            state: stateOf(index, 3),
            // Ohne Recht: grau und ohne Link (UX-20)
            ...(index === 5 ? { allowed: false } : {}),
          }))}
          renderLink={routerLink}
        />
        <ProcessChain
          label={t.chain.phases}
          stateLabels={t.flow.states}
          steps={t.chain.phaseSteps.map((label, index) => ({
            key: label,
            label,
            href: '/lieferanten',
            state: stateOf(index, 1),
          }))}
          renderLink={routerLink}
        />

        {section('rows', t.sections.rows)}
        <RowGroup label={t.rows.label}>
          {t.rows.items.map(([code, title, detail]) => (
            <Row
              key={title}
              href="/mein-tag"
              lead={<Monogram name={code} />}
              title={title}
              detail={detail}
              renderLink={routerLink}
            />
          ))}
        </RowGroup>
        <RowGroup label={t.rows.waitingLabel}>
          <Row
            lead={<Monogram name={t.rows.waiting[0]} />}
            title={t.rows.waiting[1]}
            detail={t.rows.waiting[2]}
            value={t.rows.waiting[3]}
          />
        </RowGroup>

        {section('collapsible', t.sections.collapsible)}
        <div className="flex flex-col gap-2.5">
          <Collapsible title={t.collapsible.questions}>
            <ol className="flex list-decimal flex-col gap-1 pl-5">
              {t.collapsible.questionsBody.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ol>
          </Collapsible>
          <Collapsible title={t.collapsible.who}>
            <p>{t.collapsible.whoBody}</p>
          </Collapsible>
        </div>

        {section('form', t.sections.form)}
        {sent && <StatusLine message={t.form.sent} onHidden={() => setSent(false)} />}
        <FormPage
          label={t.form.label}
          primary={t.form.primary}
          secondary={{ label: t.form.secondary, href: '/bausteine' }}
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setSent(true);
          }}
          renderLink={routerLink}
        >
          <FormGroup label={t.form.group}>
            <FormField label={t.form.name}>
              {(field) => <Input {...field} defaultValue="Nils Ott" />}
            </FormField>
            <FormField label={t.form.email}>
              {(field) => (
                <Input {...field} type="email" defaultValue="nils.ott@rheintal.example" />
              )}
            </FormField>
            <FormField label={t.form.role} hint={t.form.roleHint}>
              {(field) => <Input {...field} defaultValue="Qualität · Leitung" />}
            </FormField>
          </FormGroup>
        </FormPage>

        {section('supplier', t.sections.supplier)}
        <SupplierHeader
          back={{ label: t.supplier.back, href: '/lieferanten' }}
          name={t.supplier.name}
          meta={t.supplier.meta}
          areasLabel={t.supplier.areas}
          areas={t.supplier.areaNames.map((label) => ({ key: label, label, href: '/lieferanten' }))}
          activeArea={t.supplier.areaNames[2]}
          pagesLabel={t.supplier.pages}
          pages={t.supplier.pageNames.map((label) => ({ key: label, label, href: '/lieferanten' }))}
          activePage={t.supplier.pageNames[1]}
          profile={{ label: t.supplier.profile, href: '/lieferanten', active: false }}
          renderLink={routerLink}
        />

        {section('category', t.sections.category)}
        <CategoryHeader
          back={{ label: t.category.back, href: '/warengruppen' }}
          name={t.category.name}
          meta={t.category.meta}
          areasLabel={t.category.areas}
          areas={t.category.areaNames.map((label) => ({
            key: label,
            label,
            href: '/warengruppen',
          }))}
          activeArea={t.category.areaNames[1]}
          renderLink={routerLink}
        />

        {section('flow', t.sections.flow)}
        <FlowBar
          title={t.flow.title}
          stepLabel={t.flow.step}
          context={t.flow.context}
          prev={{ label: t.flow.prev, href: '/lieferanten' }}
          next={{ label: t.flow.next, href: '/lieferanten' }}
          steps={t.flow.steps.map((label, index) => {
            const state = stateOf(index, 1);
            return {
              key: label,
              label,
              href: '/lieferanten',
              state,
              stateLabel: t.flow.states[state],
            };
          })}
          doneWhenLabel={t.flow.doneWhenLabel}
          doneWhen={t.flow.doneWhen}
          renderLink={routerLink}
        />
      </ShellContent>
    </AppShell>
  );
}
