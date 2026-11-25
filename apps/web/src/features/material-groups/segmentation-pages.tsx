import type { CategorySegmentation, CategorySupplier } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useId, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ListCard, ListCardHeader, ListRow, ListRowText } from '@/components/ui/list-card';
import { LoadingState } from '@/components/ui/loading-state';
import { Monogram } from '@/components/ui/monogram';
import { NativeSelect } from '@/components/ui/native-select';
import { ShareRows } from '@/components/ui/share-rows';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import {
  ApiError,
  categorySegmentationQueryOptions,
  decideCategorySegment,
  startCategoryRound,
} from '@/lib/api';
import { appNow } from '@/lib/clock';
import { useFormat } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';

export const segmentationPagePath = (groupId: string) => `/warengruppen/${groupId}/segmentierung`;

const levelKey = (level: { impactLevel: number; qualityLevel: number }) =>
  `${level.impactLevel}-${level.qualityLevel}`;

const errorCode = (error: unknown) =>
  error instanceof ApiError ? (error.body as { code?: string } | null)?.code : undefined;

/** In 14 Tagen, als Vorschlag für die Frist */
const inTwoWeeks = () => new Date(appNow().getTime() + 14 * 86_400_000).toISOString().slice(0, 10);

/**
 * Schritt 4 der Strategie (WG-Lieferanten.dc.html, „Segmente in der Warengruppe“): Anteil der
 * Segmente am Umsatz der Warengruppe aus den Entscheidungen in der Warengruppe.
 */
export function CategorySegmentsCard({ groupId }: { groupId: string }) {
  const text = useT().categorySegments;
  const { locale } = useLocale();
  const accessToken = useToken();
  const query = useQuery({
    ...categorySegmentationQueryOptions(accessToken, groupId),
    enabled: accessToken !== '',
  });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const decided = (query.data?.suppliers ?? []).filter((entry) => entry.decision);
  const total = decided.reduce((sum, entry) => sum + entry.spendCents, 0);
  const segments = new Map<string, { cents: number; names: string[] }>();
  for (const entry of [...decided].sort((a, b) => b.spendCents - a.spendCents)) {
    const name = entry.decision?.ist.typeName ?? '';
    const current = segments.get(name) ?? { cents: 0, names: [] };
    current.cents += entry.spendCents;
    current.names.push(entry.name);
    segments.set(name, current);
  }
  return (
    <section
      aria-labelledby="wg-segments"
      className="flex flex-col gap-4 rounded-lg bg-card p-5 shadow-card"
    >
      <div className="flex flex-col gap-1">
        <h2 id="wg-segments" className="font-semibold text-lg">
          {text.cardTitle}
        </h2>
        <p className="text-muted-foreground text-sm">{text.cardHint}</p>
      </div>
      {query.isError ? (
        <StatusLine message={text.failed} tone="warning" />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : segments.size === 0 ? (
        <p className="text-muted-foreground text-sm">{text.cardEmpty}</p>
      ) : (
        <ShareRows
          rows={[...segments.entries()]
            .sort((a, b) => b[1].cents - a[1].cents)
            .map(([name, entry]) => {
              const share = total > 0 ? entry.cents / total : 0;
              return {
                key: name,
                label: name,
                share,
                value: percent.format(share),
                note: text.names(entry.names.slice(0, 2).join(', '), entry.names.length - 2),
                srLabel: text.shareLabel(name, percent.format(share)),
              };
            })}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {routerLink({
          href: segmentationPagePath(groupId),
          className: buttonVariants({ variant: 'secondary', size: 'sm' }),
          children: text.toRound,
        })}
        {routerLink({
          href: `/portfolio/matrix?wg=${groupId}`,
          className: buttonVariants({ variant: 'ghost', size: 'sm' }),
          children: text.toPortfolio,
        })}
      </div>
    </section>
  );
}

/**
 * WG-18: Bewertungsrunde der Warengruppe und Segment je Lieferant. Gebaut nach den Regeln der
 * Designsprache (keine eigene Vorlage); Aufbau wie die Listen in WG-Lieferanten.dc.html.
 */
export function CategorySegmentationPage({ groupId }: { groupId: string }) {
  const t = useT();
  const text = t.categorySegments;
  const accessToken = useToken();
  const query = useQuery({
    ...categorySegmentationQueryOptions(accessToken, groupId),
    enabled: accessToken !== '',
  });
  const data = query.data;
  const trail = [
    { label: t.materialGroupsPage.title, href: '/warengruppen' },
    ...(data ? [{ label: data.group.name, href: `/warengruppen/${groupId}` }] : []),
  ];

  return (
    <>
      <PagePath trail={trail} current={text.roundTitle} />
      <PageHeader
        size="work"
        title={text.title}
        purpose={data ? text.purpose(data.group.name) : text.loading}
      />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !data ? (
        <LoadingState label={text.loading} />
      ) : (
        <div className="flex flex-col gap-6">
          <RoundSection groupId={groupId} data={data} />
          <SupplierList groupId={groupId} data={data} />
        </div>
      )}
    </>
  );
}

function useSegmentationSave(groupId: string) {
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const all = useT();
  const text = all.categorySegments;
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (work: (token: string) => Promise<CategorySegmentation>) => {
    setBusy(true);
    setFailure(null);
    try {
      queryClient.setQueryData(
        categorySegmentationQueryOptions(accessToken, groupId).queryKey,
        await work(accessToken),
      );
      await queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      return true;
    } catch (error) {
      const code = errorCode(error);
      setFailure((code && text.errors[code]) || all.strategy.failedSave);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { run, failure, busy };
}

function RoundSection({ groupId, data }: { groupId: string; data: CategorySegmentation }) {
  const all = useT();
  const text = all.categorySegments;
  const format = useFormat();
  const save = useSegmentationSave(groupId);
  const [message, setMessage] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState(inTwoWeeks);
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(data.suppliers.filter((s) => s.rateable).map((s) => s.relationshipId)),
  );
  const round = data.round;
  const running = round?.status === 'open';
  const legendId = useId();

  return (
    <section
      aria-labelledby="wg-round"
      className="flex flex-col gap-4 rounded-lg bg-card p-5 shadow-card"
    >
      <h2 id="wg-round" className="font-semibold text-lg">
        {text.roundTitle}
      </h2>
      {message && <StatusLine message={message} onHidden={() => setMessage(null)} />}
      <p role="status" className="text-sm">
        {!round
          ? text.roundNone
          : running
            ? text.roundOpen(round.submitted, round.total, format.date(round.dueDate))
            : text.roundClosed(round.submitted, round.total)}
      </p>
      {!data.canManage ? (
        <p className="text-muted-foreground text-sm">{text.readOnly}</p>
      ) : running ? null : data.suppliers.length === 0 ? (
        <p className="text-muted-foreground text-sm">{text.empty}</p>
      ) : (
        <form
          className="flex flex-col gap-4"
          aria-label={text.startTitle}
          onSubmit={async (event: FormEvent) => {
            event.preventDefault();
            const ok = await save.run((token) =>
              startCategoryRound(token, groupId, { dueDate, relationshipIds: [...chosen] }),
            );
            if (ok) setMessage(text.started);
          }}
        >
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold">{text.startTitle}</h3>
            <p className="text-muted-foreground text-sm">{text.startHint}</p>
          </div>
          {save.failure && <StatusLine message={save.failure} tone="warning" />}
          <FormField label={text.dueDate} className="max-w-xs">
            {(field) => (
              <Input
                {...field}
                type="date"
                required
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            )}
          </FormField>
          <fieldset aria-labelledby={legendId} className="flex flex-col gap-1">
            <legend id={legendId} className="mb-1 font-semibold text-sm">
              {text.suppliersLabel}
            </legend>
            {data.suppliers.map((supplier) => (
              <label
                key={supplier.relationshipId}
                className="flex min-h-11 flex-wrap items-center gap-x-3 text-sm"
              >
                <input
                  type="checkbox"
                  className="size-5 accent-petrol"
                  disabled={!supplier.rateable}
                  checked={chosen.has(supplier.relationshipId)}
                  onChange={(event) =>
                    setChosen((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(supplier.relationshipId);
                      else next.delete(supplier.relationshipId);
                      return next;
                    })
                  }
                />
                <span>{supplier.name}</span>
                {!supplier.rateable && <span className="text-muted-foreground">{text.noUnit}</span>}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-1 text-sm">
            <h3 className="font-semibold">{text.raters}</h3>
            {data.raters.length === 0 ? (
              <p>
                {text.noRaters}{' '}
                {routerLink({
                  href: `/warengruppen/${groupId}`,
                  className: 'font-semibold text-petrol underline',
                  children: text.toTeam,
                })}
              </p>
            ) : (
              <p>
                {data.raters
                  .map((rater) => `${rater.name} (${all.roles.functions[rater.function]})`)
                  .join(', ')}
              </p>
            )}
          </div>
          <FormActions>
            <Button
              type="submit"
              loading={save.busy}
              disabled={chosen.size === 0 || data.raters.length === 0}
            >
              {text.start}
            </Button>
          </FormActions>
        </form>
      )}
    </section>
  );
}

function SupplierList({ groupId, data }: { groupId: string; data: CategorySegmentation }) {
  const text = useT().categorySegments;
  const { locale } = useLocale();
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (data.suppliers.length === 0) {
    return <EmptyState title={text.listTitle} description={text.empty} />;
  }
  return (
    <ListCard aria-labelledby="wg-segment-list">
      <ListCardHeader id="wg-segment-list" title={text.listTitle} />
      {message && (
        <div className="px-5.5 pb-3">
          <StatusLine message={message} onHidden={() => setMessage(null)} />
        </div>
      )}
      <ul>
        {data.suppliers.map((supplier) => (
          <li key={supplier.relationshipId}>
            <ListRow className="items-start">
              <Monogram name={supplier.name} />
              <ListRowText
                title={supplier.name}
                detail={
                  <span className="flex flex-col">
                    <span>
                      {[
                        supplier.spendCents > 0
                          ? text.spend(
                              formatMoney(
                                { amountCents: supplier.spendCents, currency: supplier.currency },
                                locale,
                                { compact: true },
                              ),
                            )
                          : null,
                        supplier.ratings.total > 0
                          ? text.ratings(supplier.ratings.submitted, supplier.ratings.total)
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {supplier.suggestion && (
                      <span>
                        {text.suggestion(
                          supplier.suggestion.ist.typeName,
                          supplier.suggestion.soll.typeName,
                        )}
                      </span>
                    )}
                    <span className="text-text">
                      {supplier.decision
                        ? `${text.decision(supplier.decision.ist.typeName, supplier.decision.soll.typeName)} · ${text.origins[supplier.decision.origin]}`
                        : text.noDecision}
                    </span>
                    {supplier.overall && (
                      <span>
                        {text.overall(
                          supplier.overall.ist.typeName,
                          supplier.overall.soll.typeName,
                        )}
                      </span>
                    )}
                  </span>
                }
              />
              {data.canManage && open !== supplier.relationshipId && (
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`${text.decide}: ${supplier.name}`}
                  onClick={() => setOpen(supplier.relationshipId)}
                >
                  {text.decide}
                </Button>
              )}
            </ListRow>
            {open === supplier.relationshipId && (
              <DecideForm
                groupId={groupId}
                data={data}
                supplier={supplier}
                onDone={(saved) => {
                  setOpen(null);
                  if (saved) setMessage(text.saved);
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </ListCard>
  );
}

function DecideForm({
  groupId,
  data,
  supplier,
  onDone,
}: {
  groupId: string;
  data: CategorySegmentation;
  supplier: CategorySupplier;
  onDone: (saved: boolean) => void;
}) {
  const text = useT().categorySegments;
  const save = useSegmentationSave(groupId);
  const start = supplier.decision ?? supplier.suggestion;
  const first = data.types[0];
  const fallback = first ? levelKey(first) : '';
  const [ist, setIst] = useState(start ? levelKey(start.ist) : fallback);
  const [soll, setSoll] = useState(start ? levelKey(start.soll) : fallback);
  const [reason, setReason] = useState('');
  const [missing, setMissing] = useState(false);
  const level = (key: string) => {
    const [impactLevel, qualityLevel] = key.split('-').map(Number);
    return { impactLevel: impactLevel ?? 0, qualityLevel: qualityLevel ?? 0 };
  };
  const select = (label: string, value: string, onChange: (value: string) => void) => (
    <FormField label={label}>
      {(field) => (
        <NativeSelect {...field} value={value} onChange={(event) => onChange(event.target.value)}>
          {data.types.map((type) => (
            <option key={levelKey(type)} value={levelKey(type)}>
              {type.name}
            </option>
          ))}
        </NativeSelect>
      )}
    </FormField>
  );
  return (
    <form
      aria-label={text.decideFor(supplier.name)}
      className="flex flex-col gap-3 border-line-soft border-t bg-paper px-5.5 py-4"
      onSubmit={async (event: FormEvent) => {
        event.preventDefault();
        if (!reason.trim()) {
          setMissing(true);
          return;
        }
        const ok = await save.run((token) =>
          decideCategorySegment(token, groupId, supplier.relationshipId, {
            ist: level(ist),
            soll: level(soll),
            reason: reason.trim(),
          }),
        );
        if (ok) onDone(true);
      }}
    >
      <h3 className="font-semibold">{text.decideFor(supplier.name)}</h3>
      {save.failure && <StatusLine message={save.failure} tone="warning" />}
      <div className="grid gap-3 sm:grid-cols-2">
        {select(text.ist, ist, setIst)}
        {select(text.soll, soll, setSoll)}
      </div>
      <FormField
        label={text.reason}
        hint={text.reasonHint}
        {...(missing && !reason.trim() ? { error: text.reasonMissing } : {})}
      >
        {(field) => (
          <Textarea
            {...field}
            rows={3}
            maxLength={2000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        )}
      </FormField>
      <FormActions>
        <Button type="submit" loading={save.busy}>
          {text.save}
        </Button>
        <Button type="button" variant="ghost" onClick={() => onDone(false)}>
          {text.cancel}
        </Button>
      </FormActions>
    </form>
  );
}
