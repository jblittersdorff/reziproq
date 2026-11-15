import {
  type Kpi,
  type KpiImportPreview,
  type KpiTrack,
  kpiBenefits,
  kpiDirections,
  type MeetingSide,
  maxScorecardKpis,
  type ScorecardView,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  CircleCheckIcon,
  CircleXIcon,
  MinusIcon,
  PenLineIcon,
  PlusIcon,
  TriangleAlertIcon,
  UploadIcon,
} from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { KpiLineChart } from '@/components/charts/kpi-line-chart';
import { KpiSparkline } from '@/components/charts/kpi-sparkline';
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
import { Tile } from '@/components/ui/tile';
import { AuditHistory } from '@/features/audit/audit-history';
import { apiBase, type MeetingPlace } from '@/features/meetings/meeting-pages';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import {
  ApiError,
  createKpi,
  deleteKpi,
  enterKpiValue,
  kpiDetailQueryOptions,
  scorecardQueryOptions,
  signScorecard,
  startScorecardVersion,
  updateKpi,
  uploadKpiValues,
} from '@/lib/api';
import { flash, useFlash } from '@/lib/flash';
import { useFormat } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { JbpFrame, useToken } from './jbp-pages';

// JBP-07: Scorecard unter Gemeinsamer Plan › Scorecard, für beide Seiten gleich.

export const scorecardPath = ({ side, relationshipId }: MeetingPlace) =>
  side === 'buyer'
    ? `/lieferanten/${relationshipId}/plan/scorecard`
    : `/kunden/${relationshipId}/plan/scorecard`;

const numberPattern = /^-?\d{1,14}(\.\d{1,4})?$/;

function useScorecard(place: MeetingPlace) {
  const accessToken = useToken();
  const query = useQuery({
    ...scorecardQueryOptions(accessToken, apiBase(place)),
    enabled: accessToken !== '',
  });
  return { ...query, accessToken };
}

function useDay() {
  const { locale } = useLocale();
  const format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  return (iso: string) => format.format(new Date(`${iso}T00:00:00`));
}

/** Zahl im Format der Sprache, ohne überflüssige Nachkommastellen. */
function useNumber() {
  const { locale } = useLocale();
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 });
  return (value: string | null) => (value === null ? '–' : format.format(Number(value)));
}

const trackStyle = {
  on_track: { variant: 'success', Icon: CircleCheckIcon },
  close: { variant: 'warning', Icon: TriangleAlertIcon },
  off: { variant: 'danger', Icon: CircleXIcon },
  none: { variant: 'neutral', Icon: MinusIcon },
} as const;

/** Stand „auf Kurs“ immer mit Symbol und Text, nie nur als Farbe (JBP-09). */
export function TrackBadge({ track }: { track: KpiTrack | null }) {
  const text = useT().jbp.scorecard;
  const key = track ?? 'none';
  const { variant, Icon } = trackStyle[key];
  return (
    <Badge variant={variant} data-track={key}>
      <Icon aria-hidden />
      {text.tracks[key]}
    </Badge>
  );
}

const days = (from: string, to: string) =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;

/** Punkte für die kleine Linie: Ist-Werte und die Linie von der Basis zum Ziel. */
function sparkPoints(kpi: Kpi) {
  const baseline = Number(kpi.baseline ?? kpi.values[0]?.value ?? kpi.target);
  return {
    actual: kpi.values.map((entry) => ({
      x: days(kpi.startDate, entry.period),
      y: Number(entry.value),
    })),
    plan: [
      { x: 0, y: baseline },
      { x: days(kpi.startDate, kpi.targetDate), y: Number(kpi.target) },
    ],
  };
}

/** Oben Status und Unterschriften, darunter die Tabelle der Kennzahlen. */
export function JbpScorecardPage({ place }: { place: MeetingPlace }) {
  const text = useT().jbp.scorecard;
  return (
    <JbpFrame
      place={place}
      trail={[]}
      current={text.title}
      header={<PageHeader title={text.pageTitle} purpose={text.purpose} />}
    >
      <ScorecardContent place={place} />
    </JbpFrame>
  );
}

function ScorecardContent({ place }: { place: MeetingPlace }) {
  const text = useT().jbp.scorecard;
  const query = useScorecard(place);
  const [message, hideMessage] = useFlash();
  if (query.isError) return <ErrorState title={text.failed} />;
  if (!query.data) return <LoadingState label={text.loading} />;
  const data = query.data;
  if (!data.hasPlan) {
    return (
      <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
        {text.noPlan}
      </p>
    );
  }
  const full = data.kpis.length >= maxScorecardKpis;
  return (
    <>
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      <SignatureHead place={place} data={data} accessToken={query.accessToken} />
      {data.canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          {full ? (
            <p role="status" className="text-muted-foreground">
              {text.full}
            </p>
          ) : (
            routerLink({
              href: `${scorecardPath(place)}/neu`,
              className: buttonVariants({ variant: 'outline' }),
              children: (
                <>
                  <PlusIcon />
                  {text.new}
                </>
              ),
            })
          )}
          <span className="text-muted-foreground text-sm">
            {text.count(data.kpis.length, maxScorecardKpis)}
          </span>
        </div>
      )}
      {data.kpis.length === 0 ? (
        <EmptyState title={text.empty} description={text.emptyHint} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">{text.trackHint(data.tolerancePercent)}</p>
            {data.kpis.some((kpi) => kpi.canEnter) &&
              routerLink({
                href: `${scorecardPath(place)}/import`,
                className: buttonVariants({ variant: 'outline' }),
                children: (
                  <>
                    <UploadIcon />
                    {text.import}
                  </>
                ),
              })}
          </div>
          <KpiTable place={place} data={data} />
        </>
      )}
    </>
  );
}

/** Status, Version, Frist und die Unterschriften beider Seiten; die Hauptaktion daneben. */
function SignatureHead({
  place,
  data,
  accessToken,
}: {
  place: MeetingPlace;
  data: ScorecardView;
  accessToken: string;
}) {
  const text = useT().jbp.scorecard;
  const format = useFormat();
  const day = useDay();
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);
  const signature = (side: MeetingSide) => data.signatures.find((entry) => entry.side === side);
  return (
    <Tile
      size="lg"
      tone={data.status === 'signed' ? 'shared' : 'card'}
      data-slot="scorecard-status"
      className="gap-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-primary text-sm">{text.version(data.version)}</p>
          <p className="font-display font-semibold text-figure tracking-section">
            {data.status === 'draft' && data.signatures.length === 1 && data.signatures[0]
              ? text.partly(text.sides[data.signatures[0].side])
              : text.statuses[data.status]}
          </p>
          {data.deadline && data.status === 'draft' && (
            <p className="text-muted-foreground">{text.deadline(day(data.deadline))}</p>
          )}
        </div>
        {data.canSign &&
          routerLink({
            href: `${scorecardPath(place)}/unterschreiben`,
            className: buttonVariants(),
            children: (
              <>
                <PenLineIcon />
                {text.toSign}
              </>
            ),
          })}
        {data.canNewVersion && (
          <ConfirmButton
            question={text.newVersionQuestion}
            confirmLabel={text.newVersion}
            cancelLabel={text.cancel}
            variant="default"
            onConfirm={() =>
              void startScorecardVersion(accessToken, apiBase(place))
                .then(() => queryClient.invalidateQueries({ queryKey: ['jbp'] }))
                .catch(() => setFailed(true))
            }
          >
            {text.newVersion}
          </ConfirmButton>
        )}
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        {(['buyer', 'supplier'] as MeetingSide[]).map((side) => {
          const entry = signature(side);
          return (
            <div key={side} data-signature={side} className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-sm">{text.sides[side]}</dt>
              <dd className={entry ? 'font-semibold' : 'text-muted-foreground'}>
                {entry
                  ? text.signedBy(entry.userName, format.dateTime(entry.signedAt))
                  : text.notSigned}
              </dd>
            </div>
          );
        })}
      </dl>
      {data.status === 'signed' && <p className="text-muted-foreground">{text.lockedHint}</p>}
      {failed && (
        <p role="alert" className="text-destructive">
          {text.saveFailed}
        </p>
      )}
    </Tile>
  );
}

function KpiTable({ place, data }: { place: MeetingPlace; data: ScorecardView }) {
  const text = useT().jbp.scorecard;
  const day = useDay();
  const number = useNumber();
  // Jede Kennzahl führt zu ihrer Seite mit Verlauf und Werten (JBP-09); Bearbeiten steht dort.
  const name = (kpi: Kpi) =>
    routerLink({
      href: `${scorecardPath(place)}/${kpi.id}`,
      className: 'font-semibold hover:underline focus-visible:underline focus-visible:outline-none',
      children: kpi.name,
    });
  return (
    <>
      {/* Schmal als Liste, breit als Tabelle: nichts wird abgeschnitten. */}
      <ul data-slot="kpi-list" className="overflow-hidden rounded-lg bg-card shadow-card sm:hidden">
        {data.kpis.map((kpi) => (
          <li
            key={kpi.id}
            className="flex flex-col gap-1 border-line-soft border-b px-5 py-4 last:border-b-0"
          >
            {name(kpi)}
            <span className="text-muted-foreground text-sm">
              {[text.directions[kpi.direction], kpi.initiative?.title].filter(Boolean).join(' · ')}
            </span>
            <span className="tabular-nums">
              {kpi.baseline === null ? '–' : `${number(kpi.baseline)} ${kpi.unit}`} →{' '}
              <span className="font-semibold">
                {number(kpi.target)} {kpi.unit}
              </span>{' '}
              · {day(kpi.targetDate)}
            </span>
            <span className="flex items-center gap-3">
              <KpiSparkline {...sparkPoints(kpi)} />
              <TrackBadge track={kpi.track} />
            </span>
            <span className="flex flex-wrap items-center gap-2 text-sm">
              <span>
                {kpi.ownerName} ({text.sides[kpi.ownerSide]})
              </span>
              <Badge variant={kpi.benefitFor === 'both' ? 'selected' : 'neutral'}>
                {text.columns.benefitFor} {text.benefits[kpi.benefitFor]}
              </Badge>
            </span>
          </li>
        ))}
      </ul>
      <div className="hidden sm:block">
        <Table data-slot="kpi-table">
          <TableHeader>
            <TableRow>
              <TableHead>{text.columns.name}</TableHead>
              <TableHead>{text.columns.baseline}</TableHead>
              <TableHead>{text.columns.target}</TableHead>
              <TableHead>{text.columns.targetDate}</TableHead>
              <TableHead>{text.columns.owner}</TableHead>
              <TableHead>{text.columns.benefitFor}</TableHead>
              <TableHead>{text.columns2.track}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.kpis.map((kpi) => (
              <TableRow key={kpi.id} data-kpi={kpi.id}>
                <TableCell>
                  <span className="flex flex-col">
                    {name(kpi)}
                    <span className="text-muted-foreground text-sm">
                      {[text.directions[kpi.direction], kpi.initiative?.title]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {kpi.baseline === null ? '–' : `${number(kpi.baseline)} ${kpi.unit}`}
                </TableCell>
                <TableCell className="whitespace-nowrap font-semibold tabular-nums">
                  {number(kpi.target)} {kpi.unit}
                </TableCell>
                <TableCell className="whitespace-nowrap">{day(kpi.targetDate)}</TableCell>
                <TableCell>
                  <span className="flex flex-col">
                    <span>{kpi.ownerName}</span>
                    <span className="text-muted-foreground text-sm">
                      {text.sides[kpi.ownerSide]}
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={kpi.benefitFor === 'both' ? 'selected' : 'neutral'}>
                    {text.benefits[kpi.benefitFor]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-3">
                    <KpiSparkline {...sparkPoints(kpi)} />
                    <TrackBadge track={kpi.track} />
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

/** Neue oder geänderte Kennzahl der eigenen Seite, auf eigener Seite; dazu Entfernen. */
export function JbpKpiFormPage({ place, kpiId }: { place: MeetingPlace; kpiId?: string }) {
  const text = useT().jbp.scorecard;
  const query = useScorecard(place);
  const title = kpiId ? text.editTitle : text.new;
  const existing = kpiId ? query.data?.kpis.find((kpi) => kpi.id === kpiId && kpi.own) : undefined;
  return (
    <JbpFrame
      place={place}
      trail={[{ label: text.title, href: scorecardPath(place) }]}
      current={title}
      header={<PageHeader title={title} />}
    >
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : kpiId && !existing ? (
        <ErrorState title={text.notFound} />
      ) : !query.data.canEdit ? (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {query.data.status === 'signed' ? text.lockedHint : text.noPermission}
        </p>
      ) : !kpiId && query.data.kpis.length >= maxScorecardKpis ? (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {text.full}
        </p>
      ) : (
        <KpiForm
          place={place}
          accessToken={query.accessToken}
          data={query.data}
          existing={existing}
        />
      )}
    </JbpFrame>
  );
}

function KpiForm({
  place,
  accessToken,
  data,
  existing,
}: {
  place: MeetingPlace;
  accessToken: string;
  data: ScorecardView;
  existing?: Kpi | undefined;
}) {
  const text = useT().jbp.scorecard;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [values, setValues] = useState({
    name: existing?.name ?? '',
    unit: existing?.unit ?? '',
    direction: existing?.direction ?? 'higher',
    baseline: existing?.baseline ? String(Number(existing.baseline)) : '',
    target: existing ? String(Number(existing.target)) : '',
    targetDate: existing?.targetDate ?? '',
    ownerUserId: existing?.ownerUserId ?? '',
    benefitFor: existing?.benefitFor ?? 'both',
    initiativeId: existing?.initiative?.id ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ['jbp'] });
    flash.set(text.saved);
    await navigate({ to: scorecardPath(place) });
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailed(false);
    const next: Record<string, string> = {};
    for (const key of ['name', 'unit', 'target', 'targetDate', 'ownerUserId'] as const) {
      if (!values[key].trim()) next[key] = text.required;
    }
    for (const key of ['baseline', 'target'] as const) {
      const value = values[key].trim().replace(',', '.');
      if (value && !numberPattern.test(value)) next[key] = text.invalidNumber;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const request = {
      name: values.name.trim(),
      unit: values.unit.trim(),
      direction: values.direction as Kpi['direction'],
      baseline: values.baseline.trim() ? values.baseline.trim().replace(',', '.') : null,
      target: values.target.trim().replace(',', '.'),
      targetDate: values.targetDate,
      ownerUserId: values.ownerUserId,
      benefitFor: values.benefitFor as Kpi['benefitFor'],
      initiativeId: values.initiativeId || null,
    };
    setSaving(true);
    try {
      if (existing) await updateKpi(accessToken, apiBase(place), existing.id, request);
      else await createKpi(accessToken, apiBase(place), request);
      await done();
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };
  const line = (key: keyof typeof values, label: string, hint?: string, type = 'text') => (
    <FormField label={label} error={errors[key]} {...(hint ? { hint } : {})}>
      {(field) => (
        <Input
          {...field}
          type={type}
          inputMode={key === 'baseline' || key === 'target' ? 'decimal' : undefined}
          maxLength={120}
          value={values[key]}
          onChange={(event) => set(key)(event.target.value)}
        />
      )}
    </FormField>
  );
  const select = (
    key: keyof typeof values,
    label: string,
    options: { value: string; label: string }[],
  ) => (
    <FormField label={label} error={errors[key]}>
      {(field) => (
        <NativeSelect
          {...field}
          value={values[key]}
          onChange={(event) => set(key)(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      )}
    </FormField>
  );
  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-6">
        {line('name', text.nameLabel, text.nameHint)}
        <div className="grid gap-6 sm:grid-cols-2">
          {line('unit', text.unit, text.unitHint)}
          {select(
            'direction',
            text.direction,
            kpiDirections.map((value) => ({ value, label: text.directions[value] })),
          )}
          {line('baseline', text.baselineLabel, text.numberHint)}
          {line('target', text.targetLabel, text.numberHint)}
          {line('targetDate', text.targetDateLabel, undefined, 'date')}
          {select('ownerUserId', text.ownerLabel, [
            { value: '', label: text.ownerLabel },
            ...data.people.map((person) => ({ value: person.userId, label: person.name })),
          ])}
          {select(
            'benefitFor',
            text.benefitLabel,
            kpiBenefits.map((value) => ({ value, label: text.benefits[value] })),
          )}
          {data.initiatives.length > 0 &&
            select('initiativeId', text.initiativeLabel, [
              { value: '', label: text.noInitiative },
              ...data.initiatives.map((entry) => ({ value: entry.id, label: entry.title })),
            ])}
        </div>
        {failed && (
          <p role="alert" className="text-destructive">
            {text.saveFailed}
          </p>
        )}
        <FormActions>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void navigate({ to: scorecardPath(place) })}
          >
            {text.cancel}
          </Button>
          <Button type="submit" loading={saving}>
            {existing ? text.save : text.create}
          </Button>
        </FormActions>
      </form>
      {existing && (
        <div>
          <ConfirmButton
            question={text.deleteQuestion}
            confirmLabel={text.delete}
            cancelLabel={text.cancel}
            onConfirm={() =>
              void deleteKpi(accessToken, apiBase(place), existing.id)
                .then(done)
                .catch(() => setFailed(true))
            }
          >
            {text.delete}
          </ConfirmButton>
        </div>
      )}
    </div>
  );
}

/** Unterschreiben: Zusammenfassung der Kennzahlen und Bestätigung auf der Seite. */
export function JbpScorecardSignPage({ place }: { place: MeetingPlace }) {
  const text = useT().jbp.scorecard;
  const query = useScorecard(place);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const sign = async () => {
    setFailed(false);
    setSaving(true);
    try {
      await signScorecard(query.accessToken, apiBase(place));
      await queryClient.invalidateQueries({ queryKey: ['jbp'] });
      flash.set(text.signDone);
      await navigate({ to: scorecardPath(place) });
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };
  return (
    <JbpFrame
      place={place}
      trail={[{ label: text.title, href: scorecardPath(place) }]}
      current={text.signTitle}
      header={<PageHeader title={text.signTitle} purpose={text.signPurpose} />}
    >
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : (
        <div className="flex flex-col gap-6">
          {query.data.kpis.length > 0 && (
            <KpiTable place={place} data={{ ...query.data, canEdit: false }} />
          )}
          {query.data.canSign ? (
            <section className="flex max-w-2xl flex-col gap-3 rounded-lg bg-card shadow-card p-5">
              <p className="text-muted-foreground">{text.signHint}</p>
              <Button className="self-start" loading={saving} onClick={() => void sign()}>
                <PenLineIcon />
                {text.signConfirm}
              </Button>
              {failed && (
                <p role="alert" className="text-destructive">
                  {text.saveFailed}
                </p>
              )}
            </section>
          ) : (
            <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
              {text.signNotPossible}
            </p>
          )}
        </div>
      )}
    </JbpFrame>
  );
}

/** Kennzahl (JBP-09): Stand, Verlauf als Diagramm, Werte als Tabelle und der geteilte Verlauf. */
export function JbpKpiPage({ place, kpiId }: { place: MeetingPlace; kpiId: string }) {
  const text = useT().jbp.scorecard;
  const accessToken = useToken();
  const day = useDay();
  const number = useNumber();
  const format = useFormat();
  const { locale } = useLocale();
  const [message, hideMessage] = useFlash();
  const query = useQuery({
    ...kpiDetailQueryOptions(accessToken, apiBase(place), kpiId),
    enabled: accessToken !== '',
  });
  const card = useScorecard(place);
  const kpi = query.data?.kpi;
  const month = new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' });
  return (
    <JbpFrame
      place={place}
      trail={[{ label: text.title, href: scorecardPath(place) }]}
      current={kpi?.name ?? text.title}
      header={
        <PageHeader
          title={kpi?.name ?? text.title}
          {...(kpi
            ? { purpose: text.detailPurpose(kpi.unit, text.directions[kpi.direction]) }
            : {})}
        />
      }
    >
      {query.isError ? (
        <ErrorState title={text.notFound} />
      ) : !query.data || !kpi ? (
        <LoadingState label={text.loading} />
      ) : (
        <div className="flex max-w-4xl flex-col gap-8">
          {message && <StatusLine message={message} onHidden={hideMessage} />}
          <div className="flex flex-wrap items-center gap-3">
            <TrackBadge track={kpi.track} />
            <span className="text-muted-foreground text-sm">
              {kpi.baseline === null ? '–' : `${number(kpi.baseline)} ${kpi.unit}`} →{' '}
              {number(kpi.target)} {kpi.unit} · {day(kpi.targetDate)} · {kpi.ownerName}
            </span>
            <span className="grow" />
            {kpi.canEnter &&
              routerLink({
                href: `${scorecardPath(place)}/${kpi.id}/wert`,
                className: buttonVariants(),
                children: (
                  <>
                    <PlusIcon />
                    {text.enter}
                  </>
                ),
              })}
            {kpi.own &&
              card.data?.canEdit &&
              routerLink({
                href: `${scorecardPath(place)}/${kpi.id}/bearbeiten`,
                className: buttonVariants({ variant: 'outline' }),
                children: text.edit,
              })}
          </div>
          <KpiLineChart
            title={text.chartTitle(text.tracks[kpi.track ?? 'none'] ?? '')}
            description={text.trackHint(query.data.tolerancePercent)}
            names={{ actual: text.seriesActual, plan: text.seriesPlan }}
            points={[
              {
                time: Date.parse(`${kpi.startDate}T00:00:00Z`),
                plan: Number(kpi.baseline ?? kpi.values[0]?.value ?? kpi.target),
              },
              ...kpi.values.map((entry) => ({
                time: Date.parse(`${entry.period}T00:00:00Z`),
                actual: Number(entry.value),
              })),
              { time: Date.parse(`${kpi.targetDate}T00:00:00Z`), plan: Number(kpi.target) },
            ].sort((a, b) => a.time - b.time)}
            formatValue={(value) => `${number(String(value))} ${kpi.unit}`}
            formatTime={(time) => month.format(new Date(time))}
            empty={{ title: text.chartEmpty, description: text.chartEmptyHint }}
          />
          {query.data.values.length > 0 && (
            <section aria-labelledby="kennzahl-werte" className="flex flex-col gap-3">
              <h2 id="kennzahl-werte" className="font-display font-semibold text-section tracking-section">
                {text.valuesTitle}
              </h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{text.valueColumns.month}</TableHead>
                    <TableHead>{text.valueColumns.value}</TableHead>
                    <TableHead>{text.valueColumns.source}</TableHead>
                    <TableHead className="hidden sm:table-cell">{text.valueColumns.by}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.data.values.map((row) => (
                    <TableRow key={row.period} data-period={row.period}>
                      <TableCell>{month.format(new Date(`${row.period}T00:00:00`))}</TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        {number(row.value)} {kpi.unit}
                      </TableCell>
                      <TableCell>{text.sources[row.source] ?? row.source}</TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {row.enteredByName}, {format.dateTime(row.enteredAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          )}
          {!kpi.canEnter && <p className="text-muted-foreground text-sm">{text.onlyOwner}</p>}
          <section aria-labelledby="kennzahl-verlauf" className="flex flex-col gap-3">
            <h2 id="kennzahl-verlauf" className="font-display font-semibold text-section tracking-section">
              {text.historyTitle}
            </h2>
            <AuditHistory
              objectType="kpi_value"
              objectId={kpi.id}
              {...(place.side === 'supplier' ? { relationshipId: place.relationshipId } : {})}
            />
          </section>
        </div>
      )}
    </JbpFrame>
  );
}

/** Wert erfassen auf eigener Seite: Monat und Wert; ein neuer Wert ersetzt den des Monats. */
export function JbpKpiValuePage({ place, kpiId }: { place: MeetingPlace; kpiId: string }) {
  const text = useT().jbp.scorecard;
  const accessToken = useToken();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({
    ...kpiDetailQueryOptions(accessToken, apiBase(place), kpiId),
    enabled: accessToken !== '',
  });
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [value, setValue] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const kpi = query.data?.kpi;
  const back = `${scorecardPath(place)}/${kpiId}`;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!/^\d{4}-\d{2}$/.test(month)) next.month = text.required;
    const number = value.trim().replace(',', '.');
    if (!number) next.value = text.required;
    else if (!numberPattern.test(number)) next.value = text.invalidNumber;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    setFailed(false);
    try {
      await enterKpiValue(accessToken, apiBase(place), kpiId, { month, value: number });
      await queryClient.invalidateQueries({ queryKey: ['jbp'] });
      flash.set(text.saved);
      await navigate({ to: back });
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };
  return (
    <JbpFrame
      place={place}
      trail={[
        { label: text.title, href: scorecardPath(place) },
        { label: kpi?.name ?? text.title, href: back },
      ]}
      current={text.enterTitle}
      header={<PageHeader title={text.enterTitle} purpose={text.enterPurpose} />}
    >
      {query.isError ? (
        <ErrorState title={text.notFound} />
      ) : !kpi ? (
        <LoadingState label={text.loading} />
      ) : !kpi.canEnter ? (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {text.onlyOwner}
        </p>
      ) : (
        <form
          noValidate
          onSubmit={(event) => void submit(event)}
          className="flex max-w-md flex-col gap-6"
        >
          <FormField label={text.monthLabel} error={errors.month}>
            {(field) => (
              <Input
                {...field}
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
            )}
          </FormField>
          <FormField label={text.valueLabel(kpi.unit)} hint={text.numberHint} error={errors.value}>
            {(field) => (
              <Input
                {...field}
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
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
      )}
    </JbpFrame>
  );
}

/** CSV-Import (JBP-09): Datei wählen, Vorschau mit markierten Fehlern, dann übernehmen. */
export function JbpKpiImportPage({ place }: { place: MeetingPlace }) {
  const text = useT().jbp.scorecard;
  const accessToken = useToken();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<KpiImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async (apply: boolean) => {
    if (!file) {
      setError(text.chooseFile);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await uploadKpiValues(accessToken, apiBase(place), file, apply);
      if (apply) {
        await queryClient.invalidateQueries({ queryKey: ['jbp'] });
        flash.set(text.importDone(result.valid));
        await navigate({ to: scorecardPath(place) });
        return;
      }
      setPreview(result);
    } catch (failure) {
      const body =
        failure instanceof ApiError ? (failure.body as { preview?: KpiImportPreview }) : null;
      if (body?.preview) setPreview(body.preview);
      else setError(text.importFailed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <JbpFrame
      place={place}
      trail={[{ label: text.title, href: scorecardPath(place) }]}
      current={text.importTitle}
      header={<PageHeader title={text.importTitle} purpose={text.importPurpose} />}
    >
      <div className="flex max-w-4xl flex-col gap-6">
        <FormField label={text.importFile} hint={text.importFileHint} error={error ?? undefined}>
          {(field) => (
            <Input
              {...field}
              type="file"
              accept=".csv,.xlsx"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
              }}
            />
          )}
        </FormField>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" loading={busy && !preview} onClick={() => void load(false)}>
            {text.importPreview}
          </Button>
          {preview && preview.invalid === 0 && preview.valid > 0 && (
            <Button loading={busy} onClick={() => void load(true)}>
              {text.importApply(preview.valid)}
            </Button>
          )}
        </div>
        {preview && (
          <section aria-label={text.importPreview} className="flex flex-col gap-3">
            <p
              role="status"
              className={preview.invalid > 0 ? 'text-destructive' : 'text-muted-foreground'}
            >
              {text.importCount(preview.valid, preview.invalid)}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{text.importColumns.row}</TableHead>
                  <TableHead>{text.importColumns.kpi}</TableHead>
                  <TableHead>{text.importColumns.month}</TableHead>
                  <TableHead>{text.importColumns.value}</TableHead>
                  <TableHead>{text.importColumns.state}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((row) => (
                  <TableRow
                    key={row.row}
                    data-row={row.row}
                    data-invalid={row.errors.length > 0 || undefined}
                  >
                    <TableCell className="tabular-nums">{row.row}</TableCell>
                    <TableCell>{row.kpi}</TableCell>
                    <TableCell>{row.month}</TableCell>
                    <TableCell className="tabular-nums">{row.value}</TableCell>
                    <TableCell>
                      {row.errors.length === 0 ? (
                        <Badge variant="success">
                          <CircleCheckIcon aria-hidden />
                          {text.importOk}
                        </Badge>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {row.errors.map((code) => (
                            <Badge key={code} variant="danger">
                              <CircleXIcon aria-hidden />
                              {text.importErrors[code] ?? code}
                            </Badge>
                          ))}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}
      </div>
    </JbpFrame>
  );
}
