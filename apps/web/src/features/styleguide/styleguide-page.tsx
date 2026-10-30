import { useEffect } from 'react';

import { buildBridge } from '@/components/charts/bridge';
import { DumbbellChart } from '@/components/charts/dumbbell-chart';
import { Heatmap } from '@/components/charts/heatmap';
import { PnlBridge } from '@/components/charts/pnl-bridge';
import { SegmentMatrix } from '@/components/charts/segment-matrix';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { type Locale, useLocale, useMessages } from '@/lib/i18n';
import { formatMoney, formatNumber } from '@/lib/money';
import { type ThemePreference, usePageTheme } from '@/lib/theme';
import { BuildingBlocks } from './building-blocks';
import { Colors, Layout, Typography } from './foundations';
import { styleguideMessages } from './messages';
import { Section, SourceFiles } from './parts';
import {
  bridgeBaselineCents,
  bridgeLeverCents,
  businessUnitScores,
  currency,
  matrixSuppliers,
  perceptionGap,
} from './sample-data';
import { useTokenValues } from './tokens';

const sectionIds = ['colors', 'typography', 'layout', 'blocks', 'charts'] as const;

/** Alle Bausteine der Oberfläche auf einer Seite, in Hell und Dunkel (PLT-10). */
export function StyleguidePage() {
  const t = useMessages(styleguideMessages);
  const { locale, setLocale } = useLocale();
  const [theme, setTheme] = usePageTheme();
  const values = useTokenValues();

  useEffect(() => {
    document.title = `${t.title} – Reziproq`;
  }, [t]);

  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-56 shrink-0 bg-muted/90 px-3 py-6 backdrop-blur md:block">
        <nav aria-label={t.nav} className="flex flex-col gap-1">
          <span className="flex min-h-11 items-center px-3 font-semibold text-base">reziproq</span>
          {sectionIds.map((id) => (
            <a
              key={id}
              href={`#${id}`}
              className="flex min-h-11 items-center rounded-md px-3 text-base text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t.sections[id]}
            </a>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 bg-background/95 py-3 backdrop-blur">
          <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
            <h1 className="font-semibold text-xl">{t.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl<Locale>
                label={t.language}
                value={locale}
                onChange={setLocale}
                options={[
                  { value: 'de', label: 'Deutsch' },
                  { value: 'en', label: 'English' },
                ]}
              />
              <SegmentedControl<ThemePreference>
                label={`${t.theme.label}. ${t.themeHint}`}
                value={theme}
                onChange={setTheme}
                options={[
                  { value: 'system', label: t.theme.system },
                  { value: 'light', label: t.theme.light },
                  { value: 'dark', label: t.theme.dark },
                ]}
              />
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-4xl flex-col gap-20 px-4 pt-4 pb-24 sm:px-6">
          <p className="text-lg text-muted-foreground">{t.intro}</p>

          <Section id="colors" title={t.sections.colors}>
            <Colors values={values} />
          </Section>
          <Section id="typography" title={t.sections.typography}>
            <Typography values={values} />
          </Section>
          <Section id="layout" title={t.sections.layout}>
            <Layout values={values} />
          </Section>
          <Section id="blocks" title={t.sections.blocks}>
            <BuildingBlocks />
          </Section>
          <Section id="charts" title={t.sections.charts}>
            <Charts />
          </Section>
        </main>
      </div>
    </div>
  );
}

function Charts() {
  const t = useMessages(styleguideMessages);
  const { locale } = useLocale();
  const empty = { title: t.empty.chartTitle, description: t.empty.chartDescription };
  const money = (cents: number, options?: { signed?: boolean }) =>
    formatMoney({ amountCents: cents, currency }, locale, { compact: true, ...options });

  const bridge = buildBridge(
    { label: t.charts.bridge.baseline, amountCents: bridgeBaselineCents, currency },
    t.levers.map((label, i) => ({ label, amountCents: bridgeLeverCents[i] ?? 0 })),
    t.charts.bridge.total,
  );

  return (
    <div className="flex flex-col gap-16">
      <div className="flex flex-col gap-1">
        <SourceFiles
          files={[
            'src/components/charts/segment-matrix.tsx',
            'src/components/charts/dumbbell-chart.tsx',
            'src/components/charts/heatmap.tsx',
            'src/components/charts/pnl-bridge.tsx',
            'src/components/charts/chart-theme.ts',
          ]}
        />
        <p className="font-medium text-sm">{t.charts.sampleNote}</p>
      </div>
      <SegmentMatrix
        title={t.charts.matrix.title}
        description={t.charts.matrix.description}
        suppliers={matrixSuppliers}
        axes={{ x: t.charts.matrix.x, y: t.charts.matrix.y }}
        levels={t.charts.matrix.levels}
        formatVolume={(cents) => money(cents)}
        empty={empty}
      />
      <DumbbellChart
        title={t.charts.dumbbell.title}
        description={t.charts.dumbbell.description}
        rows={perceptionGap.map((row, i) => ({ dimension: t.dimensions[i] ?? '', ...row }))}
        names={t.charts.dumbbell}
        scale={{ min: 1, max: 5 }}
        format={(value) => formatNumber(value, locale)}
        empty={empty}
      />
      <Heatmap
        title={t.charts.heatmap.title}
        description={t.charts.heatmap.description}
        columns={t.businessUnits}
        rows={t.dimensions}
        values={businessUnitScores}
        scale={{ min: 1, max: 5 }}
        format={(value) => formatNumber(value, locale)}
        empty={empty}
      />
      <PnlBridge
        title={t.charts.bridge.title}
        description={t.charts.bridge.description}
        steps={bridge.steps}
        formatAxis={(cents) => money(cents)}
        formatDelta={(step) => money(step.deltaCents, { signed: step.kind !== 'total' })}
        empty={empty}
      />
      <DumbbellChart
        title={t.charts.dumbbell.title}
        rows={[]}
        names={t.charts.dumbbell}
        scale={{ min: 1, max: 5 }}
        format={(value) => formatNumber(value, locale)}
        empty={empty}
      />
    </div>
  );
}
