import {
  ChartScatterIcon,
  CircleDotDashedIcon,
  HouseIcon,
  LayersIcon,
  LockIcon,
  MessageCircleQuestionIcon,
  SettingsIcon,
  UsersRoundIcon,
} from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { AkteHead } from '@/components/ui/akte-head';
import { AppShell, ShellContent } from '@/components/ui/app-shell';
import { AskOverlay } from '@/components/ui/ask-overlay';
import { Badge } from '@/components/ui/badge';
import { BrandMark } from '@/components/ui/brand-mark';
import { Button } from '@/components/ui/button';
import { ChartBars, ChartCard, ChartColumns, ChartFigures } from '@/components/ui/chart-card';
import { Collapsible } from '@/components/ui/collapsible';
import { DateList } from '@/components/ui/date-list';
import { CategoryHeader, SupplierHeader } from '@/components/ui/entity-header';
import { FilterChips } from '@/components/ui/filter-chips';
import { FormField } from '@/components/ui/form-field';
import { FormGroup, FormPage } from '@/components/ui/form-page';
import { Input } from '@/components/ui/input';
import { MiniMirror } from '@/components/ui/mini-mirror';
import { Mirror } from '@/components/ui/mirror';
import { Monogram } from '@/components/ui/monogram';
import { NextCard } from '@/components/ui/next-card';
import { type ChainState, ProcessChain } from '@/components/ui/process-chain';
import { Row, RowGroup, RowHead, RowHeads } from '@/components/ui/row-group';
import { SectionCard } from '@/components/ui/section-card';
import { SegmentMatrix } from '@/components/ui/segment-matrix';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Sheet } from '@/components/ui/sheet';
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
  const [sheet, setSheet] = useState(false);
  const [chip, setChip] = useState('alle');
  const [moreOpen, setMoreOpen] = useState(false);
  const [ask, setAsk] = useState(false);
  const [level, setLevel] = useState<'suggest' | 'prepare' | 'do'>('prepare');
  useEffect(() => {
    document.title = `${t.title} – Reziproq`;
  }, [t]);

  // NAV-10 2.0: Heute, Beziehungen, Warengruppen, Wert
  const items = [
    {
      key: 'myDay',
      label: t.nav.myDay,
      href: '/heute',
      icon: <HouseIcon aria-hidden />,
      badge: 3,
    },
    {
      key: 'suppliers',
      label: t.nav.suppliers,
      href: '/beziehungen',
      icon: <UsersRoundIcon aria-hidden />,
    },
    {
      key: 'categories',
      label: t.nav.categories,
      href: '/warengruppen',
      icon: <LayersIcon aria-hidden />,
    },
    {
      key: 'overview',
      label: t.nav.overview,
      href: '/wert',
      icon: <ChartScatterIcon aria-hidden />,
    },
  ];
  const askTab = {
    key: 'ask',
    label: t.nav.ask,
    href: '/bausteine',
    icon: <MessageCircleQuestionIcon aria-hidden />,
    onSelect: () => setAsk(true),
  };
  const section = (id: string, label: string) => (
    <h2
      id={id}
      className="px-1 pt-4 font-semibold text-muted-foreground text-sm uppercase tracking-label"
    >
      {label}
    </h2>
  );

  return (
    <AppShell
      label={t.nav.label}
      brand="Reziproq"
      brandHref="/bausteine"
      search={{
        key: 'ask',
        label: t.nav.search,
        href: '/bausteine',
        shortcut: '⌘K',
        onOpen: () => setAsk(true),
      }}
      items={items}
      background={{ label: t.nav.background, href: '/bausteine' }}
      footer={[
        {
          key: 'myAgent',
          label: t.nav.myAgent,
          href: '/bausteine',
          icon: <CircleDotDashedIcon aria-hidden />,
        },
      ]}
      settings={{
        key: 'settings',
        label: t.nav.settings,
        href: '/einstellungen',
        icon: <SettingsIcon aria-hidden />,
      }}
      person={{ initials: 'JL', name: 'Jan-Luka', href: '/profil', label: t.nav.profile }}
      tabs={[...items.slice(0, 2), askTab, ...items.slice(2)]}
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
          action={{ label: t.next.action, href: '/beziehungen' }}
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
            ...(index < 2 ? { href: '/heute' } : {}),
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
              href: '/heute',
            }}
            items={t.rail.items.map(([kind, title, sub, tone, day]) => ({
              key: title,
              date: `2026-12-${String(day - 7).padStart(2, '0')}`,
              kind,
              title,
              sub,
              tone,
              href: '/beziehungen',
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
                href: '/beziehungen',
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
            href: '/beziehungen',
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
            href: '/beziehungen',
            state: stateOf(index, 1),
          }))}
          renderLink={routerLink}
        />

        {section('rows', t.sections.rows)}
        <RowGroup label={t.rows.label}>
          {t.rows.items.map(([code, title, detail]) => (
            <Row
              key={title}
              href="/heute"
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

        {section('filter-chips', t.sections.filterChips)}
        {/* BZ-01 (K2-b.4): Filter-Chips der Seite Lieferanten, Vorlage Lieferanten */}
        <FilterChips
          label={t.filterChips.label}
          value={chip}
          onChange={setChip}
          options={t.filterChips.options.map(([value, label, count]) => ({ value, label, count }))}
          more={{
            label: t.filterChips.more,
            expanded: moreOpen,
            active: 0,
            onToggle: () => setMoreOpen(!moreOpen),
            controls: 'bausteine-mehr-filter',
          }}
        />
        {moreOpen && (
          <p id="bausteine-mehr-filter" className="rounded-lg bg-card p-4 text-base">
            {t.filterChips.panel}
          </p>
        )}

        {section('mirror', t.sections.mirror)}
        <div className="flex flex-col gap-2">
          <RowHeads>
            <RowHead className="flex-1">{t.mirror.heads[0]}</RowHead>
            <RowHead className="w-50 text-center">{t.mirror.heads[1]}</RowHead>
            <span className="w-4" />
          </RowHeads>
          <RowGroup>
            {t.mirror.rows.map(([name, detail, own, counterpart]) => (
              <Row
                key={name}
                href="/beziehungen"
                lead={<Monogram name={name} tone="petrol" />}
                title={name}
                detail={detail}
                value={
                  <>
                    <span className="hidden shell:flex">
                      <MiniMirror
                        own={own}
                        counterpart={counterpart}
                        label={t.mirror.label(name, own, counterpart)}
                      />
                    </span>
                    <span className="flex shell:hidden">
                      <MiniMirror
                        size="sm"
                        own={own}
                        counterpart={counterpart}
                        label={t.mirror.label(name, own, counterpart)}
                      />
                    </span>
                  </>
                }
                renderLink={routerLink}
              />
            ))}
          </RowGroup>
        </div>

        {section('matrix', t.sections.matrix)}
        {/* BZ-01 (K2-b.5): Matrix der Linse Segmente, Vorlage K2-Segmente */}
        <SegmentMatrix
          size={2}
          label={t.matrix.label}
          disputedLabel={t.matrix.disputed}
          renderLink={routerLink}
          fields={t.matrix.fields.map(([key, name, count, value, top, names, rest]) => ({
            key,
            name,
            count,
            value,
            top,
            rest,
            href: '/beziehungen?linse=segmente',
            names: names.map(([label, disputed]) => ({ key: label, label, disputed })),
          }))}
        />

        {section('akte', t.sections.akte)}
        {/* AK-01 (K2-c.2): Kopf der Akte mit Sichten, Spiegel und Gruppe „geteilt“ */}
        <AkteHead
          back={{ label: t.akte.back, href: '/beziehungen' }}
          name={t.akte.name}
          meta={t.akte.meta}
          actionsLabel={t.akte.actions}
          actions={[
            { key: 'wert', label: t.akte.value, href: '#akte' },
            { key: 'briefing', label: t.akte.briefing, href: '#akte' },
          ]}
          more={{ label: t.akte.more, href: '#akte' }}
          views={{
            label: t.akte.views,
            active: 'gemeinsam',
            items: [
              {
                key: 'gemeinsam',
                label: t.akte.shared,
                href: '#akte',
                icon: <BrandMark className="h-3.5 w-5" />,
              },
              {
                key: 'privat',
                label: t.akte.private,
                href: '#akte',
                icon: <LockIcon aria-hidden className="size-3.5 shrink-0" />,
              },
              {
                key: 'geteilt',
                label: t.akte.counterpart,
                href: '#akte',
                icon: <span aria-hidden className="size-2 shrink-0 rounded-full bg-petrol" />,
              },
            ],
          }}
          renderLink={routerLink}
        />
        <Mirror
          className="rounded-lg bg-card p-5"
          label={t.akte.mirrorLabel}
          own={{ percent: 90, text: t.akte.own }}
          counterpart={{ percent: 78, text: t.akte.other }}
          caption={t.akte.caption}
        />
        <RowGroup tone="shared" label={t.akte.group}>
          {t.akte.rows.map(([title, detail, chip]) => (
            <Row
              key={title}
              lead={<Monogram name="Rheintal" tone="petrol" />}
              title={title}
              detail={detail}
              value={<Badge variant="neutral">{chip}</Badge>}
            />
          ))}
        </RowGroup>

        {section('segmented', t.sections.segmented)}
        {/* MA-01 (K1-f.3): Stufen-Umschalter wie in Mein Agent; eine nicht erlaubte Stufe ist gesperrt */}
        <RowGroup label={t.segmented.groupLabel}>
          <Row
            title={t.segmented.task}
            detail={t.segmented.hint}
            control={
              <SegmentedControl
                label={t.segmented.label}
                value={level}
                onChange={setLevel}
                options={[
                  { value: 'suggest', label: t.segmented.levels.suggest },
                  { value: 'prepare', label: t.segmented.levels.prepare },
                  { value: 'do', label: t.segmented.levels.do, disabled: true },
                ]}
              />
            }
          />
        </RowGroup>

        {section('section-card', t.sections.sectionCard)}
        {/* DM-01 (K1-g.4): Karte mit Abschnittslabel innen, wie in der Vorlage Demo-Regie */}
        <SectionCard label={t.sectionCard.label}>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="secondary">{t.sectionCard.first}</Button>
            <Button variant="secondary">{t.sectionCard.second}</Button>
          </div>
          <p className="text-detail text-muted-foreground">{t.sectionCard.note}</p>
        </SectionCard>

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
          back={{ label: t.supplier.back, href: '/beziehungen' }}
          name={t.supplier.name}
          meta={t.supplier.meta}
          areasLabel={t.supplier.areas}
          areas={t.supplier.areaNames.map((label) => ({ key: label, label, href: '/beziehungen' }))}
          activeArea={t.supplier.areaNames[2]}
          pagesLabel={t.supplier.pages}
          pages={t.supplier.pageNames.map((label) => ({ key: label, label, href: '/beziehungen' }))}
          activePage={t.supplier.pageNames[1]}
          profile={{ label: t.supplier.profile, href: '/beziehungen', active: false }}
          renderLink={routerLink}
        />

        {section('sheet', t.sections.sheet)}
        <div className="flex flex-col items-start gap-2">
          <Button type="button" variant="secondary" onClick={() => setSheet(true)}>
            {t.sheet.open}
          </Button>
          <p className="text-muted-foreground text-sm">{t.sheet.hint}</p>
        </div>
        <Sheet
          open={sheet}
          onClose={() => setSheet(false)}
          title={t.sheet.title}
          closeLabel={t.sheet.close}
        >
          <RowGroup>
            {t.sheet.rows.map(([label, value]) => (
              <Row key={label} title={label} value={value} />
            ))}
          </RowGroup>
        </Sheet>

        {section('ask', t.sections.ask)}
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          onClick={() => setAsk(true)}
        >
          {t.ask.open}
        </Button>
        <AskOverlay
          open={ask}
          onClose={() => setAsk(false)}
          title={t.ask.title}
          closeLabel={t.ask.close}
        >
          <p className="text-base">{t.ask.body}</p>
        </AskOverlay>

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
      </ShellContent>
    </AppShell>
  );
}
