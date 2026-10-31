import {
  CircleCheckIcon,
  DownloadIcon,
  EyeIcon,
  PlusIcon,
  TargetIcon,
  TriangleAlertIcon,
  XIcon,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { CheckboxGroup, FormActions, FormField } from '@/components/ui/form-field';
import { HistoryList } from '@/components/ui/history-list';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { SearchInput } from '@/components/ui/search-input';
import { StatusLine } from '@/components/ui/status-line';
import { StepActions, StepProgress } from '@/components/ui/step-progress';
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
import { Tile, TileActions, TileIcon, TileMetric, TileText, TileTitle } from '@/components/ui/tile';
import { VisibilityBadge } from '@/components/ui/visibility-badge';
import { useLocale, useMessages } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { styleguideMessages } from './messages';
import { Subsection } from './parts';
import { currency, tableRows } from './sample-data';

const buttonVariants = ['default', 'secondary', 'ghost', 'destructive'] as const;
const buttonStates = ['normal', 'hover', 'focus', 'disabled', 'loading'] as const;

/** Alle Bausteine aus src/components/ui, jeweils mit Herkunft. Keine Fenster, Panels oder Toasts. */
export function BuildingBlocks() {
  const t = useMessages(styleguideMessages);
  const { locale } = useLocale();
  const b = t.blocks;

  return (
    <>
      <Subsection title={b.tiles} description={b.tilesHint} files={['src/components/ui/tile.tsx']}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm">{b.tileLarge}</p>
            <Tile size="lg" className="items-center">
              <TileIcon>
                <TargetIcon aria-hidden />
              </TileIcon>
              <TileTitle>{b.tileSample.title}</TileTitle>
              <TileText>{b.tileSample.sentence}</TileText>
              <TileMetric value={b.tileSample.metricValue} label={b.tileSample.metricLabel} />
              <TileActions>
                <Button>{b.tileSample.open}</Button>
                <Button variant="outline">{b.tileSample.details}</Button>
              </TileActions>
            </Tile>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm">{b.tileSmall}</p>
            <Tile size="sm">
              <h4 className="font-semibold text-lg">{b.tileSample.supplier}</h4>
              <dl className="flex flex-col gap-1 text-sm">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">{b.tileSample.country}</dt>
                  <dd>{b.tileSample.countryValue}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">{t.table.commodity}</dt>
                  <dd>{t.forms.commodities[0]}</dd>
                </div>
              </dl>
              <p className="flex items-baseline justify-between gap-2">
                <span className="text-muted-foreground text-sm">{b.tileSample.spend}</span>
                <span className="font-semibold text-base tabular-nums">
                  {formatMoney({ amountCents: 1_840_000_00, currency }, locale, {
                    wholeUnits: true,
                  })}
                </span>
              </p>
            </Tile>
          </div>
        </div>
      </Subsection>

      <Subsection title={b.buttons} files={['src/components/ui/button.tsx']}>
        <div className="flex flex-col gap-4">
          {buttonVariants.map((variant) => (
            <div key={variant} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <span className="w-28 shrink-0 text-muted-foreground text-sm">
                {b.variants[variant]}
              </span>
              <div className="flex flex-wrap gap-3">
                {buttonStates.map((state) => (
                  <Button
                    key={state}
                    variant={variant}
                    data-preview={state === 'hover' || state === 'focus' ? state : undefined}
                    disabled={state === 'disabled'}
                    loading={state === 'loading'}
                  >
                    {b.states[state]}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <span className="w-28 shrink-0 text-muted-foreground text-sm">{b.more}</span>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline">
              <DownloadIcon />
              {b.outline}
            </Button>
            <Button variant="link">{b.link}</Button>
            <Button size="sm">
              <PlusIcon />
              {b.add}
            </Button>
            <Button size="lg">
              <PlusIcon />
              {b.add}
            </Button>
            <Button size="icon" variant="ghost" aria-label={b.close}>
              <XIcon />
            </Button>
          </div>
        </div>
      </Subsection>

      <FormPageExample />
      <StepsExample />
      <ConfirmExample />
      <StatusLineExample />

      <Subsection
        title={b.visibility}
        description={b.visibilityHint}
        files={['src/components/ui/visibility-badge.tsx']}
      >
        <div className="flex flex-wrap gap-3">
          <VisibilityBadge visibility="internal" label={b.internal} />
          <VisibilityBadge visibility="shared" label={b.shared} />
        </div>
      </Subsection>

      <Subsection
        title={b.stateBlocks}
        files={[
          'src/components/ui/empty-state.tsx',
          'src/components/ui/loading-state.tsx',
          'src/components/ui/error-state.tsx',
        ]}
      >
        <EmptyState
          icon={<TargetIcon />}
          title={t.empty.title}
          description={t.empty.description}
          action={
            <Button>
              <PlusIcon />
              {t.empty.action}
            </Button>
          }
        />
        <LoadingState label={b.loading} />
        <ErrorState
          title={b.error.title}
          description={b.error.description}
          action={<Button variant="secondary">{b.error.retry}</Button>}
        />
      </Subsection>

      <Subsection
        title={b.lists}
        files={[
          'src/components/ui/badge.tsx',
          'src/components/ui/table.tsx',
          'src/components/ui/history-list.tsx',
        ]}
      >
        <h4 className="font-medium text-base">{b.badges}</h4>
        <div className="flex flex-wrap gap-3">
          <Badge variant="neutral">{t.forms.commodities[0]}</Badge>
          <Badge variant="selected">{t.forms.shareGroup}</Badge>
          <StatusBadge status="ok" label={t.table.statuses.ok} />
          <StatusBadge status="watch" label={t.table.statuses.watch} />
          <StatusBadge status="risk" label={t.table.statuses.risk} />
        </div>

        <h4 className="font-medium text-base">{b.table}</h4>
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

        <h4 className="font-medium text-base">{b.history}</h4>
        <HistoryList
          entries={b.historyEntries.map((entry, index) => ({ id: String(index), ...entry }))}
          loadingLabel={b.historyLoading}
          empty={b.historyEmpty}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <HistoryList entries={[]} loadingLabel={b.historyLoading} empty={b.historyEmpty} />
          <HistoryList
            entries={[]}
            loading
            loadingLabel={b.historyLoading}
            empty={b.historyEmpty}
          />
        </div>
      </Subsection>
    </>
  );
}

/** Formularseite: Felder untereinander, Fehler am Feld, Speichern und Abbrechen unten. */
function FormPageExample() {
  const t = useMessages(styleguideMessages);
  const b = t.blocks;
  const [units, setUnits] = useState<string[]>([b.businessUnitOptions[0] ?? '']);
  const [saved, setSaved] = useState(false);

  return (
    <Subsection
      title={b.formPage}
      description={b.formPageHint}
      files={[
        'src/components/ui/form-field.tsx',
        'src/components/ui/input.tsx',
        'src/components/ui/search-input.tsx',
        'src/components/ui/native-select.tsx',
        'src/components/ui/switch.tsx',
        'src/components/ui/textarea.tsx',
      ]}
    >
      {saved && <StatusLine message={t.forms.saved} onHidden={() => setSaved(false)} />}
      <form
        className="flex max-w-xl flex-col gap-6 rounded-xl bg-muted p-6"
        onSubmit={(event) => {
          event.preventDefault();
          setSaved(true);
        }}
      >
        <FormField label={t.forms.name} error={t.forms.invalid}>
          {(field) => <Input {...field} placeholder={t.forms.namePlaceholder} />}
        </FormField>
        <FormField label={b.searchLabel}>
          {(field) => <SearchInput id={field.id} placeholder={b.searchPlaceholder} />}
        </FormField>
        <FormField label={t.forms.commodity} hint={t.forms.commodityHint}>
          {(field) => (
            <NativeSelect {...field} defaultValue={t.forms.commodities[0]}>
              {t.forms.commodities.map((commodity) => (
                <option key={commodity}>{commodity}</option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <CheckboxGroup
          legend={b.businessUnits}
          options={b.businessUnitOptions.map((unit) => ({ value: unit, label: unit }))}
          value={units}
          onChange={setUnits}
        />
        <FormField label={b.dueDate}>
          {(field) => <Input {...field} type="date" defaultValue="2026-12-15" />}
        </FormField>
        <FormField label={t.forms.share} hint={t.forms.shareHint}>
          {(field) => (
            <Switch id={field.id} aria-describedby={field['aria-describedby']} defaultChecked />
          )}
        </FormField>
        <FormField label={t.forms.notes}>
          {(field) => <Textarea {...field} placeholder={t.forms.notesPlaceholder} />}
        </FormField>
        <FormActions>
          <Button type="button" variant="secondary">
            {t.forms.cancel}
          </Button>
          <Button type="submit">{t.forms.save}</Button>
        </FormActions>
      </form>
    </Subsection>
  );
}

/** Ablauf in Schritten: Fortschritt oben, Zurück, Später fortsetzen und Weiter unten. */
function StepsExample() {
  const t = useMessages(styleguideMessages);
  const b = t.blocks;
  const total = b.stepTitles.length;
  const [step, setStep] = useState(2);

  return (
    <Subsection
      title={b.steps}
      description={b.stepsHint}
      files={['src/components/ui/step-progress.tsx']}
    >
      <div className="flex max-w-xl flex-col gap-6 rounded-xl bg-muted p-6">
        <StepProgress
          current={step}
          total={total}
          label={b.stepLabel}
          stepTitle={b.stepTitles[step - 1] ?? ''}
        />
        <StepActions
          back={
            <Button variant="ghost" disabled={step === 1} onClick={() => setStep(step - 1)}>
              {b.back}
            </Button>
          }
          later={<Button variant="secondary">{b.later}</Button>}
          next={
            <Button disabled={step === total} onClick={() => setStep(step + 1)}>
              {b.next}
            </Button>
          }
        />
      </div>
    </Subsection>
  );
}

/** Bestätigung auf der Seite statt eines Fensters (NAV-04). */
function ConfirmExample() {
  const t = useMessages(styleguideMessages);
  const b = t.blocks;
  const [ended, setEnded] = useState(false);

  return (
    <Subsection
      title={b.confirm}
      description={b.confirmHint}
      files={['src/components/ui/confirm-button.tsx']}
    >
      {ended && <StatusLine message={b.ended} onHidden={() => setEnded(false)} />}
      <div>
        <ConfirmButton
          question={b.endQuestion}
          confirmLabel={b.yes}
          cancelLabel={b.cancel}
          onConfirm={() => setEnded(true)}
        >
          {b.endRelationship}
        </ConfirmButton>
      </div>
    </Subsection>
  );
}

/** Rückmeldezeile nach dem Speichern (NAV-04). */
function StatusLineExample() {
  const t = useMessages(styleguideMessages);
  const b = t.blocks;
  const [saved, setSaved] = useState(false);

  return (
    <Subsection
      title={b.statusLine}
      description={b.statusLineHint}
      files={['src/components/ui/status-line.tsx']}
    >
      {saved && <StatusLine message={b.saved} onHidden={() => setSaved(false)} />}
      <div>
        <Button onClick={() => setSaved(true)}>{b.showStatus}</Button>
      </div>
    </Subsection>
  );
}

function StatusBadge({ status, label }: { status: 'ok' | 'watch' | 'risk'; label: string }) {
  if (status === 'ok') {
    return (
      <Badge variant="success">
        <CircleCheckIcon aria-hidden />
        {label}
      </Badge>
    );
  }
  if (status === 'watch') {
    return (
      <Badge variant="warning">
        <EyeIcon aria-hidden />
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="danger">
      <TriangleAlertIcon aria-hidden />
      {label}
    </Badge>
  );
}
