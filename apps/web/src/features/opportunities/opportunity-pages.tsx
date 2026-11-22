import type { AdoptOpportunity, ValueOpportunities, ValueOpportunity } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { AiDraft } from '@/components/ui/ai-draft';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ListCard, ListCardHeader, ListRow, ListRowText } from '@/components/ui/list-card';
import { LoadingState } from '@/components/ui/loading-state';
import { NextStep, NextStepArrow } from '@/components/ui/next-step';
import { StatusLine } from '@/components/ui/status-line';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Tile } from '@/components/ui/tile';
import { useToken } from '@/features/ratings/use-rating';
import { PageHeader } from '@/features/shell/page-header';
import { SupplierFrame } from '@/features/suppliers/supplier-frame';
import {
  adoptOpportunity,
  changeOpportunityAssumptions,
  dismissOpportunity,
  opportunityProposal,
  runValueFinder,
  valueOpportunitiesQueryOptions,
} from '@/lib/api';
import { useLocale, useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';

type Step = ValueOpportunity['steps'][number];

function useFormatters() {
  const { locale } = useLocale();
  const text = useT().opportunities;
  const money = (cents: number) =>
    formatMoney({ amountCents: cents, currency: 'EUR' }, locale, { compact: true });
  const range = (value: { low: number; high: number }) =>
    text.range(money(value.low), money(value.high));
  /** Wert einer Eingabe nach Einheit: Geld, Anteil in Prozent, Menge oder Indexpunkte */
  const one = (unit: Step['unit'], value: string) => {
    if (unit === 'cents') return money(Number(value));
    if (unit === 'rate')
      return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(
        Number(value),
      );
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Number(value));
  };
  const step = (entry: Step) =>
    entry.low === entry.high
      ? one(entry.unit, entry.low)
      : text.range(one(entry.unit, entry.low), one(entry.unit, entry.high));
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  return { money, range, step, date };
}

/** Eingabe für Annahmen: Geld in Euro, Anteile in Prozent, sonst wie gespeichert */
const toField = (unit: Step['unit'], value: string) =>
  unit === 'cents'
    ? String(Number(value) / 100)
    : unit === 'rate'
      ? String(Math.round(Number(value) * 1000) / 10)
      : value;
const fromField = (unit: Step['unit'], value: string) => {
  const number = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(number) || value.trim() === '') return null;
  if (unit === 'cents') return String(Math.round(number * 100));
  if (unit === 'rate') return String(Math.round(number * 10_000) / 1_000_000);
  return String(number);
};

/** Annahmen ändern: jede Eingabe mit Spanne von und bis; Speichern rechnet neu. */
function EditForm({
  opportunity,
  onSave,
  onCancel,
}: {
  opportunity: ValueOpportunity;
  onSave: (inputs: Record<string, { low: string; high: string }>) => Promise<void>;
  onCancel: () => void;
}) {
  const text = useT().opportunities;
  const editable = opportunity.steps.filter((entry) => entry.editable);
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      editable.map((entry) => [
        entry.key,
        { low: toField(entry.unit, entry.low), high: toField(entry.unit, entry.high) },
      ]),
    ),
  );
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const changed: Record<string, { low: string; high: string }> = {};
    for (const entry of editable) {
      const value = values[entry.key];
      const low = value && fromField(entry.unit, value.low);
      const high = value && fromField(entry.unit, value.high);
      if (!low || !high) {
        setFailed(true);
        return;
      }
      if (low !== entry.low || high !== entry.high) changed[entry.key] = { low, high };
    }
    if (Object.keys(changed).length === 0) return onCancel();
    setBusy(true);
    try {
      await onSave(changed);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="flex flex-col gap-3" onSubmit={submit} aria-label={text.edit}>
      {failed && <StatusLine message={text.editFailed} tone="warning" />}
      {editable.map((entry) => {
        const label = text.fields[entry.key] ?? entry.key;
        const value = values[entry.key] ?? { low: '', high: '' };
        const set = (patch: Partial<typeof value>) =>
          setValues({ ...values, [entry.key]: { ...value, ...patch } });
        return (
          <div key={entry.key} className="grid gap-2 sm:grid-cols-2">
            <FormField label={text.editLow(label)}>
              {(field) => (
                <Input
                  {...field}
                  inputMode="decimal"
                  value={value.low}
                  onChange={(e) => set({ low: e.target.value })}
                />
              )}
            </FormField>
            <FormField label={text.editHigh(label)}>
              {(field) => (
                <Input
                  {...field}
                  inputMode="decimal"
                  value={value.high}
                  onChange={(e) => set({ high: e.target.value })}
                />
              )}
            </FormField>
          </div>
        );
      })}
      <FormActions>
        <Button type="submit" loading={busy}>
          {text.saveEdit}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {text.cancel}
        </Button>
      </FormActions>
    </form>
  );
}

/** Übernehmen: zeigt zuerst, was der Lieferant sehen wird; beides bearbeitbar. */
function AdoptForm({
  proposal,
  onSave,
  onCancel,
}: {
  proposal: AdoptOpportunity;
  onSave: (input: AdoptOpportunity) => Promise<void>;
  onCancel: () => void;
}) {
  const text = useT().opportunities;
  const [title, setTitle] = useState(proposal.title);
  const [description, setDescription] = useState(proposal.description);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <form
      aria-label={text.adoptTitle}
      className="flex flex-col gap-3 rounded-lg bg-primary-soft p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        try {
          await onSave({ title: title.trim(), description: description.trim() });
        } catch {
          setFailed(true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="font-semibold">{text.adoptTitle}</p>
      <p className="text-muted-foreground text-sm">{text.adoptHint}</p>
      {failed && <StatusLine message={text.adoptFailed} tone="warning" />}
      <FormField label={text.topicTitle}>
        {(field) => <Input {...field} value={title} onChange={(e) => setTitle(e.target.value)} />}
      </FormField>
      <FormField label={text.topicDescription}>
        {(field) => (
          <Textarea
            {...field}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        )}
      </FormField>
      <FormActions>
        <Button type="submit" loading={busy} disabled={title.trim() === ''}>
          {text.confirmAdopt}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {text.cancel}
        </Button>
      </FormActions>
    </form>
  );
}

function DismissForm({
  onSave,
  onCancel,
}: {
  onSave: (reason: string) => Promise<void>;
  onCancel: () => void;
}) {
  const text = useT().opportunities;
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      aria-label={text.dismiss}
      className="flex flex-col gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        try {
          await onSave(reason.trim());
        } finally {
          setBusy(false);
        }
      }}
    >
      <FormField label={text.dismissReason}>
        {(field) => (
          <Textarea {...field} value={reason} onChange={(e) => setReason(e.target.value)} />
        )}
      </FormField>
      <FormActions>
        <Button
          type="submit"
          variant="secondary"
          loading={busy}
          disabled={reason.trim().length < 3}
        >
          {text.confirmDismiss}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {text.cancel}
        </Button>
      </FormActions>
    </form>
  );
}

/** Ein Potenzial als Entwurf von Reziproq mit Wert für beide Seiten, Sicherheit und Rechenweg */
function OpportunityCard({
  opportunity,
  supplierName,
  canDecide,
  relationshipId,
  onChanged,
}: {
  opportunity: ValueOpportunity;
  supplierName: string;
  canDecide: boolean;
  relationshipId: string;
  onChanged: (data: ValueOpportunities, message: string) => void;
}) {
  const text = useT().opportunities;
  const format = useFormatters();
  const accessToken = useToken();
  const [mode, setMode] = useState<'view' | 'edit' | 'dismiss' | 'adopt'>('view');
  const [proposal, setProposal] = useState<AdoptOpportunity | null>(null);
  const template = text.templates[opportunity.templateKey] ?? opportunity.title;
  const impact = text.impact[opportunity.impactType] ?? opportunity.impactType;
  const citations = opportunity.steps.flatMap((entry) => entry.citations);
  const sources = [...new Map(citations.map((citation) => [citation.url, citation])).values()];
  const open = opportunity.status === 'new' && canDecide;

  return (
    <AiDraft
      className="scroll-mt-24"
      heading={
        opportunity.fromMarket ? `${text.draftHeading} · ${text.fromMarket}` : text.draftHeading
      }
      sourcesLabel={text.sources}
      sources={sources.map((source) => ({
        key: source.url,
        label: `${source.publisher} · ${format.date(source.publishedOn)}`,
        href: source.url,
      }))}
      actions={
        open && mode === 'view' ? (
          <>
            <Button
              size="sm"
              onClick={async () => {
                setProposal(await opportunityProposal(accessToken, relationshipId, opportunity.id));
                setMode('adopt');
              }}
            >
              {text.adopt}
            </Button>
            {opportunity.steps.some((entry) => entry.editable) && (
              <Button size="sm" variant="secondary" onClick={() => setMode('edit')}>
                {text.edit}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setMode('dismiss')}>
              {text.dismiss}
            </Button>
          </>
        ) : undefined
      }
    >
      <div id={`potenzial-${opportunity.id}`} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display font-semibold text-section tracking-section">{template}</h3>
          <Badge variant={opportunity.status === 'new' ? 'shared' : 'neutral'}>
            {text.status[opportunity.status]}
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col">
            <span className="text-muted-foreground text-sm">{text.forYou}</span>
            <span className="font-display font-semibold text-section tabular-nums">
              {format.range(opportunity.buyer)}
            </span>
            <span className="text-muted-foreground text-sm">{text.perYear(impact)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground text-sm">{text.forSupplier(supplierName)}</span>
            <span className="font-display font-semibold text-section tabular-nums">
              {opportunity.supplier
                ? format.range(opportunity.supplier)
                : (opportunity.supplierEffect ?? text.nothing)}
            </span>
          </div>
        </div>
        <p>
          <strong className="font-semibold">{text.confidence[opportunity.confidence]}</strong>
          {' · '}
          <span className="text-muted-foreground">
            {text.confidenceReason[opportunity.confidenceReason] ?? opportunity.confidenceReason}
          </span>
        </p>
        <p>{opportunity.reason}</p>
        <details className="rounded-lg bg-paper px-4 py-3">
          <summary className="cursor-pointer font-semibold">{text.calculation(template)}</summary>
          <Table className="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead>{text.input}</TableHead>
                <TableHead className="text-right">{text.value}</TableHead>
                <TableHead className="hidden sm:table-cell">{text.origin}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunity.steps.map((entry) => (
                <TableRow key={entry.key}>
                  <TableCell className="whitespace-normal">
                    {text.fields[entry.key] ?? entry.key}
                    <span className="block text-muted-foreground text-sm sm:hidden">
                      {text.source[entry.source]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{format.step(entry)}</TableCell>
                  <TableCell className="hidden whitespace-normal text-muted-foreground sm:table-cell">
                    {text.source[entry.source]}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-2 text-muted-foreground text-sm">{text.calculationNote}</p>
        </details>
        {mode === 'edit' && (
          <EditForm
            opportunity={opportunity}
            onCancel={() => setMode('view')}
            onSave={async (inputs) => {
              onChanged(
                await changeOpportunityAssumptions(accessToken, relationshipId, opportunity.id, {
                  inputs,
                }),
                text.recalculated,
              );
              setMode('view');
            }}
          />
        )}
        {mode === 'dismiss' && (
          <DismissForm
            onCancel={() => setMode('view')}
            onSave={async (reason) =>
              onChanged(
                await dismissOpportunity(accessToken, relationshipId, opportunity.id, reason),
                text.dismissed,
              )
            }
          />
        )}
        {mode === 'adopt' && proposal && (
          <AdoptForm
            proposal={proposal}
            onCancel={() => setMode('view')}
            onSave={async (input) =>
              onChanged(
                await adoptOpportunity(accessToken, relationshipId, opportunity.id, input),
                text.adopted,
              )
            }
          />
        )}
      </div>
    </AiDraft>
  );
}

/** Drei Zahlen: neu, im JBP, realisiert; je Wirkungsart eine Zeile, nie addiert */
function Totals({ data }: { data: ValueOpportunities }) {
  const text = useT().opportunities;
  const format = useFormatters();
  const column = (label: string, pick: 'new' | 'adopted' | 'realized') => (
    <Tile className="gap-1">
      <span className="font-semibold text-muted-foreground text-sm">{label}</span>
      {data.totals.length === 0 ? (
        <span className="font-display font-semibold text-section">{text.nothing}</span>
      ) : (
        data.totals.map((total) => (
          <span key={total.impactType} className="font-display font-semibold tabular-nums">
            {format.range(total[pick])} {text.impact[total.impactType]}
          </span>
        ))
      )}
    </Tile>
  );
  return (
    <section className="flex flex-col gap-2" aria-label={text.pageTitle}>
      <div className="grid gap-3 sm:grid-cols-3">
        {column(text.totalsNew(data.counts.new), 'new')}
        {column(text.totalsAdopted(data.counts.adopted), 'adopted')}
        {column(text.totalsRealized, 'realized')}
      </div>
      <p className="text-muted-foreground text-sm">{text.totalsNote}</p>
    </section>
  );
}

function SidePanels({ data, supplierName }: { data: ValueOpportunities; supplierName: string }) {
  const text = useT().opportunities;
  const format = useFormatters();
  const checked = data.checked;
  return (
    <div className="flex min-w-0 flex-col gap-5">
      {data.lastRun && (
        <ListCard aria-labelledby="wp-geprueft">
          <ListCardHeader id="wp-geprueft" title={text.checkedTitle} />
          {(
            [
              ['templates', checked.templates],
              ['checkable', checked.checkable],
              ['withOpportunity', checked.withOpportunity],
              ['withoutOpportunity', checked.withoutOpportunity.length],
              ['notCheckable', checked.notCheckable],
              ['signals', checked.signals],
            ] as const
          ).map(([key, value]) => (
            <ListRow key={key}>
              <ListRowText title={text.checked[key]} />
              <span className="font-semibold tabular-nums">{value}</span>
            </ListRow>
          ))}
          {checked.withoutOpportunity.map((entry) => (
            <ListRow key={entry.templateKey}>
              <ListRowText
                title={`${text.withoutTitle}: ${text.templates[entry.templateKey]}`}
                detail={text.withoutReason}
              />
            </ListRow>
          ))}
        </ListCard>
      )}
      <ListCard aria-labelledby="wp-markt">
        <ListCardHeader id="wp-markt" title={text.marketTitle} />
        <p className="px-5.5 pb-3 text-muted-foreground text-sm">
          {data.researchEnabled ? text.marketHint : text.researchOff}
        </p>
        {data.signals.map((signal) => (
          <ListRow key={signal.id}>
            <ListRowText
              title={signal.title}
              detail={`${signal.sources.map((source) => `${source.title} ${format.date(source.publishedOn)}`).join(' · ')} · ${signal.outcomeReason}`}
            />
            <Badge variant={signal.outcome === 'opportunity' ? 'shared' : 'neutral'}>
              {text.outcome[signal.outcome]}
            </Badge>
          </ListRow>
        ))}
        <p className="border-line-soft border-t px-5.5 py-3.5 text-muted-foreground text-sm">
          {data.outbound.length > 0
            ? text.outbound(data.outbound.map((query) => `„${query.text}“`).join(', '))
            : text.outboundNone}
        </p>
      </ListCard>
      <ListCard aria-labelledby="wp-luecken">
        <ListCardHeader id="wp-luecken" title={text.gapsTitle} />
        {data.dataGaps.length === 0 ? (
          <p className="px-5.5 pb-5 text-muted-foreground text-sm">{text.gapsEmpty}</p>
        ) : (
          data.dataGaps.map((gap) => (
            <ListRow key={gap.id}>
              <ListRowText
                title={gap.description}
                detail={gap.templatesBlocked.map((key) => text.templates[key]).join(', ')}
              />
              <Badge variant="neutral">{text.gapMissing}</Badge>
            </ListRow>
          ))
        )}
      </ListCard>
      <ListCard aria-labelledby="wp-sicht">
        <ListCardHeader id="wp-sicht" title={text.supplierSeesTitle(supplierName)} />
        <p className="px-5.5 pb-5 text-sm">{text.supplierSees(supplierName)}</p>
      </ListCard>
    </div>
  );
}

/**
 * Wertpotenziale eines Lieferanten (KI-11), nach Vorlage KI-Wert.neu: drei Zahlen, Tinte-Karte mit
 * dem nächsten Schritt, Entwurfskarten je Potenzial; rechts Prüfung, Markt, Datenlücken und was der
 * Lieferant sieht. Abweichung: Adresse /lieferanten/<id>/wirkung/wertpotenziale wie die übrigen
 * Ergebnisseiten; ohne Knopf „Anfrage entwerfen“ (folgt mit KI-03).
 */
export function ValueOpportunitiesPage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = t.opportunities;
  const accessToken = useToken();
  const client = useQueryClient();
  const options = valueOpportunitiesQueryOptions(accessToken, relationshipId);
  const query = useQuery({ ...options, enabled: accessToken !== '' });
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{ text: string; warning?: boolean } | null>(null);
  const format = useFormatters();

  const start = async () => {
    setRunning(true);
    setMessage(null);
    try {
      client.setQueryData(options.queryKey, await runValueFinder(accessToken, relationshipId));
    } catch {
      setMessage({ text: text.runFailed, warning: true });
    } finally {
      setRunning(false);
    }
  };

  return (
    <SupplierFrame relationshipId={relationshipId} area="impact" current={text.pageTitle}>
      {(supplier) => {
        const name = supplier.name;
        const data = query.data;
        const header = <PageHeader title={text.title(name)} purpose={text.purpose(name)} />;
        if (query.isError)
          return (
            <>
              {header}
              <ErrorState title={text.failed} />
            </>
          );
        if (!data)
          return (
            <>
              {header}
              <LoadingState label={text.loading} />
            </>
          );
        const fresh = data.opportunities.filter((entry) => entry.status === 'new');
        const first = fresh[0];
        const runButton = (variant: 'mint' | 'dark') => (
          <Button
            variant={variant}
            size={variant === 'mint' ? 'hero' : 'default'}
            loading={running}
            onClick={start}
          >
            {data.lastRun ? text.runAgain : text.run}
            {variant === 'mint' && <NextStepArrow />}
          </Button>
        );
        return (
          <>
            {header}
            <div className="grid items-start gap-5 lg:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
                <p className="text-muted-foreground text-sm">
                  {data.lastRun?.finishedAt
                    ? text.lastRun(format.date(data.lastRun.finishedAt))
                    : text.noRun}
                </p>
                {running && <StatusLine message={text.running} />}
                {message && (
                  <StatusLine
                    message={message.text}
                    {...(message.warning ? { tone: 'warning' as const } : {})}
                    onHidden={() => setMessage(null)}
                  />
                )}
                <Totals data={data} />
                <NextStep
                  eyebrow={text.nextEyebrow}
                  title={
                    !data.lastRun
                      ? text.nextFirstRun
                      : first
                        ? text.nextReview(fresh.length)
                        : text.nextDone
                  }
                  text={
                    !data.lastRun
                      ? text.nextFirstRunText
                      : first
                        ? text.nextReviewText
                        : text.nextDoneText
                  }
                  action={
                    !data.canRun ? undefined : first ? (
                      <Button variant="mint" size="hero" asChild>
                        <a href={`#potenzial-${first.id}`}>
                          {text.reviewFirst}
                          <NextStepArrow />
                        </a>
                      </Button>
                    ) : (
                      runButton('mint')
                    )
                  }
                  secondary={data.canRun && first ? runButton('dark') : undefined}
                />
                {!data.researchEnabled && <StatusLine message={text.researchOff} />}
                {data.opportunities.length === 0 ? (
                  <p className="rounded-lg bg-card px-4 py-3 text-muted-foreground">{text.empty}</p>
                ) : (
                  data.opportunities.map((opportunity) => (
                    <OpportunityCard
                      key={opportunity.id}
                      opportunity={opportunity}
                      supplierName={name}
                      canDecide={data.canDecide}
                      relationshipId={relationshipId}
                      onChanged={(next, note) => {
                        client.setQueryData(options.queryKey, next);
                        setMessage({ text: note });
                      }}
                    />
                  ))
                )}
              </div>
              <SidePanels data={data} supplierName={name} />
            </div>
          </>
        );
      }}
    </SupplierFrame>
  );
}
