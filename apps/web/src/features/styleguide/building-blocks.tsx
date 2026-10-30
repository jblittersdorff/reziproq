import {
  ActivityIcon,
  CircleCheckIcon,
  DownloadIcon,
  EyeIcon,
  PlusIcon,
  TargetIcon,
  TriangleAlertIcon,
  XIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { SearchInput } from '@/components/ui/search-input';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-group';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
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
import { Tile, TileIcon } from '@/components/ui/tile';
import { useToast } from '@/components/ui/toast';
import { AppSidebar } from '@/features/shell/app-sidebar';
import { useLocale, useMessages } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { styleguideMessages } from './messages';
import { Subsection } from './parts';
import { currency, tableRows } from './sample-data';

const buttonVariants = ['default', 'secondary', 'ghost', 'destructive'] as const;
const buttonStates = ['normal', 'hover', 'focus', 'disabled', 'loading'] as const;

/** Alle Bausteine aus src/components/ui, jeweils mit Herkunft. */
export function BuildingBlocks() {
  const t = useMessages(styleguideMessages);
  const { locale } = useLocale();
  const toast = useToast();
  const b = t.blocks;

  return (
    <>
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
            <Button size="icon" variant="ghost" aria-label={b.sheet.close}>
              <XIcon />
            </Button>
          </div>
        </div>
      </Subsection>

      <Subsection
        title={b.forms}
        files={[
          'src/components/ui/input.tsx',
          'src/components/ui/native-select.tsx',
          'src/components/ui/textarea.tsx',
          'src/components/ui/switch.tsx',
          'src/components/ui/checkbox.tsx',
          'src/components/ui/settings-group.tsx',
        ]}
      >
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
            <SettingsRow label={t.forms.share} description={t.forms.shareHint} htmlFor="sg-share">
              <Switch id="sg-share" defaultChecked />
            </SettingsRow>
            <SettingsRow label={t.forms.reminder} htmlFor="sg-reminder">
              <Checkbox id="sg-reminder" defaultChecked />
            </SettingsRow>
          </SettingsGroup>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary">
              {t.forms.cancel}
            </Button>
            <Button type="submit">{t.forms.save}</Button>
          </div>
        </form>
      </Subsection>

      <Subsection title={b.search} files={['src/components/ui/search-input.tsx']}>
        <SearchInput aria-label={b.searchLabel} placeholder={b.searchPlaceholder} />
      </Subsection>

      <Subsection
        title={b.overlays}
        files={[
          'src/components/ui/dialog.tsx',
          'src/components/ui/sheet.tsx',
          'src/components/ui/toast.tsx',
        ]}
      >
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">{b.dialog.open}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <div className="flex flex-col gap-2 p-6">
                <DialogTitle className="font-semibold text-lg">{b.dialog.title}</DialogTitle>
                <p className="text-muted-foreground">{b.dialog.text}</p>
              </div>
              <div className="flex justify-end gap-3 px-6 pb-6">
                <DialogClose asChild>
                  <Button variant="secondary">{b.dialog.cancel}</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>{b.dialog.confirm}</Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary">{b.sheet.open}</Button>
            </SheetTrigger>
            <SheetContent className="gap-4 p-6">
              <SheetTitle className="font-semibold text-lg">{b.sheet.title}</SheetTitle>
              <p className="text-muted-foreground">{b.sheet.text}</p>
              <SheetClose asChild>
                <Button variant="secondary" className="self-start">
                  {b.sheet.close}
                </Button>
              </SheetClose>
            </SheetContent>
          </Sheet>

          <Button
            variant="secondary"
            onClick={() => toast({ title: b.toast.title, description: b.toast.description })}
          >
            {b.toast.show}
          </Button>
        </div>
      </Subsection>

      <Subsection title={b.badges} files={['src/components/ui/badge.tsx']}>
        <div className="flex flex-wrap gap-3">
          <Badge variant="neutral">{t.forms.commodities[0]}</Badge>
          <Badge variant="selected">{t.forms.shareGroup}</Badge>
          <StatusBadge status="ok" label={t.table.statuses.ok} />
          <StatusBadge status="watch" label={t.table.statuses.watch} />
          <StatusBadge status="risk" label={t.table.statuses.risk} />
        </div>
      </Subsection>

      <Subsection title={b.table} files={['src/components/ui/table.tsx']}>
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
      </Subsection>

      <Subsection title={b.tiles} files={['src/components/ui/tile.tsx']}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm">{b.tileLarge}</p>
            <Tile asChild size="lg" interactive>
              <a href="#blocks">
                <TileIcon>
                  <ActivityIcon aria-hidden />
                </TileIcon>
                <span className="flex flex-1 flex-col gap-1">
                  <span className="font-semibold text-lg">{b.tileSample.title}</span>
                  <span className="text-muted-foreground">{b.tileSample.sentence}</span>
                </span>
                <span className="text-muted-foreground text-sm">{b.tileSample.status}</span>
              </a>
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

      <Subsection title={b.sidebar} files={['src/features/shell/app-sidebar.tsx']}>
        {/* Gleicher Glas-Effekt wie im App-Rahmen; Seitenleiste und Overlays sind die einzigen Orte dafür. */}
        <div className="h-140 w-64 max-w-full overflow-hidden rounded-xl bg-muted/90 shadow-sm backdrop-blur">
          <AppSidebar />
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
    </>
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
