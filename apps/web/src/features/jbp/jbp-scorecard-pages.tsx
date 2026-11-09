import {
  type Kpi,
  kpiBenefits,
  kpiDirections,
  type MeetingSide,
  maxScorecardKpis,
  type ScorecardView,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { PenLineIcon, PlusIcon } from 'lucide-react';
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
import { Tile } from '@/components/ui/tile';
import { apiBase, type MeetingPlace } from '@/features/meetings/meeting-pages';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import {
  createKpi,
  deleteKpi,
  scorecardQueryOptions,
  signScorecard,
  startScorecardVersion,
  updateKpi,
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

/** Oben Status und Unterschriften, darunter die Tabelle der Kennzahlen. */
export function JbpScorecardPage({ place }: { place: MeetingPlace }) {
  const text = useT().jbp.scorecard;
  return (
    <JbpFrame
      place={place}
      trail={[]}
      current={text.title}
      header={<PageHeader title={text.title} purpose={text.purpose} />}
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
        <KpiTable place={place} data={data} />
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
          <p className="font-bold text-2xl tracking-title">
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
  const name = (kpi: Kpi) =>
    kpi.own && data.canEdit ? (
      routerLink({
        href: `${scorecardPath(place)}/${kpi.id}`,
        className:
          'font-semibold hover:underline focus-visible:underline focus-visible:outline-none',
        'aria-label': `${kpi.name}: ${text.edit}`,
        children: kpi.name,
      })
    ) : (
      <span className="font-semibold">{kpi.name}</span>
    );
  return (
    <>
      {/* Schmal als Liste, breit als Tabelle: nichts wird abgeschnitten. */}
      <ul data-slot="kpi-list" className="overflow-hidden rounded-xl bg-card sm:hidden">
        {data.kpis.map((kpi) => (
          <li
            key={kpi.id}
            className="flex flex-col gap-1 border-border border-b px-5 py-4 last:border-b-0"
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
            <section className="flex max-w-2xl flex-col gap-3 rounded-xl bg-card p-5">
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
