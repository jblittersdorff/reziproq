import {
  type EffectType,
  effectTypes,
  type ImpactDetail,
  type Lever,
  type LeverInput,
  levers,
  leverTemplates,
  type Maturity,
  maturityLevels,
  parseEuroToCents,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ChevronRightIcon, LockIcon, TrendingUpIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
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
import { VisibilityBadge } from '@/components/ui/visibility-badge';
import { useToken } from '@/features/jbp/jbp-pages';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { SupplierFrame } from '@/features/suppliers/supplier-frame';
import {
  ApiError,
  freezeBaseline,
  impactDetailQueryOptions,
  impactListQueryOptions,
  pnlLinesQueryOptions,
  raiseMaturity,
  setupImpact,
} from '@/lib/api';
import { flash, useFlash } from '@/lib/flash';
import { useFormat } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

// PNL-01, PNL-03: Wirkung je Lieferant unter Wirkung › Initiativen, nur beim Käufer.

export const impactPath = (relationshipId: string) =>
  `/lieferanten/${relationshipId}/wirkung/initiativen`;

/** Wert einer Eingabe lesbar: Cent als Euro, Mengen und Anteile als Zahl. */
function useInputValue() {
  const { locale } = useLocale();
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 6 });
  return (field: LeverInput, value: string | undefined) => {
    if (value === undefined) return '–';
    return field.kind === 'money'
      ? formatMoney({ amountCents: Number(value), currency: 'EUR' }, locale)
      : number.format(Number(value));
  };
}

/** Reifegrad als Stufenleiter R1 bis R5, jede Stufe mit Namen; die aktuelle ist markiert. */
export function MaturityLadder({ level }: { level: number }) {
  const text = useT().impact;
  return (
    <ol data-slot="maturity" aria-label={text.maturityTitle} className="grid grid-cols-5 gap-1">
      {maturityLevels.map((step) => (
        <li
          key={step}
          aria-current={step === level ? 'step' : undefined}
          className="flex flex-col gap-1"
        >
          <span
            aria-hidden
            className={cn('h-1.5 rounded-full', step <= level ? 'bg-primary' : 'bg-secondary')}
          />
          <span
            className={cn('text-sm', step === level ? 'font-semibold' : 'text-muted-foreground')}
          >
            {text.level(step)} {text.levels[step]}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Stufen mit Person, Datum und Nachweis; für beide Seiten gleich lesbar. */
export function MaturitySteps({ maturity }: { maturity: Maturity }) {
  const text = useT().impact;
  const format = useFormat();
  if (maturity.steps.length === 0) {
    return <p className="text-muted-foreground">{text.stepsEmpty}</p>;
  }
  return (
    <ol data-slot="maturity-steps" className="overflow-hidden rounded-xl bg-card">
      {[...maturity.steps].reverse().map((step) => (
        <li
          key={`${step.toLevel}-${step.decidedAt}`}
          className="flex flex-col gap-1 border-border border-b px-5 py-3 last:border-b-0"
        >
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="selected">
              {text.level(step.toLevel)} {text.levels[step.toLevel]}
            </Badge>
            <span className="text-muted-foreground text-sm">
              {text.stepBy(step.decidedByName, format.dateTime(step.decidedAt))}
            </span>
          </span>
          <span>{step.evidence}</span>
          {step.evidenceLink && (
            <a
              href={step.evidenceLink}
              target="_blank"
              rel="noreferrer"
              className="text-primary text-sm underline-offset-4 hover:underline"
            >
              {step.evidenceLink}
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}

function ImpactFrame({
  relationshipId,
  trail = [],
  current,
  header,
  children,
}: {
  relationshipId: string;
  trail?: { label: string; href: string }[];
  current: string;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SupplierFrame
      relationshipId={relationshipId}
      area="impact"
      trail={() => trail}
      current={current}
      header={header}
    >
      {() => children}
    </SupplierFrame>
  );
}

/** Wirkung › Initiativen: Hebel, GuV-Zeile, Wirkungsart und Reifegrad je Initiative. */
export function ImpactListPage({ relationshipId }: { relationshipId: string }) {
  const text = useT().impact;
  const accessToken = useToken();
  const query = useQuery({
    ...impactListQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  return (
    <ImpactFrame
      relationshipId={relationshipId}
      current={text.list.title}
      header={
        <PageHeader
          title={text.list.title}
          purpose={text.list.purpose}
          badge={<VisibilityBadge visibility="internal" label={text.internal} />}
        />
      }
    >
      {query.isError ? (
        <ErrorState title={text.list.failed} />
      ) : !query.data ? (
        <LoadingState label={text.list.loading} />
      ) : query.data.initiatives.length === 0 ? (
        <EmptyState
          icon={<TrendingUpIcon aria-hidden />}
          title={text.list.empty}
          description={text.list.emptyHint}
        />
      ) : (
        <>
          {/* Schmal als Liste, breit als Tabelle: nichts wird abgeschnitten. */}
          <ul data-slot="impact-list" className="overflow-hidden rounded-xl bg-card sm:hidden">
            {query.data.initiatives.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-1 border-border border-b px-5 py-4 last:border-b-0"
              >
                {routerLink({
                  href: `${impactPath(relationshipId)}/${entry.id}`,
                  className:
                    'font-semibold hover:underline focus-visible:underline focus-visible:outline-none',
                  children: entry.title,
                })}
                <span className="text-muted-foreground text-sm">{text.sources[entry.source]}</span>
                <span className="text-sm">
                  {entry.impact
                    ? `${text.levers[entry.impact.lever]} · ${entry.impact.pnlLine.name} · ${text.effects[entry.impact.effectType]}`
                    : text.list.notSet}
                </span>
                <Badge variant={entry.maturity >= 4 ? 'success' : 'neutral'}>
                  {text.level(entry.maturity)} {text.levels[entry.maturity]}
                </Badge>
              </li>
            ))}
          </ul>
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{text.list.columns.initiative}</TableHead>
                  <TableHead>{text.list.columns.lever}</TableHead>
                  <TableHead>{text.list.columns.pnlLine}</TableHead>
                  <TableHead>{text.list.columns.effect}</TableHead>
                  <TableHead>{text.list.columns.maturity}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.initiatives.map((entry) => (
                  <TableRow key={entry.id} data-initiative={entry.id}>
                    <TableCell>
                      <span className="flex flex-col">
                        {routerLink({
                          href: `${impactPath(relationshipId)}/${entry.id}`,
                          className:
                            'font-semibold hover:underline focus-visible:underline focus-visible:outline-none',
                          children: entry.title,
                        })}
                        <span className="text-muted-foreground text-sm">
                          {text.sources[entry.source]}
                        </span>
                      </span>
                    </TableCell>
                    {entry.impact ? (
                      <>
                        <TableCell>{text.levers[entry.impact.lever]}</TableCell>
                        <TableCell>{entry.impact.pnlLine.name}</TableCell>
                        <TableCell>{text.effects[entry.impact.effectType]}</TableCell>
                      </>
                    ) : (
                      <TableCell colSpan={3} className="text-muted-foreground">
                        {text.list.notSet}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant={entry.maturity >= 4 ? 'success' : 'neutral'}>
                        {text.level(entry.maturity)} {text.levels[entry.maturity]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </ImpactFrame>
  );
}

function useDetail(relationshipId: string, initiativeId: string) {
  const accessToken = useToken();
  const query = useQuery({
    ...impactDetailQueryOptions(accessToken, relationshipId, initiativeId),
    enabled: accessToken !== '',
  });
  return { ...query, accessToken };
}

/** Wirkungs-Seite: Reifegrad, eingerichtete Wirkung, Baseline (intern) und Stufen. */
export function ImpactDetailPage({
  relationshipId,
  initiativeId,
}: {
  relationshipId: string;
  initiativeId: string;
}) {
  const text = useT().impact;
  const format = useFormat();
  const input = useInputValue();
  const [message, hideMessage] = useFlash();
  const query = useDetail(relationshipId, initiativeId);
  const data = query.data;
  const base = `${impactPath(relationshipId)}/${initiativeId}`;
  return (
    <ImpactFrame
      relationshipId={relationshipId}
      trail={[{ label: text.list.title, href: impactPath(relationshipId) }]}
      current={data?.initiative.title ?? text.list.title}
      header={
        <PageHeader
          title={data?.initiative.title ?? text.list.title}
          {...(data
            ? { purpose: text.detailPurpose(text.sources[data.initiative.source] ?? '') }
            : {})}
        />
      }
    >
      {query.isError ? (
        <ErrorState title={text.notFound} />
      ) : !data ? (
        <LoadingState label={text.list.loading} />
      ) : (
        <div className="flex max-w-4xl flex-col gap-10">
          {message && <StatusLine message={message} onHidden={hideMessage} />}
          <section aria-labelledby="wirkung-reifegrad" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="wirkung-reifegrad" className="font-bold text-xl tracking-title">
                {text.maturityTitle}
              </h2>
              {data.canEdit &&
                data.next &&
                data.next.requirement !== 'validation' &&
                routerLink({
                  href: `${base}/reifegrad`,
                  className: buttonVariants(),
                  children: text.raise(data.next.toLevel),
                })}
            </div>
            <MaturityLadder level={data.maturity.level} />
            {data.next && (
              <p className="text-muted-foreground text-sm">
                {text.requirements[data.next.requirement]}
              </p>
            )}
          </section>

          <section aria-labelledby="wirkung-einrichtung" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="wirkung-einrichtung" className="font-bold text-xl tracking-title">
                {text.setupSummary}
              </h2>
              {data.canEdit &&
                routerLink({
                  href: `${base}/einrichten`,
                  className: buttonVariants({ variant: data.impact ? 'outline' : 'default' }),
                  children: data.impact ? text.setupEdit : text.setupTitle,
                })}
            </div>
            {data.impact ? (
              <dl className="grid gap-x-8 gap-y-4 rounded-xl bg-card p-5 sm:grid-cols-2">
                {(
                  [
                    [text.leverLabel, text.levers[data.impact.lever]],
                    [
                      text.ruleLabel('', data.impact.leverTemplateVersion).replace(/: $/, ''),
                      text.leverRules[data.impact.lever],
                    ],
                    [text.pnlLineLabel, data.impact.pnlLine.name],
                    [text.effectLabel, text.effects[data.impact.effectType]],
                    ...(data.impact.effectiveFrom
                      ? [[text.effectiveFromLabel, format.date(data.impact.effectiveFrom)]]
                      : []),
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-1">
                    <dt className="text-muted-foreground text-sm">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-muted-foreground">{text.tileEmpty}</p>
            )}
          </section>

          {data.impact && (
            <section aria-labelledby="wirkung-baseline" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex flex-wrap items-center gap-3">
                  <h2 id="wirkung-baseline" className="font-bold text-xl tracking-title">
                    {text.baselineTitle}
                  </h2>
                  <VisibilityBadge visibility="internal" label={text.internal} />
                </span>
                {data.canEdit &&
                  routerLink({
                    href: `${base}/baseline`,
                    className: buttonVariants({ variant: 'outline' }),
                    children: data.baselines.length > 0 ? text.baselineNew : text.baselineCapture,
                  })}
              </div>
              {data.baselines.length === 0 ? (
                <p className="text-muted-foreground">{text.baselineEmpty}</p>
              ) : (
                <ol data-slot="baselines" className="overflow-hidden rounded-xl bg-card">
                  {data.baselines.map((baseline, index) => (
                    <li
                      key={baseline.version}
                      className={cn(
                        'flex flex-col gap-2 border-border border-b px-5 py-4 last:border-b-0',
                        index > 0 && 'text-muted-foreground',
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <LockIcon aria-hidden className="size-4" />
                        {text.baselineVersion(
                          baseline.version,
                          baseline.frozenByName,
                          format.dateTime(baseline.frozenAt),
                        )}
                      </span>
                      <dl className="flex flex-wrap gap-x-8 gap-y-2">
                        {leverTemplates[data.impact?.lever ?? 'price'].baseline.map((field) => (
                          <div key={field.key} className="flex flex-col">
                            <dt className="text-muted-foreground text-sm">
                              {text.inputs[field.key]}
                            </dt>
                            <dd className="font-semibold tabular-nums">
                              {input(field, baseline.inputs[field.key])}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      {baseline.changeReason && (
                        <span className="text-sm">
                          {text.baselineReason(baseline.changeReason)}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}

          <section aria-labelledby="wirkung-stufen" className="flex flex-col gap-3">
            <h2 id="wirkung-stufen" className="font-bold text-xl tracking-title">
              {text.stepsTitle}
            </h2>
            <MaturitySteps maturity={data.maturity} />
          </section>
        </div>
      )}
    </ImpactFrame>
  );
}

function SubPage({
  relationshipId,
  initiativeId,
  title,
  purpose,
  children,
}: {
  relationshipId: string;
  initiativeId: string;
  title: string;
  purpose: string;
  children: (data: ImpactDetail, accessToken: string) => React.ReactNode;
}) {
  const text = useT().impact;
  const query = useDetail(relationshipId, initiativeId);
  return (
    <ImpactFrame
      relationshipId={relationshipId}
      trail={[
        { label: text.list.title, href: impactPath(relationshipId) },
        {
          label: query.data?.initiative.title ?? text.list.title,
          href: `${impactPath(relationshipId)}/${initiativeId}`,
        },
      ]}
      current={title}
      header={<PageHeader title={title} purpose={purpose} />}
    >
      {query.isError ? (
        <ErrorState title={text.notFound} />
      ) : !query.data ? (
        <LoadingState label={text.list.loading} />
      ) : !query.data.canEdit ? (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {text.noPermission}
        </p>
      ) : (
        children(query.data, query.accessToken)
      )}
    </ImpactFrame>
  );
}

/** Wirkung einrichten: Hebel mit Rechenregel, GuV-Zeile, nur erlaubte Wirkungsarten. */
export function ImpactSetupPage({
  relationshipId,
  initiativeId,
}: {
  relationshipId: string;
  initiativeId: string;
}) {
  const text = useT().impact;
  return (
    <SubPage
      relationshipId={relationshipId}
      initiativeId={initiativeId}
      title={text.setupTitle}
      purpose={text.setupPurpose}
    >
      {(data, accessToken) => (
        <SetupForm relationshipId={relationshipId} data={data} accessToken={accessToken} />
      )}
    </SubPage>
  );
}

function SetupForm({
  relationshipId,
  data,
  accessToken,
}: {
  relationshipId: string;
  data: ImpactDetail;
  accessToken: string;
}) {
  const text = useT().impact;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const lines = useQuery({ ...pnlLinesQueryOptions(accessToken), enabled: accessToken !== '' });
  const [lever, setLever] = useState<Lever>(data.impact?.lever ?? 'price');
  const [effect, setEffect] = useState<EffectType>(
    data.impact?.effectType ??
      leverTemplates[data.impact?.lever ?? 'price'].effectTypes[0] ??
      'ebit',
  );
  const [line, setLine] = useState(data.impact?.pnlLine.key ?? '');
  const [from, setFrom] = useState(data.impact?.effectiveFrom ?? '');
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const locked = data.baselines.length > 0;
  const template = leverTemplates[lever];
  const back = `${impactPath(relationshipId)}/${data.initiative.id}`;
  const chooseLever = (next: Lever) => {
    setLever(next);
    if (!leverTemplates[next].effectTypes.includes(effect)) {
      setEffect(leverTemplates[next].effectTypes[0] ?? 'ebit');
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!line) {
      setError(text.required);
      return;
    }
    setError(null);
    setFailed(false);
    setSaving(true);
    try {
      await setupImpact(accessToken, relationshipId, data.initiative.id, {
        lever,
        pnlLineKey: line,
        effectType: effect,
        effectiveFrom: from || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['impact'] });
      flash.set(text.saved);
      await navigate({ to: back });
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };
  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex max-w-2xl flex-col gap-6"
    >
      <FormField
        label={text.leverLabel}
        hint={
          locked ? text.leverLocked : text.ruleLabel(text.leverRules[lever] ?? '', template.version)
        }
      >
        {(field) => (
          <NativeSelect
            {...field}
            disabled={locked}
            value={lever}
            onChange={(event) => chooseLever(event.target.value as Lever)}
          >
            {levers.map((value) => (
              <option key={value} value={value}>
                {text.levers[value]}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField label={text.pnlLineLabel} error={error ?? undefined}>
        {(field) => (
          <NativeSelect {...field} value={line} onChange={(event) => setLine(event.target.value)}>
            <option value="">{text.pnlLineLabel}</option>
            {(lines.data?.lines ?? [])
              .filter((entry) => entry.active || entry.key === line)
              .map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.name}
                </option>
              ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField label={text.effectLabel} hint={text.effectHint}>
        {(field) => (
          <NativeSelect
            {...field}
            value={effect}
            onChange={(event) => setEffect(event.target.value as EffectType)}
          >
            {effectTypes
              .filter((value) => template.effectTypes.includes(value))
              .map((value) => (
                <option key={value} value={value}>
                  {text.effects[value]}
                </option>
              ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField label={text.effectiveFromLabel}>
        {(field) => (
          <Input
            {...field}
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        )}
      </FormField>
      {failed && (
        <p role="alert" className="text-destructive">
          {text.saveFailed}
        </p>
      )}
      <FormActions>
        <Button type="button" variant="secondary" onClick={() => void navigate({ to: back })}>
          {text.cancel}
        </Button>
        <Button type="submit" loading={saving}>
          {text.save}
        </Button>
      </FormActions>
    </form>
  );
}

/** Baseline erfassen: Felder nach der Vorlage des Hebels, Einfrieren mit Bestätigung. */
export function BaselinePage({
  relationshipId,
  initiativeId,
}: {
  relationshipId: string;
  initiativeId: string;
}) {
  const text = useT().impact;
  return (
    <SubPage
      relationshipId={relationshipId}
      initiativeId={initiativeId}
      title={text.baselineCapture}
      purpose={text.baselinePurpose}
    >
      {(data, accessToken) =>
        data.impact ? (
          <BaselineForm relationshipId={relationshipId} data={data} accessToken={accessToken} />
        ) : (
          <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
            {text.setupFirst}
          </p>
        )
      }
    </SubPage>
  );
}

/** Eingabe in den gespeicherten Wert: Euro in ganze Cent, sonst Dezimalzahl mit Punkt. */
function toStored(field: LeverInput, text: string, locale: 'de' | 'en') {
  const value = text.trim();
  if (!value) return null;
  if (field.kind === 'money') {
    const cents = parseEuroToCents(value, locale);
    return cents === null ? null : String(cents);
  }
  const number = value.replace(',', '.');
  if (!/^-?\d{1,14}(\.\d{1,6})?$/.test(number)) return null;
  if (field.kind === 'rate' && (Number(number) < 0 || Number(number) > 1)) return null;
  return number;
}

function BaselineForm({
  relationshipId,
  data,
  accessToken,
}: {
  relationshipId: string;
  data: ImpactDetail;
  accessToken: string;
}) {
  const text = useT().impact;
  const { locale } = useLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fields = leverTemplates[data.impact?.lever ?? 'price'].baseline;
  const [values, setValues] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const back = `${impactPath(relationshipId)}/${data.initiative.id}`;
  const needsReason = data.baselines.length > 0;
  const freeze = async () => {
    const next: Record<string, string> = {};
    const inputs: Record<string, string> = {};
    for (const field of fields) {
      const stored = toStored(field, values[field.key] ?? '', locale);
      if (stored === null)
        next[field.key] = values[field.key]?.trim() ? text.invalidValue : text.required;
      else inputs[field.key] = stored;
    }
    if (needsReason && !reason.trim()) next.reason = text.required;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setFailed(false);
    try {
      await freezeBaseline(accessToken, relationshipId, data.initiative.id, {
        inputs,
        changeReason: needsReason ? reason.trim() : null,
      });
      await queryClient.invalidateQueries({ queryKey: ['impact'] });
      flash.set(text.saved);
      await navigate({ to: back });
    } catch {
      setFailed(true);
    }
  };
  return (
    <form
      noValidate
      onSubmit={(event: FormEvent) => event.preventDefault()}
      className="flex max-w-2xl flex-col gap-6"
    >
      <p className="text-muted-foreground text-sm">
        {text.ruleLabel(
          text.leverRules[data.impact?.lever ?? 'price'] ?? '',
          data.impact?.leverTemplateVersion ?? 1,
        )}
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        {fields.map((field) => (
          <FormField
            key={field.key}
            label={text.inputs[field.key] ?? field.key}
            error={errors[field.key]}
          >
            {(props) => (
              <Input
                {...props}
                inputMode="decimal"
                value={values[field.key] ?? ''}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.key]: event.target.value }))
                }
              />
            )}
          </FormField>
        ))}
      </div>
      {needsReason && (
        <FormField label={text.changeReasonLabel} error={errors.reason}>
          {(props) => (
            <Textarea
              {...props}
              rows={3}
              maxLength={2000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </FormField>
      )}
      {failed && (
        <p role="alert" className="text-destructive">
          {text.saveFailed}
        </p>
      )}
      <FormActions>
        <Button type="button" variant="secondary" onClick={() => void navigate({ to: back })}>
          {text.cancel}
        </Button>
        <ConfirmButton
          question={text.freezeQuestion}
          confirmLabel={text.freeze}
          cancelLabel={text.cancel}
          variant="default"
          onConfirm={() => void freeze()}
        >
          <LockIcon aria-hidden />
          {text.freeze}
        </ConfirmButton>
      </FormActions>
    </form>
  );
}

/** Reifegrad erhöhen: Die Seite nennt den nötigen Nachweis und speichert nur mit Nachweis. */
export function MaturityPage({
  relationshipId,
  initiativeId,
}: {
  relationshipId: string;
  initiativeId: string;
}) {
  const text = useT().impact;
  const query = useDetail(relationshipId, initiativeId);
  const title = query.data?.next ? text.raise(query.data.next.toLevel) : text.maturityTitle;
  return (
    <SubPage
      relationshipId={relationshipId}
      initiativeId={initiativeId}
      title={title}
      purpose={text.raisePurpose}
    >
      {(data, accessToken) =>
        data.next && data.next.requirement !== 'validation' ? (
          <MaturityForm relationshipId={relationshipId} data={data} accessToken={accessToken} />
        ) : (
          <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
            {data.next ? text.requirements.validation : text.setupFirst}
          </p>
        )
      }
    </SubPage>
  );
}

function MaturityForm({
  relationshipId,
  data,
  accessToken,
}: {
  relationshipId: string;
  data: ImpactDetail;
  accessToken: string;
}) {
  const text = useT().impact;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const next = data.next as NonNullable<ImpactDetail['next']>;
  const [decision, setDecision] = useState(next.ready ? 'plan' : (next.decisions[0]?.id ?? ''));
  const [implementedOn, setImplementedOn] = useState('');
  const [evidence, setEvidence] = useState('');
  const [link, setLink] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const back = `${impactPath(relationshipId)}/${data.initiative.id}`;
  const blocked =
    (next.requirement === 'baseline' && !next.ready) ||
    (next.requirement === 'decision' && !next.ready && next.decisions.length === 0);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const missing: Record<string, string> = {};
    if (next.requirement === 'decision' && !decision) missing.decision = text.required;
    if (next.requirement === 'implementation') {
      if (!implementedOn) missing.implementedOn = text.required;
      if (!evidence.trim()) missing.evidence = text.required;
    }
    setErrors(missing);
    if (Object.keys(missing).length > 0) return;
    setSaving(true);
    setFailed(null);
    try {
      await raiseMaturity(accessToken, relationshipId, data.initiative.id, {
        toLevel: next.toLevel,
        decisionId: next.requirement === 'decision' && decision !== 'plan' ? decision : null,
        implementedOn: implementedOn || null,
        evidence: evidence.trim() || null,
        evidenceLink: link.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['impact'] });
      flash.set(text.saved);
      await navigate({ to: back });
    } catch (error) {
      setFailed(error instanceof ApiError && error.status === 409 ? text.missing : text.saveFailed);
      setSaving(false);
    }
  };
  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex max-w-2xl flex-col gap-6"
    >
      <MaturityLadder level={data.maturity.level} />
      <p className="rounded-lg bg-card px-4 py-3">{text.requirements[next.requirement]}</p>
      {blocked && (
        <p role="status" className="text-destructive">
          {text.missing}
        </p>
      )}
      {next.requirement === 'decision' && !blocked && (
        <FormField label={text.decisionLabel} error={errors.decision}>
          {(field) => (
            <NativeSelect
              {...field}
              value={decision}
              onChange={(event) => setDecision(event.target.value)}
            >
              {next.ready && <option value="plan">{text.planApproved}</option>}
              {next.decisions.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.meeting}: {entry.text}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      )}
      {next.requirement === 'implementation' && (
        <>
          <FormField label={text.implementedOnLabel} error={errors.implementedOn}>
            {(field) => (
              <Input
                {...field}
                type="date"
                value={implementedOn}
                onChange={(event) => setImplementedOn(event.target.value)}
              />
            )}
          </FormField>
          <FormField label={text.evidenceLabel} error={errors.evidence}>
            {(field) => (
              <Textarea
                {...field}
                rows={3}
                maxLength={2000}
                value={evidence}
                onChange={(event) => setEvidence(event.target.value)}
              />
            )}
          </FormField>
        </>
      )}
      <FormField label={text.evidenceLinkLabel}>
        {(field) => (
          <Input
            {...field}
            type="url"
            value={link}
            onChange={(event) => setLink(event.target.value)}
          />
        )}
      </FormField>
      {failed && (
        <p role="alert" className="text-destructive">
          {failed}
        </p>
      )}
      <FormActions>
        <Button type="button" variant="secondary" onClick={() => void navigate({ to: back })}>
          {text.cancel}
        </Button>
        <Button type="submit" loading={saving} disabled={blocked}>
          {text.raise(next.toLevel)}
          <ChevronRightIcon aria-hidden />
        </Button>
      </FormActions>
    </form>
  );
}
