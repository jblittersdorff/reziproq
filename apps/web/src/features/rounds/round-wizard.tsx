import type { RoundCandidate, RoundDetail } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { StatusLine } from '@/components/ui/status-line';
import { StepActions, StepProgress } from '@/components/ui/step-progress';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import {
  createRound,
  roundCandidatesQueryOptions,
  roundRatersQueryOptions,
  setRoundSuppliers,
  startRound,
  updateRoundAssignment,
  updateRoundDraft,
} from '@/lib/api';
import { flash } from '@/lib/flash';
import { useT } from '@/lib/i18n';
import { errorCode, isNotFound, linkClass, roundsPath, useRound, useToken } from './use-round';

const totalSteps = 4;

const today = () => new Date().toISOString().slice(0, 10);

function StepFrame({
  current,
  title,
  children,
}: {
  current: 1 | 2 | 3 | 4;
  title: string;
  children: ReactNode;
}) {
  const t = useT();
  const stepTitles = [
    t.rounds.steps.name,
    t.rounds.steps.suppliers,
    t.rounds.steps.raters,
    t.rounds.steps.review,
  ];
  return (
    <>
      <PagePath
        trail={[
          { label: t.portfolio.title, href: '/portfolio' },
          { label: t.rounds.title, href: roundsPath },
        ]}
        current={title}
      />
      <PageHeader title={title} purpose={t.rounds.purpose} />
      <div className="flex max-w-3xl flex-col gap-6">
        <StepProgress
          current={current}
          total={totalSteps}
          label={t.rounds.stepLabel}
          stepTitle={stepTitles[current - 1] ?? ''}
          steps={stepTitles}
        />
        {children}
      </div>
    </>
  );
}

function back(href: string, label: string) {
  return routerLink({ href, className: linkClass, children: label });
}

/** Gemeinsamer Rahmen: lädt die Runde und zeigt Lade-, Fehler- und Nicht-gefunden-Zustand. */
function DraftStep({
  id,
  current,
  children,
}: {
  id: string;
  current: 2 | 3 | 4;
  children: (round: RoundDetail) => ReactNode;
}) {
  const t = useT();
  const query = useRound(id);
  const body = query.isError ? (
    <ErrorState
      title={isNotFound(query.error) ? t.rounds.notFound : t.rounds.failed}
      action={back(roundsPath, t.rounds.toRounds)}
    />
  ) : !query.data ? (
    <LoadingState label={t.rounds.loading} />
  ) : query.data.status !== 'draft' ? (
    <ErrorState title={t.rounds.notFound} action={back(`${roundsPath}/${id}`, t.rounds.open)} />
  ) : (
    children(query.data)
  );
  return (
    <StepFrame current={current} title={query.data?.name ?? t.rounds.title}>
      {body}
    </StepFrame>
  );
}

/** Schritt 1: Name und Frist; neu anlegen oder den Entwurf ändern. */
export function RoundNamePage({ id }: { id?: string }) {
  const t = useT();
  const query = useRound(id ?? '');
  if (!id) {
    return (
      <StepFrame current={1} title={t.rounds.newRound}>
        <NameStep />
      </StepFrame>
    );
  }
  return (
    <StepFrame current={1} title={query.data?.name ?? t.rounds.newRound}>
      {query.isError ? (
        <ErrorState
          title={isNotFound(query.error) ? t.rounds.notFound : t.rounds.failed}
          action={back(roundsPath, t.rounds.toRounds)}
        />
      ) : !query.data ? (
        <LoadingState label={t.rounds.loading} />
      ) : (
        <NameStep round={query.data} />
      )}
    </StepFrame>
  );
}

function NameStep({ round }: { round?: RoundDetail }) {
  const t = useT();
  const accessToken = useToken();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState(round?.name ?? '');
  const [dueDate, setDueDate] = useState(round?.dueDate ?? '');
  const [errors, setErrors] = useState<{ name?: string; dueDate?: string }>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: { name?: string; dueDate?: string } = {};
    if (name.trim() === '') next.name = t.rounds.nameRequired;
    if (dueDate === '' || dueDate < today()) next.dueDate = t.rounds.duePast;
    setErrors(next);
    if (next.name || next.dueDate) return;
    setSaving(true);
    setFailure(null);
    try {
      const request = { name: name.trim(), dueDate };
      const saved = round
        ? await updateRoundDraft(accessToken, round.id, request)
        : await createRound(accessToken, request);
      queryClient.setQueryData(['rounds', saved.id], saved);
      await queryClient.invalidateQueries({ queryKey: ['rounds'], exact: true });
      await navigate({ to: '/portfolio/runden/$id/lieferanten', params: { id: saved.id } });
    } catch (error) {
      setFailure(errorCode(error) === 'due_date_past' ? t.rounds.duePast : t.rounds.saveFailed);
      setSaving(false);
    }
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      {failure && <StatusLine message={failure} tone="warning" />}
      <FormField label={t.rounds.nameLabel} hint={t.rounds.nameHint} error={errors.name}>
        {(field) => (
          <Input
            {...field}
            name="name"
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
          />
        )}
      </FormField>
      <FormField label={t.rounds.dueLabel} hint={t.rounds.dueHint} error={errors.dueDate}>
        {(field) => (
          <Input
            {...field}
            name="dueDate"
            type="date"
            min={today()}
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        )}
      </FormField>
      <StepActions
        back={back(roundsPath, t.rounds.back)}
        next={
          <Button type="submit" loading={saving}>
            {t.rounds.next}
          </Button>
        }
      />
    </form>
  );
}

/** Schritt 2: Lieferanten wählen, filterbar nach Business Unit und Warengruppe. */
export function RoundSuppliersPage({ id }: { id: string }) {
  return (
    <DraftStep id={id} current={2}>
      {() => <SuppliersStep id={id} />}
    </DraftStep>
  );
}

function SuppliersStep({ id }: { id: string }) {
  const t = useT();
  const accessToken = useToken();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({
    ...roundCandidatesQueryOptions(accessToken, id),
    enabled: accessToken !== '',
  });
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [unit, setUnit] = useState('');
  const [group, setGroup] = useState('');
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (query.isError) return <ErrorState title={t.rounds.failed} />;
  if (!query.data) return <LoadingState label={t.rounds.loading} />;

  const candidates = query.data.candidates;
  const selected =
    chosen ?? candidates.filter((candidate) => candidate.selected).map((c) => c.relationshipId);
  const units = uniqueNames(candidates.flatMap((candidate) => candidate.businessUnits));
  const groups = uniqueNames(candidates.flatMap((candidate) => candidate.materialGroups));
  const visible = candidates.filter(
    (candidate) =>
      (unit === '' || candidate.businessUnits.some((item) => item.id === unit)) &&
      (group === '' || candidate.materialGroups.some((item) => item.id === group)),
  );

  const toggle = (relationshipId: string, checked: boolean) =>
    setChosen(
      checked ? [...selected, relationshipId] : selected.filter((item) => item !== relationshipId),
    );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFailure(null);
    try {
      const saved = await setRoundSuppliers(accessToken, id, { relationshipIds: selected });
      queryClient.setQueryData(['rounds', id], saved);
      await navigate({ to: '/portfolio/runden/$id/bewertende', params: { id } });
    } catch (error) {
      setFailure(errorCode(error) === 'no_business_unit' ? t.rounds.noUnit : t.rounds.saveFailed);
      setSaving(false);
    }
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      {failure && <StatusLine message={failure} tone="warning" />}
      {candidates.length === 0 ? (
        <EmptyState title={t.rounds.noCandidates} description={t.rounds.noCandidatesHint} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t.rounds.filterUnit}>
              {(field) => (
                <NativeSelect {...field} value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="">{t.rounds.filterAll}</option>
                  {units.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField label={t.rounds.filterGroup}>
              {(field) => (
                <NativeSelect {...field} value={group} onChange={(e) => setGroup(e.target.value)}>
                  <option value="">{t.rounds.filterAll}</option>
                  {groups.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          </div>
          <p role="status" className="text-muted-foreground text-sm">
            {t.rounds.selectedCount(selected.length)}
          </p>
          {visible.length === 0 ? (
            <p className="text-muted-foreground">{t.rounds.noCandidates}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-lg bg-card shadow-card">
              {visible.map((candidate) => (
                <CandidateRow
                  key={candidate.relationshipId}
                  candidate={candidate}
                  checked={selected.includes(candidate.relationshipId)}
                  onChange={(checked) => toggle(candidate.relationshipId, checked)}
                />
              ))}
            </ul>
          )}
        </>
      )}
      <StepActions
        back={back(`${roundsPath}/${id}/name`, t.rounds.back)}
        later={back(roundsPath, t.rounds.later)}
        next={
          <Button type="submit" loading={saving}>
            {t.rounds.next}
          </Button>
        }
      />
    </form>
  );
}

function uniqueNames(items: { id: string; name: string }[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

function CandidateRow({
  candidate,
  checked,
  onChange,
}: {
  candidate: RoundCandidate;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const t = useT();
  const detail = [
    candidate.businessUnits.map((item) => item.name).join(', ') || t.rounds.noUnit,
    ...candidate.materialGroups.map((item) => item.name),
  ].join(' · ');
  return (
    <li className="flex min-h-11 items-center gap-3 p-3">
      <Checkbox
        checked={checked}
        aria-label={t.rounds.selectSupplier(candidate.name)}
        onCheckedChange={(next) => onChange(next === true)}
      />
      <div className="flex min-w-0 flex-col">
        <span className="font-medium">{candidate.name}</span>
        <span className="text-muted-foreground text-sm">{detail}</span>
      </div>
    </li>
  );
}

/** Schritt 3: Bewertende je Lieferant, Business Unit, Warengruppe und Funktion. */
export function RoundRatersPage({ id }: { id: string }) {
  return (
    <DraftStep id={id} current={3}>
      {(round) => <RatersStep round={round} />}
    </DraftStep>
  );
}

function RatersStep({ round }: { round: RoundDetail }) {
  const t = useT();
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const raters = useQuery({ ...roundRatersQueryOptions(accessToken), enabled: accessToken !== '' });
  const [failure, setFailure] = useState<string | null>(null);

  if (raters.isError) return <ErrorState title={t.rounds.failed} />;
  if (!raters.data) return <LoadingState label={t.rounds.loading} />;

  const change = async (assignmentId: string, raterUserId: string) => {
    setFailure(null);
    try {
      const saved = await updateRoundAssignment(accessToken, round.id, assignmentId, {
        raterUserId: raterUserId === '' ? null : raterUserId,
      });
      queryClient.setQueryData(['rounds', round.id], saved);
    } catch {
      setFailure(t.rounds.saveFailed);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {failure && <StatusLine message={failure} tone="warning" />}
      <p className="text-muted-foreground">{t.rounds.raterHint}</p>
      {round.suppliers.map((supplier) => (
        <section key={supplier.relationshipId} className="flex flex-col gap-2">
          <h4 className="font-semibold">{supplier.name}</h4>
          <ul className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-lg bg-card shadow-card">
            {supplier.assignments.map((assignment) => (
              <li key={assignment.id} className="grid gap-2 p-3 sm:grid-cols-2 sm:items-center">
                <span className="text-sm">
                  {assignment.businessUnit.name} ·{' '}
                  {assignment.materialGroup?.name ?? t.rounds.groupNone} ·{' '}
                  {t.roles.functions[assignment.function]}
                </span>
                <NativeSelect
                  aria-label={t.rounds.raterFor(
                    `${supplier.name}, ${assignment.businessUnit.name}, ${t.roles.functions[assignment.function]}`,
                  )}
                  value={assignment.rater?.id ?? ''}
                  onChange={(event) => change(assignment.id, event.target.value)}
                >
                  <option value="">{t.rounds.raterNone}</option>
                  {raters.data.raters.map((rater) => (
                    <option key={rater.id} value={rater.id}>
                      {rater.name}
                    </option>
                  ))}
                </NativeSelect>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <StepActions
        back={back(`${roundsPath}/${round.id}/lieferanten`, t.rounds.back)}
        later={back(roundsPath, t.rounds.later)}
        next={routerLink({
          href: `${roundsPath}/${round.id}/pruefen`,
          className:
            'inline-flex min-h-11 items-center rounded-full bg-primary px-5 font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          children: t.rounds.next,
        })}
      />
    </div>
  );
}

/** Schritt 4: Zusammenfassung und Start. */
export function RoundReviewPage({ id }: { id: string }) {
  return (
    <DraftStep id={id} current={4}>
      {(round) => <ReviewStep round={round} />}
    </DraftStep>
  );
}

function ReviewStep({ round }: { round: RoundDetail }) {
  const t = useT();
  const accessToken = useToken();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [starting, setStarting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const assignments = round.suppliers.flatMap((supplier) => supplier.assignments);
  const missing = assignments.filter((assignment) => !assignment.rater).length;
  const raterCount = new Set(assignments.map((a) => a.rater?.id).filter(Boolean)).size;

  const start = async () => {
    setStarting(true);
    setFailure(null);
    try {
      const saved = await startRound(accessToken, round.id);
      queryClient.setQueryData(['rounds', round.id], saved);
      await queryClient.invalidateQueries({ queryKey: ['rounds'], exact: true });
      flash.set(t.rounds.started);
      await navigate({ to: '/portfolio/runden/$id', params: { id: round.id } });
    } catch (error) {
      setFailure(
        errorCode(error) === 'no_active_model' ? t.rounds.noActiveModel : t.rounds.startFailed,
      );
      setStarting(false);
    }
  };

  const blocked =
    assignments.length === 0 ? t.rounds.reviewNothing : missing > 0 ? t.rounds.reviewMissing : null;

  return (
    <div className="flex flex-col gap-6">
      {failure && <StatusLine message={failure} tone="warning" />}
      <p className="font-medium text-lg">
        {t.rounds.reviewSummary(round.suppliers.length, raterCount)}
      </p>
      <ul className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-lg bg-card shadow-card">
        {round.suppliers.map((supplier) => (
          <li key={supplier.relationshipId} className="flex justify-between gap-4 p-3">
            <span>{supplier.name}</span>
            <span className="text-muted-foreground text-sm">{supplier.assignments.length}</span>
          </li>
        ))}
      </ul>
      {blocked ? (
        <StatusLine message={blocked} tone="warning" />
      ) : (
        <p className="text-muted-foreground text-sm">{t.rounds.mailHint}</p>
      )}
      <StepActions
        back={back(`${roundsPath}/${round.id}/bewertende`, t.rounds.back)}
        later={back(roundsPath, t.rounds.later)}
        next={
          <Button type="button" disabled={blocked !== null} loading={starting} onClick={start}>
            {t.rounds.start}
          </Button>
        }
      />
    </div>
  );
}
