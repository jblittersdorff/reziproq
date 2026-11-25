import type { AwardPlan, AwardRequest, CategoryAward, StrategyContext } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, XIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { CheckboxGroup, FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import { type LaneRow, type LaneState, TimelineLanes } from '@/components/ui/timeline-lanes';
import { linkClass, useToken } from '@/features/ratings/use-rating';
import { awardPlanQueryOptions, removeAward, saveAward } from '@/lib/api';
import { appNow } from '@/lib/clock';
import { useLocale, useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';

type Month = { year: number; month: number };
const monthOf = (date: string): Month => ({
  year: Number(date.slice(0, 4)),
  month: Number(date.slice(5, 7)) - 1,
});
const index = (start: Month, at: Month) => (at.year - start.year) * 12 + (at.month - start.month);
const today = () => appNow().toISOString().slice(0, 10);

/**
 * Monate der Zeitachse: ab dem früheren von heute und der ersten Anfrage, mindestens sechs Monate,
 * bis zum letzten Vergabedatum (WG-14).
 */
export function awardMonths(awards: CategoryAward[], now = today()) {
  const dates = awards.flatMap((award) =>
    [award.requestFrom, award.requestTo, award.awardDate].filter(
      (value): value is string => value !== null,
    ),
  );
  const sorted = [...dates, now].sort();
  const start = monthOf(sorted[0] as string);
  const last = monthOf(sorted.at(-1) as string);
  const count = Math.max(6, index(start, last) + 1);
  return { start, count };
}

/**
 * WG-14 Schritt 8 (nach Vorlage WG-Vergaben.neu.dc.html): Vergaben als Zeitachse mit Anfragezeitraum
 * als Balken und Vergabedatum als Punkt, mögliche Lieferanten und Volumen je Zeile. Darunter die
 * Prüffragen je Zieldimension. Bearbeiten über den Namen der Vergabe.
 */
export function AwardsSection({
  context,
  editable,
}: {
  context: StrategyContext;
  editable: boolean;
}) {
  const text = useT().awardPlan;
  const { locale } = useLocale();
  const accessToken = useToken();
  const client = useQueryClient();
  const strategyId = context.strategy.id;
  const options = awardPlanQueryOptions(accessToken, strategyId);
  const query = useQuery({ ...options, enabled: accessToken !== '' });
  const [form, setForm] = useState<CategoryAward | 'new' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  if (query.isError) return <ErrorState title={text.failed} />;
  const data = query.data;
  if (!data) return <LoadingState label={text.loading} />;
  const canEdit = data.canEdit && editable;

  const run = async (work: (token: string) => Promise<AwardPlan>) => {
    setMessage(null);
    setFailure(null);
    try {
      client.setQueryData(options.queryKey, await work(accessToken));
      void client.invalidateQueries({ queryKey: ['warengruppen'], exact: false });
      setMessage(text.saved);
      return true;
    } catch (error) {
      const code = (error as { body?: { code?: string } }).body?.code;
      setFailure((code && text.errors[code]) || text.saveFailed);
      return false;
    }
  };

  const { start, count } = awardMonths(data.awards);
  const columns = Array.from({ length: count }, (_, offset) => {
    const date = new Date(Date.UTC(start.year, start.month + offset, 1));
    return new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(date);
  });
  const now = today();
  const volume = (award: CategoryAward) =>
    award.volumeCents === null
      ? text.noVolume
      : formatMoney({ amountCents: award.volumeCents, currency: award.currency }, locale, {
          compact: true,
        });
  const rows: LaneRow[] = data.awards.map((award) => {
    const from = award.requestFrom ?? award.requestTo;
    const to = award.requestTo ?? award.requestFrom;
    const state: LaneState = to && to < now ? 'done' : from && from <= now ? 'running' : 'planned';
    const awardAt = award.awardDate ? monthOf(award.awardDate) : null;
    const dayShare = award.awardDate ? (Number(award.awardDate.slice(8, 10)) - 1) / 31 : 0;
    return {
      key: award.id,
      title: (
        <span className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <button
              type="button"
              aria-label={text.edit(award.name)}
              className={`text-left ${linkClass}`}
              onClick={() => setForm(award)}
            >
              {award.name}
            </button>
          ) : (
            award.name
          )}
          {award.bundled && <Badge variant="ink">{text.bundled}</Badge>}
        </span>
      ),
      detail: text.detail(
        award.suppliers.length > 0
          ? award.suppliers.map((entry) => entry.name).join(', ')
          : text.noSuppliers,
        volume(award),
      ),
      bars:
        from && to
          ? [
              {
                key: 'request',
                start: Math.max(0, index(start, monthOf(from))),
                end: Math.min(count, index(start, monthOf(to)) + 1),
                state,
                label: text.request,
              },
            ]
          : [],
      milestones: awardAt
        ? [
            {
              key: 'award',
              at: Math.min(count, index(start, awardAt) + dayShare),
              label: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                new Date(`${award.awardDate}T00:00:00`),
              ),
            },
          ]
        : [],
    };
  });
  const warnings = data.awards.filter((award) => award.endedSuppliers.length > 0);

  return (
    <section aria-labelledby="wg-awards" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="wg-awards" className="font-semibold text-lg">
          {text.title}
        </h2>
        {canEdit && form === null && (
          <Button onClick={() => setForm('new')}>
            <PlusIcon aria-hidden />
            {text.add}
          </Button>
        )}
      </div>
      {message && <StatusLine message={message} onHidden={() => setMessage(null)} />}
      {failure && <StatusLine message={failure} tone="warning" />}
      {warnings.map((award) => (
        <StatusLine
          key={award.id}
          tone="warning"
          message={text.endedWarning(award.name, award.endedSuppliers.join(', '))}
        />
      ))}
      {form !== null && (
        <AwardForm
          key={form === 'new' ? 'new' : form.id}
          data={data}
          award={form === 'new' ? null : form}
          onSave={async (request) => {
            const id = form === 'new' ? undefined : form.id;
            if (await run((token) => saveAward(token, strategyId, request, id))) setForm(null);
          }}
          onRemove={
            form === 'new'
              ? undefined
              : async () => {
                  if (await run((token) => removeAward(token, strategyId, form.id))) setForm(null);
                }
          }
          onCancel={() => setForm(null)}
        />
      )}
      <div className="flex flex-col gap-3 rounded-lg bg-card p-5 shadow-card">
        {data.awards.length === 0 ? (
          <p className="text-muted-foreground">{text.empty}</p>
        ) : (
          <TimelineLanes
            label={text.title}
            columns={columns}
            rows={rows}
            stateLabels={text.states as Record<LaneState, string>}
            milestoneLabel={text.awardDate}
          />
        )}
        <p className="text-muted-foreground text-sm">{text.onlyEligible}</p>
      </div>
      <ChecksSection />
    </section>
  );
}

function ChecksSection() {
  const text = useT().awardPlan;
  return (
    <section
      aria-labelledby="wg-award-checks"
      className="flex flex-col gap-3 rounded-lg bg-card p-5 shadow-card"
    >
      <h3 id="wg-award-checks" className="font-semibold text-lg">
        {text.checkTitle}
      </h3>
      <p className="text-muted-foreground text-sm">{text.checkPurpose}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {text.checks.map(([dimension, questions]) => (
          <div key={dimension} className="flex flex-col gap-1">
            <h4 className="font-semibold">{dimension}</h4>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
              {questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function AwardForm({
  data,
  award,
  onSave,
  onRemove,
  onCancel,
}: {
  data: AwardPlan;
  award: CategoryAward | null;
  onSave: (request: AwardRequest) => Promise<void>;
  onRemove: (() => Promise<void>) | undefined;
  onCancel: () => void;
}) {
  const text = useT().awardPlan;
  const [name, setName] = useState(award?.name ?? '');
  const [volume, setVolume] = useState(
    award?.volumeCents === null || award === null ? '' : String(award.volumeCents / 100),
  );
  const [requestFrom, setRequestFrom] = useState(award?.requestFrom ?? '');
  const [requestTo, setRequestTo] = useState(award?.requestTo ?? '');
  const [awardDate, setAwardDate] = useState(award?.awardDate ?? '');
  const [bundleKey, setBundleKey] = useState(award?.bundleKey ?? '');
  const key = (entry: { kind: string; id: string }) => `${entry.kind}:${entry.id}`;
  const linked = new Set(award?.suppliers.map(key) ?? []);
  const [chosen, setChosen] = useState<string[]>([...linked]);
  const [busy, setBusy] = useState(false);
  // Wählbar: vergabefähig oder schon zugeordnet; die übrigen stehen mit Grund darunter
  const selectable = data.options.filter((entry) => entry.eligible || linked.has(key(entry)));
  const blocked = data.options.filter((entry) => !entry.eligible && !linked.has(key(entry)));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    await onSave({
      name,
      volumeCents: volume === '' ? null : Math.round(Number(volume) * 100),
      currency: award?.currency ?? 'EUR',
      requestFrom: requestFrom || null,
      requestTo: requestTo || null,
      awardDate: awardDate || null,
      bundleKey: bundleKey.trim() || null,
      suppliers: chosen.map((value) => {
        const [kind, id] = value.split(':') as ['relationship' | 'candidate', string];
        const note = award?.suppliers.find((entry) => entry.id === id)?.note ?? null;
        return { kind, id, note };
      }),
    });
    setBusy(false);
  };
  return (
    <form
      aria-labelledby="wg-award-form"
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-lg bg-card p-5 shadow-card"
    >
      <h3 id="wg-award-form" className="font-semibold text-lg">
        {award ? text.formEdit(award.name) : text.formNew}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={text.name}>
          {(field) => (
            <Input
              {...field}
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </FormField>
        <FormField label={text.volume}>
          {(field) => (
            <Input
              {...field}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
            />
          )}
        </FormField>
        <FormField label={text.requestFrom}>
          {(field) => (
            <Input
              {...field}
              type="date"
              value={requestFrom}
              onChange={(e) => setRequestFrom(e.target.value)}
            />
          )}
        </FormField>
        <FormField label={text.requestTo}>
          {(field) => (
            <Input
              {...field}
              type="date"
              value={requestTo}
              onChange={(e) => setRequestTo(e.target.value)}
            />
          )}
        </FormField>
        <FormField label={text.date}>
          {(field) => (
            <Input
              {...field}
              type="date"
              value={awardDate}
              onChange={(e) => setAwardDate(e.target.value)}
            />
          )}
        </FormField>
        <FormField label={text.bundleKey} hint={text.bundleHint}>
          {(field) => (
            <Input
              {...field}
              maxLength={60}
              value={bundleKey}
              onChange={(e) => setBundleKey(e.target.value)}
            />
          )}
        </FormField>
      </div>
      <CheckboxGroup
        legend={text.suppliers}
        options={selectable.map((entry) => ({
          value: key(entry),
          label: [
            entry.name,
            entry.kind === 'candidate' ? text.candidate : null,
            entry.ended ? text.endedOption : null,
          ]
            .filter(Boolean)
            .join(' · '),
        }))}
        value={chosen}
        onChange={setChosen}
      />
      {blocked.length > 0 && (
        <ul className="flex flex-col gap-1 text-muted-foreground text-sm">
          {blocked.map((entry) => (
            <li key={key(entry)}>
              {text.notEligible(
                entry.name,
                entry.reasons.map((reason) => text.reasons[reason] ?? reason).join(', '),
              )}
            </li>
          ))}
        </ul>
      )}
      <FormActions>
        <Button type="submit" disabled={busy}>
          {text.save}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {text.cancel}
        </Button>
        {onRemove && (
          <Button type="button" variant="ghost" onClick={() => void onRemove()}>
            <XIcon aria-hidden />
            {text.removeShort}
          </Button>
        )}
      </FormActions>
    </form>
  );
}
