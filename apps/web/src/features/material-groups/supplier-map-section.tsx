import type {
  StrategyContext,
  SupplierMap,
  SupplierMapRow,
  SupplierMapUpdate,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { SegmentMatrix } from '@/components/charts/segment-matrix';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { Monogram } from '@/components/ui/monogram';
import { NativeSelect } from '@/components/ui/native-select';
import { NextStep, NextStepArrow } from '@/components/ui/next-step';
import { ShareStack, type ShareStackTone } from '@/components/ui/share-stack';
import { StatusLine } from '@/components/ui/status-line';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { spread } from '@/features/portfolio/matrix-page';
import { linkClass, useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { saveSupplierMapRow, supplierMapQueryOptions } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { monogram } from '@/lib/monogram';
import { useNarrow } from '@/lib/use-narrow';

const percent = (share: number) => Math.round(share * 100);
/** Farbe folgt dem Lieferanten (Reihenfolge der Zeilen), nie dem Rang im Zieljahr */
const tones: ShareStackTone[] = ['petrol', 'slate', 'ink'];
// WG-20 (Zusammenführung je Lieferant) ist noch nicht gebaut: bis dahin führt der Klick auf den
// Lieferanten und die Übergabe zum Überblick der Beziehung.
const supplierPath = (relationshipId: string) => `/lieferanten/${relationshipId}`;

/**
 * WG-15 Schritt 9 (nach Vorlage WG-SupplierMap.neu.dc.html): Tabelle Ist und Soll je Lieferant,
 * darunter Umsatzverteilung heute und im Zieljahr und die Matrix. Bewusste Abweichungen: Ist und
 * Soll stehen in einer Matrix mit Pfeil (Baustein SegmentMatrix wie in der Segmentierung) statt in
 * zwei; die Karte steht über die ganze Breite und Leitfragen folgen darunter, weil die Segmentnamen
 * aus SEG lang sind und die Tabelle neben der Seitenspalte nicht ohne Scrollen passt.
 */
export function SupplierMapSection({
  groupId,
  context,
  editable,
}: {
  groupId: string;
  context: StrategyContext;
  editable: boolean;
}) {
  const text = useT().supplierMap;
  const accessToken = useToken();
  const strategyId = context.strategy.id;
  const query = useQuery({
    ...supplierMapQueryOptions(accessToken, strategyId),
    enabled: accessToken !== '',
  });
  const client = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [showRest, setShowRest] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (query.isError) return <ErrorState title={text.failed} />;
  const data = query.data;
  if (!data) return <LoadingState label={text.loading} />;
  const canEdit = data.canEdit && editable;
  const all = [...data.rows, ...data.rest];
  const row = all.find((entry) => entry.relationshipId === editing) ?? null;

  const save = async (relationshipId: string, update: SupplierMapUpdate) => {
    setFailure(null);
    setMessage(null);
    try {
      client.setQueryData(
        supplierMapQueryOptions(accessToken, strategyId).queryKey,
        await saveSupplierMapRow(accessToken, strategyId, relationshipId, update),
      );
      // Der Stand von Schritt 9 steht in der Strategie
      void client.invalidateQueries({ queryKey: ['warengruppen', groupId] });
      setMessage(text.saved);
      setEditing(null);
    } catch (error) {
      const code = (error as { body?: { code?: string } }).body?.code;
      setFailure((code && text.errors[code]) || text.saveFailed);
    }
  };

  if (all.length === 0) {
    return <p className="rounded-lg bg-card p-5 text-muted-foreground shadow-card">{text.empty}</p>;
  }
  const open = data.rows.filter((entry) => !entry.complete);
  const biggest = data.rows.find((entry) => entry.relationshipId === data.handoverRelationshipId);

  return (
    <section aria-label={text.title} className="flex flex-col gap-5">
      {data.restricted && (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-sm shadow-card">
          {text.restricted}
        </p>
      )}
      {!data.restricted && biggest ? (
        <NextStep
          nested
          headingAs="h3"
          eyebrow={text.nextEyebrow}
          title={text.nextDoneTitle}
          text={text.nextDoneText(biggest.name)}
          action={
            <Button variant="mint" size="hero" asChild>
              {routerLink({
                href: supplierPath(biggest.relationshipId),
                className: '',
                children: (
                  <>
                    {text.handover}
                    <NextStepArrow />
                  </>
                ),
              })}
            </Button>
          }
        />
      ) : (
        canEdit &&
        open.length > 0 && (
          <NextStep
            nested
            headingAs="h3"
            eyebrow={text.nextEyebrow}
            title={text.nextOpenTitle(open.map((entry) => entry.name).join(', '))}
            text={text.nextOpenText}
            action={
              <Button
                variant="mint"
                size="hero"
                onClick={() => setEditing(open[0]?.relationshipId ?? null)}
              >
                {text.setTarget}
                <NextStepArrow />
              </Button>
            }
          />
        )
      )}
      {message && <StatusLine message={message} onHidden={() => setMessage(null)} />}
      {failure && <StatusLine message={failure} tone="warning" />}
      <div className="flex flex-col gap-3 rounded-lg bg-card px-3 pt-2 pb-4 shadow-card">
        <div className="overflow-x-auto">
          <Table className="min-w-200">
            <caption className="sr-only">{text.title}</caption>
            <TableHeader>
              <TableRow>
                <TableHead>{text.columns.supplier}</TableHead>
                <TableHead className="text-right">{text.columns.shareIst}</TableHead>
                <TableHead className="text-right">{text.columns.shareTarget}</TableHead>
                <TableHead>{text.columns.segmentIst}</TableHead>
                <TableHead>{text.columns.segmentTarget}</TableHead>
                <TableHead className="whitespace-normal">{text.columns.feedback}</TableHead>
                {canEdit && <TableHead className="sr-only">{text.editShort}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((entry) => (
                <MapRow
                  key={entry.relationshipId}
                  row={entry}
                  canEdit={canEdit}
                  restricted={data.restricted}
                  onEdit={() => setEditing(entry.relationshipId)}
                />
              ))}
              {data.rest.length > 0 && (
                <TableRow>
                  <TableCell>
                    <span className="flex items-center gap-2.5">
                      <Monogram name={`+${data.rest.length}`} />
                      <span className="flex flex-col items-start">
                        <strong className="font-semibold">{text.rest(data.rest.length)}</strong>
                        <button
                          type="button"
                          aria-expanded={showRest}
                          aria-controls="wg-map-rest"
                          className={`min-h-11 text-sm ${linkClass}`}
                          onClick={() => setShowRest((value) => !value)}
                        >
                          {showRest ? text.restHide : text.restShow(data.rest.length)}
                        </button>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {text.percent(percent(data.restShare))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {data.rest.some((entry) => entry.shareTarget !== null)
                      ? text.percent(
                          data.rest.reduce((sum, entry) => sum + (entry.shareTarget ?? 0), 0),
                        )
                      : '–'}
                  </TableCell>
                  <TableCell colSpan={canEdit ? 4 : 3} />
                </TableRow>
              )}
            </TableBody>
            {showRest && data.rest.length > 0 && (
              <TableBody id="wg-map-rest">
                {data.rest.map((entry) => (
                  <MapRow
                    key={entry.relationshipId}
                    row={entry}
                    canEdit={canEdit}
                    restricted={data.restricted}
                    onEdit={() => setEditing(entry.relationshipId)}
                  />
                ))}
              </TableBody>
            )}
          </Table>
        </div>
        <p className="px-3 text-muted-foreground text-sm">{text.explain}</p>
      </div>
      {row && canEdit && (
        <MapRowForm
          key={row.relationshipId}
          row={row}
          data={data}
          strategyYear={context.strategy.year}
          onSave={(update) => save(row.relationshipId, update)}
          onCancel={() => setEditing(null)}
        />
      )}
      {!data.restricted && <Distribution data={data} strategyYear={context.strategy.year} />}
      {!data.restricted && <SupplierMapMatrix data={data} groupId={groupId} />}
    </section>
  );
}

function SegmentChip({ row }: { row: SupplierMapRow }) {
  const text = useT().supplierMap;
  const target = row.segmentTarget;
  if (!target) return <Badge variant="neutral">{text.noSegment}</Badge>;
  if (target.kind === 'ended') return <Badge variant="neutral">{text.ended}</Badge>;
  const changes =
    row.segmentIst !== null &&
    (row.segmentIst.impactLevel !== target.impactLevel ||
      row.segmentIst.qualityLevel !== target.qualityLevel);
  return (
    <Badge variant={changes ? 'ink' : 'neutral'}>
      {changes ? `${target.name} · ${text.changes}` : target.name}
    </Badge>
  );
}

function MapRow({
  row,
  canEdit,
  restricted,
  onEdit,
}: {
  row: SupplierMapRow;
  canEdit: boolean;
  restricted: boolean;
  onEdit: () => void;
}) {
  const t = useT();
  const text = t.supplierMap;
  const format = useFormat();
  const gap = row.feedbackGap;
  return (
    <TableRow>
      <TableCell>
        <span className="flex items-center gap-2.5">
          <Monogram
            name={row.name}
            tone={row.segmentTarget?.kind === 'ended' ? 'danger' : 'neutral'}
          />
          <span className="flex min-w-0 flex-col">
            {restricted ? (
              <strong className="font-semibold">{row.name}</strong>
            ) : (
              routerLink({
                href: supplierPath(row.relationshipId),
                className: 'font-semibold text-text underline-offset-2 hover:underline',
                children: row.name,
              })
            )}
            {row.site && <span className="text-muted-foreground text-sm">{row.site}</span>}
          </span>
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums">{text.percent(percent(row.share))}</TableCell>
      <TableCell className="text-right tabular-nums">
        {row.shareTarget === null ? (
          '–'
        ) : (
          <>
            <strong className="font-bold">{text.percent(row.shareTarget)}</strong>
            {row.targetYear && (
              <span className="block text-muted-foreground text-sm">
                {text.until(row.targetYear)}
              </span>
            )}
          </>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="neutral">{row.segmentIst?.name ?? text.noSegment}</Badge>
      </TableCell>
      <TableCell>
        <SegmentChip row={row} />
      </TableCell>
      <TableCell>
        {gap ? (
          <>
            <Badge
              variant={
                Math.abs(gap.delta) >= 1.5 ? 'danger' : gap.delta === 0 ? 'success' : 'warning'
              }
            >
              {gap.delta === 0 ? text.balanced : text.gap(format.number(Math.abs(gap.delta)))}
            </Badge>
            <span className="mt-1 block text-muted-foreground text-sm">
              {t.settings.survey.dimensions[gap.dimension] ?? ''}
            </span>
          </>
        ) : (
          <Badge variant="neutral">{text.noFeedback}</Badge>
        )}
      </TableCell>
      {canEdit && (
        <TableCell>
          <Button size="sm" variant="secondary" aria-label={text.edit(row.name)} onClick={onEdit}>
            {text.editShort}
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}

type TargetChoice = '' | 'ended' | `${number}-${number}`;

function MapRowForm({
  row,
  data,
  strategyYear,
  onSave,
  onCancel,
}: {
  row: SupplierMapRow;
  data: SupplierMap;
  strategyYear: number;
  onSave: (update: SupplierMapUpdate) => Promise<void>;
  onCancel: () => void;
}) {
  const text = useT().supplierMap;
  const initial: TargetChoice =
    row.segmentTarget?.kind === 'ended'
      ? 'ended'
      : row.segmentTarget
        ? `${row.segmentTarget.impactLevel}-${row.segmentTarget.qualityLevel}`
        : '';
  const [site, setSite] = useState(row.site ?? '');
  const [share, setShare] = useState(row.shareTarget === null ? '' : String(row.shareTarget));
  const [year, setYear] = useState(row.targetYear === null ? '' : String(row.targetYear));
  const [target, setTarget] = useState<TargetChoice>(initial);
  const [busy, setBusy] = useState(false);
  const hasIst = row.segmentIst !== null;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const [impact, quality] = target.split('-').map(Number);
    await onSave({
      site: site.trim() || null,
      shareTarget: share === '' ? null : Number(share),
      targetYear: year === '' ? null : Number(year),
      ...(target === 'ended'
        ? { segmentTarget: { kind: 'ended' as const } }
        : target !== '' && target !== initial
          ? {
              segmentTarget: {
                kind: 'segment' as const,
                impactLevel: impact as number,
                qualityLevel: quality as number,
              },
            }
          : {}),
    });
    setBusy(false);
  };
  return (
    <form
      aria-labelledby="wg-map-form"
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-lg bg-card p-5 shadow-card"
    >
      <h3 id="wg-map-form" className="font-semibold text-lg">
        {text.formTitle(row.name)}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={text.site} hint={text.siteHint}>
          {(field) => (
            <Input
              {...field}
              value={site}
              maxLength={120}
              onChange={(e) => setSite(e.target.value)}
            />
          )}
        </FormField>
        <FormField label={text.shareTargetLabel}>
          {(field) => (
            <Input
              {...field}
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={share}
              onChange={(e) => setShare(e.target.value)}
            />
          )}
        </FormField>
        <FormField label={text.targetYear} hint={text.targetYearHint}>
          {(field) => (
            <Input
              {...field}
              type="number"
              inputMode="numeric"
              min={strategyYear}
              max={strategyYear + 10}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          )}
        </FormField>
        <FormField
          label={text.segmentTargetLabel}
          hint={hasIst ? undefined : text.segmentIstMissing}
        >
          {(field) => (
            <NativeSelect
              {...field}
              value={target}
              onChange={(e) => setTarget(e.target.value as TargetChoice)}
            >
              <option value="">{text.keep}</option>
              {hasIst &&
                data.segmentTypes.map((type) => (
                  <option
                    key={`${type.impactLevel}-${type.qualityLevel}`}
                    value={`${type.impactLevel}-${type.qualityLevel}`}
                  >
                    {type.name}
                  </option>
                ))}
              <option value="ended">{text.endedOption}</option>
            </NativeSelect>
          )}
        </FormField>
      </div>
      <FormActions>
        <Button type="submit" disabled={busy}>
          {text.save}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {text.cancel}
        </Button>
      </FormActions>
    </form>
  );
}

function Distribution({ data, strategyYear }: { data: SupplierMap; strategyYear: number }) {
  const text = useT().supplierMap;
  const years = data.rows.flatMap((entry) => (entry.targetYear ? [entry.targetYear] : []));
  const targetYear = years.length > 0 ? Math.max(...years) : strategyYear;
  const short = (name: string) => monogram(name);
  const today = [
    ...data.rows.map((entry, index) => ({
      key: entry.relationshipId,
      name: entry.name,
      text: `${short(entry.name)} ${percent(entry.share)}`,
      share: entry.share,
      tone: (entry.segmentTarget?.kind === 'ended'
        ? 'risk'
        : (tones[index % tones.length] ?? 'petrol')) as ShareStackTone,
    })),
    {
      key: 'rest',
      name: text.others,
      text: String(percent(data.restShare)),
      share: data.restShare,
      tone: 'rest' as ShareStackTone,
    },
  ];
  const withTarget = data.rows.some((entry) => entry.shareTarget !== null);
  const restTarget = data.rest.reduce((sum, entry) => sum + (entry.shareTarget ?? 0), 0);
  const target = [
    ...data.rows.map((entry, index) => ({
      key: entry.relationshipId,
      name: entry.name,
      text: `${short(entry.name)} ${entry.shareTarget ?? 0}`,
      share: (entry.shareTarget ?? 0) / 100,
      tone: (tones[index % tones.length] ?? 'petrol') as ShareStackTone,
    })),
    {
      key: 'rest',
      name: text.others,
      text: String(restTarget),
      share: restTarget / 100,
      tone: 'rest' as ShareStackTone,
    },
  ];
  const label = (title: string, parts: { name: string; share: number }[]) =>
    `${title}: ${parts
      .filter((part) => part.share > 0)
      .map((part) => `${part.name} ${text.percent(Math.round(part.share * 100))}`)
      .join(', ')}`;
  return (
    <section
      aria-labelledby="wg-map-distribution"
      className="flex flex-col gap-4 rounded-lg bg-card p-5 shadow-card"
    >
      <h3 id="wg-map-distribution" className="font-semibold text-lg">
        {text.distributionTitle(targetYear)}
      </h3>
      <div className="flex flex-col gap-1.5">
        <span className="font-semibold text-muted-foreground text-sm">{text.today}</span>
        <ShareStack label={label(text.today, today)} segments={today} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="font-semibold text-muted-foreground text-sm">
          {text.untilYear(targetYear)}
        </span>
        {withTarget ? (
          <ShareStack label={label(text.untilYear(targetYear), target)} segments={target} />
        ) : (
          <p className="text-muted-foreground text-sm">{text.noTargetYet}</p>
        )}
      </div>
    </section>
  );
}

/** Matrix Ist und Soll, auch in der Freigabe (WG-16) */
export function SupplierMapMatrix({ data, groupId }: { data: SupplierMap; groupId: string }) {
  const t = useT();
  const text = t.supplierMap;
  const { locale } = useLocale();
  // Auf Telefonbreite überlappen die Namen; die Tabelle darüber nennt jeden Lieferanten
  const narrow = useNarrow();
  const placed = [...data.rows, ...data.rest].filter((entry) => entry.segmentIst !== null);
  const current = spread(
    placed,
    (entry) => entry.segmentIst as NonNullable<typeof entry.segmentIst>,
  );
  const targets = placed.map((entry) =>
    entry.segmentTarget?.kind === 'segment' ? entry.segmentTarget : null,
  );
  const targetPositions = spread(
    placed.filter((_, index) => targets[index] !== null),
    (entry) => entry.segmentTarget as { impactLevel: number; qualityLevel: number },
  );
  let targetIndex = 0;
  const suppliers = placed.map((entry, index) => {
    const position = targets[index] ? targetPositions[targetIndex++] : undefined;
    return {
      name: entry.name,
      volumeCents: Math.max(1, entry.amountCents),
      current: current[index] ?? { x: 0, y: 0 },
      ...(position && { target: position }),
    };
  });
  return (
    <section
      aria-labelledby="wg-map-matrix"
      className="flex flex-col gap-3 rounded-lg bg-card p-5 shadow-card"
    >
      <div className="flex flex-col gap-1">
        <h3 id="wg-map-matrix" className="font-semibold text-lg">
          {text.matrixTitle}
        </h3>
        <p className="text-muted-foreground text-sm">{text.matrixText}</p>
        {routerLink({
          href: `/warengruppen/${groupId}/segmentierung`,
          className: `self-start text-sm ${linkClass}`,
          children: text.toSegmentation,
        })}
      </div>
      <SegmentMatrix
        title={text.matrixChart}
        suppliers={suppliers}
        axes={{ x: t.ratings.qualityAxis, y: t.ratings.impactAxis }}
        levels={t.ratings.levels as [string, string, string]}
        formatVolume={(cents) =>
          formatMoney({ amountCents: cents, currency: data.currency }, locale, { compact: true })
        }
        empty={{ title: text.matrixEmptyTitle, description: text.matrixEmptyText }}
        labels={!narrow}
      />
    </section>
  );
}
