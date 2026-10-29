import {
  IconAlertTriangle,
  IconCircleCheck,
  IconDownload,
  IconEye,
  IconPlus,
  IconTarget,
} from '@tabler/icons-react';
import type * as React from 'react';

import { buildBridge } from '@/components/charts/bridge';
import { DumbbellChart } from '@/components/charts/dumbbell-chart';
import { Heatmap } from '@/components/charts/heatmap';
import { PnlBridge } from '@/components/charts/pnl-bridge';
import { SegmentMatrix } from '@/components/charts/segment-matrix';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-group';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { type Locale, useLocale, useMessages } from '@/lib/i18n';
import { formatMoney, formatNumber } from '@/lib/money';
import { type ThemePreference, useTheme } from '@/lib/theme';
import { styleguideMessages } from './messages';
import {
  bridgeBaselineCents,
  bridgeLeverCents,
  businessUnitScores,
  currency,
  matrixSuppliers,
  perceptionGap,
  tableRows,
} from './sample-data';

const sectionIds = [
  'colors',
  'typography',
  'buttons',
  'forms',
  'tables',
  'empty',
  'charts',
] as const;

const swatches = {
  neutral: [
    'background',
    'foreground',
    'muted',
    'muted-foreground',
    'secondary',
    'border',
    'input',
  ],
  accent: ['primary', 'primary-foreground', 'primary-soft', 'ring'],
  status: ['success', 'success-soft', 'warning', 'warning-soft', 'destructive', 'destructive-soft'],
  chart: [
    'chart-context',
    'chart-accent',
    'chart-strong',
    'chart-negative',
    'chart-field',
    'chart-seq-1',
    'chart-seq-2',
    'chart-seq-3',
    'chart-seq-4',
    'chart-seq-5',
  ],
} as const;

export function StyleguidePage() {
  const t = useMessages(styleguideMessages);
  const { locale, setLocale } = useLocale();
  const { preference, setPreference } = useTheme();

  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-56 shrink-0 bg-muted px-3 py-6 md:block">
        <nav aria-label={t.nav} className="flex flex-col gap-1">
          <span className="px-3 pb-2 font-semibold text-sm">reziproq</span>
          {sectionIds.map((id) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-md px-3 py-1 text-base text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {t.sections[id]}
            </a>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 bg-background/95 py-3 backdrop-blur">
          <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-6">
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
                label={t.theme.label}
                value={preference}
                onChange={setPreference}
                options={[
                  { value: 'system', label: t.theme.system },
                  { value: 'light', label: t.theme.light },
                  { value: 'dark', label: t.theme.dark },
                ]}
              />
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-4xl flex-col gap-16 px-6 pt-4 pb-24">
          <p className="text-lg text-muted-foreground">{t.intro}</p>

          <Section id="colors" title={t.sections.colors}>
            {(['neutral', 'accent', 'status', 'chart'] as const).map((group) => (
              <div key={group} className="flex flex-col gap-3">
                <h3 className="font-medium text-base">{t.colors[group]}</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                  {swatches[group].map((name) => (
                    <div key={name} className="flex flex-col gap-2">
                      <div
                        className="h-12 rounded-md border"
                        style={{ background: `var(--${name})` }}
                      />
                      <code className="text-muted-foreground text-sm">--{name}</code>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Section>

          <Section id="typography" title={t.sections.typography}>
            <div className="flex flex-col gap-4">
              {(
                [
                  ['text-xl font-semibold', 'xl', '28 / 36'],
                  ['text-lg font-semibold', 'lg', '20 / 28'],
                  ['text-base', 'base', '15 / 24'],
                  ['text-sm text-muted-foreground', 'sm', '13 / 20'],
                ] as const
              ).map(([className, size, metrics]) => (
                <div
                  key={size}
                  className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6"
                >
                  <code className="w-32 shrink-0 text-muted-foreground text-sm">
                    text-{size} · {metrics}
                  </code>
                  <span className={className}>
                    {t.typography.sample} – {t.typography[size]}
                  </span>
                </div>
              ))}
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
                <code className="w-32 shrink-0 text-muted-foreground text-sm">400 · 500 · 600</code>
                <p className="flex gap-4 text-base">
                  <span className="font-normal">{t.typography.weights}</span>
                  <span className="font-medium">Aa</span>
                  <span className="font-semibold">Aa</span>
                </p>
              </div>
            </div>
          </Section>

          <Section id="buttons" title={t.sections.buttons}>
            <div className="flex flex-wrap items-center gap-3">
              <Button>{t.buttons.primary}</Button>
              <Button variant="secondary">{t.buttons.secondary}</Button>
              <Button variant="outline">
                <IconDownload />
                {t.buttons.outline}
              </Button>
              <Button variant="ghost">{t.buttons.ghost}</Button>
              <Button variant="destructive">{t.buttons.destructive}</Button>
              <Button variant="link">{t.buttons.link}</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">
                <IconPlus />
                {t.buttons.add}
              </Button>
              <Button size="lg">
                <IconPlus />
                {t.buttons.add}
              </Button>
              <Button disabled>{t.buttons.disabled}</Button>
            </div>
          </Section>

          <Section id="forms" title={t.sections.forms}>
            <form className="flex flex-col gap-8" onSubmit={(event) => event.preventDefault()}>
              <SettingsGroup title={t.forms.group}>
                <SettingsRow label={t.forms.name} htmlFor="sg-name">
                  <div className="flex w-full flex-col gap-1">
                    <Input
                      id="sg-name"
                      placeholder={t.forms.namePlaceholder}
                      aria-invalid
                      aria-describedby="sg-name-error"
                    />
                    <p id="sg-name-error" className="text-destructive text-sm">
                      {t.forms.invalid}
                    </p>
                  </div>
                </SettingsRow>
                <SettingsRow
                  label={t.forms.commodity}
                  description={t.forms.commodityHint}
                  htmlFor="sg-commodity"
                >
                  <NativeSelect id="sg-commodity" defaultValue={t.forms.commodities[0]}>
                    {t.forms.commodities.map((commodity) => (
                      <option key={commodity}>{commodity}</option>
                    ))}
                  </NativeSelect>
                </SettingsRow>
                <SettingsRow label={t.forms.notes} htmlFor="sg-notes">
                  <Textarea id="sg-notes" placeholder={t.forms.notesPlaceholder} />
                </SettingsRow>
              </SettingsGroup>

              <SettingsGroup title={t.forms.shareGroup}>
                <SettingsRow
                  label={t.forms.share}
                  description={t.forms.shareHint}
                  htmlFor="sg-share"
                >
                  <Switch id="sg-share" defaultChecked />
                </SettingsRow>
                <SettingsRow label={t.forms.reminder} htmlFor="sg-reminder">
                  <Checkbox id="sg-reminder" defaultChecked />
                </SettingsRow>
              </SettingsGroup>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary">
                  {t.buttons.secondary}
                </Button>
                <Button type="submit">{t.buttons.primary}</Button>
              </div>
            </form>
          </Section>

          <Section id="tables" title={t.sections.tables}>
            <Table>
              <TableCaption>{t.table.caption}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.table.supplier}</TableHead>
                  <TableHead>{t.table.commodity}</TableHead>
                  <TableHead className="text-right">{t.table.volume}</TableHead>
                  <TableHead>{t.table.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.map((row) => (
                  <TableRow key={row.supplier}>
                    <TableCell className="font-medium">{row.supplier}</TableCell>
                    <TableCell>{t.forms.commodities[row.commodity]}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney({ amountCents: row.volumeCents, currency }, locale, {
                        compact: true,
                      })}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} label={t.table.statuses[row.status]} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>

          <Section id="empty" title={t.sections.empty}>
            <EmptyState
              icon={<IconTarget />}
              title={t.empty.title}
              description={t.empty.description}
              action={
                <Button>
                  <IconPlus />
                  {t.empty.action}
                </Button>
              }
            />
            <DumbbellChart
              title={t.charts.dumbbell.title}
              rows={[]}
              names={t.charts.dumbbell}
              scale={{ min: 1, max: 5 }}
              format={(value) => formatNumber(value, locale)}
              empty={{ title: t.empty.chartTitle, description: t.empty.chartDescription }}
            />
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
      <p className="text-muted-foreground text-sm">{t.charts.sampleNote}</p>
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
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-20 flex-col gap-6">
      <h2 id={`${id}-title`} className="font-semibold text-lg">
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatusBadge({ status, label }: { status: 'ok' | 'watch' | 'risk'; label: string }) {
  if (status === 'ok') {
    return (
      <Badge variant="success">
        <IconCircleCheck aria-hidden />
        {label}
      </Badge>
    );
  }
  if (status === 'watch') {
    return (
      <Badge variant="warning">
        <IconEye aria-hidden />
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="danger">
      <IconAlertTriangle aria-hidden />
      {label}
    </Badge>
  );
}
