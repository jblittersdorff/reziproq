import type { RatingDetail, RatingOutcome } from '@reziproq/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import { StepActions, StepProgress } from '@/components/ui/step-progress';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/features/auth/use-permissions';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { saveRating, submitRating } from '@/lib/api';
import { flash } from '@/lib/flash';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { errorBody, isNotFound, linkClass, ratingsPath, useRating, useToken } from './use-rating';

export type RatingStep = 1 | 2 | 3;

const stepPaths = ['', '/qualitaet', '/zusammenfassung'] as const;
const axes = ['impact', 'quality'] as const;

function stepHref(id: string, step: RatingStep) {
  return `${ratingsPath}/${id}${stepPaths[step - 1]}`;
}

/** Ein Schritt der Bewertung (SEG-04): zwei Achsen mit Reglern, dann die Zusammenfassung. */
export function RatingPage({ id, step }: { id: string; step: RatingStep }) {
  const t = useT();
  const query = useRating(id);
  const detail = query.data;
  const toList = routerLink({
    href: ratingsPath,
    className: linkClass,
    children: t.ratings.toList,
  });

  return (
    <>
      <PagePath
        trail={[{ label: t.ratings.title, href: ratingsPath }]}
        current={detail?.assignment.supplier ?? t.ratings.title}
      />
      {query.isError ? (
        <>
          <PageHeader title={t.ratings.title} />
          <ErrorState
            title={isNotFound(query.error) ? t.ratings.notFound : t.ratings.failed}
            action={toList}
          />
        </>
      ) : !detail ? (
        <>
          <PageHeader title={t.ratings.title} />
          <LoadingState label={t.ratings.loading} />
        </>
      ) : (
        <>
          <PageHeader
            title={detail.assignment.supplier}
            purpose={[detail.assignment.businessUnit.name, detail.assignment.materialGroup?.name]
              .filter(Boolean)
              .join(' · ')}
          />
          <div className="flex flex-col gap-6">
            <StepProgress
              current={step}
              total={3}
              label={t.ratings.step}
              stepTitle={t.ratings.stepTitles[step - 1] as string}
            />
            {!detail.editable && (
              <StatusLine
                message={
                  detail.assignment.roundStatus === 'closed'
                    ? t.ratings.roundClosed
                    : t.ratings.readOnly
                }
                tone="warning"
              />
            )}
            {step === 3 ? (
              <Summary id={id} detail={detail} />
            ) : (
              <AxisStep id={id} detail={detail} step={step} />
            )}
          </div>
        </>
      )}
    </>
  );
}

function AxisStep({ id, detail, step }: { id: string; detail: RatingDetail; step: 1 | 2 }) {
  const t = useT();
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canRate = useCan('bewertungen.abgeben');
  const editable = detail.editable && canRate;
  const axis = axes[step - 1];
  const criteria = detail.model.criteria.filter((criterion) => criterion.axis === axis);
  const [failure, setFailure] = useState<string | null>(null);
  // Eingaben, die noch nicht beim Server sind; der Server-Stand bleibt die Grundlage.
  const [local, setLocal] = useState<Record<string, number>>({});
  const saved = useRef<Record<string, number | string>>({});

  const stored = (key: string, field: 'ist' | 'soll') =>
    detail.values.find((value) => value.criterionKey === key)?.[field] ?? null;

  const persist = async (
    criterionKey: string,
    field: 'ist' | 'soll' | 'comment',
    value: unknown,
  ) => {
    const slot = `${criterionKey}:${field}`;
    if (saved.current[slot] === value) return;
    saved.current[slot] = value as number | string;
    setFailure(null);
    try {
      const next = await saveRating(accessToken, id, { criterionKey, [field]: value });
      queryClient.setQueryData(['ratings', id], next);
      await queryClient.invalidateQueries({ queryKey: ['ratings', 'mine'], exact: true });
    } catch {
      delete saved.current[slot];
      setFailure(t.ratings.saveFailed);
    }
  };

  const href = (to: RatingStep) => stepHref(id, to);

  return (
    <div className="flex flex-col gap-8">
      {failure && <StatusLine message={failure} tone="warning" />}
      <ul className="flex flex-col gap-8">
        {criteria.map((criterion) => (
          <li key={criterion.key} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h4 className="font-semibold">{criterion.name}</h4>
              <p className="text-muted-foreground text-sm">{criterion.description}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(['ist', 'soll'] as const).map((field) => {
                const key = `${criterion.key}:${field}`;
                const current = local[key] ?? stored(criterion.key, field);
                return (
                  <FormField
                    key={field}
                    label={t.ratings[field]}
                    hint={current === null ? t.ratings.notRated : t.ratings.score(current)}
                  >
                    {(props) => (
                      <input
                        {...props}
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={current ?? 50}
                        disabled={!editable}
                        aria-valuetext={
                          current === null ? t.ratings.notRated : t.ratings.score(current)
                        }
                        onChange={(event) =>
                          setLocal({ ...local, [key]: Number(event.target.value) })
                        }
                        onPointerUp={(event) =>
                          persist(criterion.key, field, Number(event.currentTarget.value))
                        }
                        onKeyUp={(event) =>
                          persist(criterion.key, field, Number(event.currentTarget.value))
                        }
                        onBlur={(event) => {
                          if (key in local)
                            persist(criterion.key, field, Number(event.currentTarget.value));
                        }}
                        className={cn(
                          'h-11 w-full accent-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                          !editable && 'opacity-60',
                        )}
                      />
                    )}
                  </FormField>
                );
              })}
            </div>
            <FormField label={t.ratings.comment}>
              {(props) => (
                <Textarea
                  {...props}
                  rows={2}
                  maxLength={500}
                  disabled={!editable}
                  defaultValue={
                    detail.values.find((value) => value.criterionKey === criterion.key)?.comment ??
                    ''
                  }
                  onBlur={(event) => persist(criterion.key, 'comment', event.target.value.trim())}
                />
              )}
            </FormField>
          </li>
        ))}
      </ul>
      <StepActions
        back={routerLink({
          href: step === 1 ? ratingsPath : href(1),
          className: linkClass,
          children: step === 1 ? t.ratings.toList : t.ratings.back,
        })}
        later={
          step === 1 &&
          routerLink({ href: ratingsPath, className: linkClass, children: t.ratings.later })
        }
        next={
          <Button type="button" onClick={() => navigate({ to: href((step + 1) as RatingStep) })}>
            {t.ratings.next}
          </Button>
        }
      />
    </div>
  );
}

function Summary({ id, detail }: { id: string; detail: RatingDetail }) {
  const t = useT();
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canRate = useCan('bewertungen.abgeben');
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const names = (keys: string[]) =>
    keys
      .map((key) => detail.model.criteria.find((criterion) => criterion.key === key)?.name ?? key)
      .join(', ');
  const missing = detail.values
    .filter((value) => value.ist === null || value.soll === null)
    .map((value) => value.criterionKey);

  const submit = async () => {
    setSaving(true);
    setFailure(null);
    try {
      const next = await submitRating(accessToken, id);
      queryClient.setQueryData(['ratings', id], next);
      await queryClient.invalidateQueries({ queryKey: ['ratings', 'mine'], exact: true });
      flash.set(t.ratings.submitted);
      await navigate({ to: ratingsPath });
    } catch (error) {
      const body = errorBody(error);
      setFailure(
        body.code === 'ratings_incomplete'
          ? t.ratings.incomplete(names(body.missing ?? []))
          : body.code === 'round_closed'
            ? t.ratings.roundClosed
            : t.ratings.saveFailed,
      );
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {failure && <StatusLine message={failure} tone="warning" />}
      {missing.length > 0 && (
        <StatusLine message={t.ratings.missingOnSummary(names(missing))} tone="warning" />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <OutcomeCard title={t.ratings.typeIst} outcome={detail.ist} />
        <OutcomeCard title={t.ratings.typeSoll} outcome={detail.soll} />
      </div>
      <Matrix detail={detail} />
      <StepActions
        back={routerLink({ href: stepHref(id, 2), className: linkClass, children: t.ratings.back })}
        later={routerLink({ href: ratingsPath, className: linkClass, children: t.ratings.later })}
        next={
          detail.editable && canRate ? (
            <Button type="button" loading={saving} disabled={missing.length > 0} onClick={submit}>
              {t.ratings.submit}
            </Button>
          ) : null
        }
      />
    </div>
  );
}

function OutcomeCard({ title, outcome }: { title: string; outcome: RatingOutcome | null }) {
  const t = useT();
  return (
    <section className="flex flex-col gap-2 rounded-md border p-4">
      <h4 className="text-muted-foreground text-sm">{title}</h4>
      {outcome ? (
        <>
          <p className="font-semibold text-lg">{outcome.typeName}</p>
          <p className="text-muted-foreground text-sm">
            {t.ratings.impactAxis}: {Math.round(outcome.impactScore)} · {t.ratings.qualityAxis}:{' '}
            {Math.round(outcome.qualityScore)}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground">{t.ratings.notRated}</p>
      )}
    </section>
  );
}

/** 3×3-Matrix: Impact nach rechts, Qualität nach oben; Ist und Soll sind in ihrer Zelle markiert. */
function Matrix({ detail }: { detail: RatingDetail }) {
  const t = useT();
  const marker = (outcome: RatingOutcome | null, impact: number, quality: number) =>
    outcome?.impactLevel === impact && outcome.qualityLevel === quality;
  return (
    <section aria-label={t.ratings.matrix} className="flex flex-col gap-2">
      <p className="text-muted-foreground text-sm">
        {t.ratings.qualityAxis} ↑ · {t.ratings.impactAxis} →
      </p>
      <ul className="grid grid-cols-3 gap-2">
        {[3, 2, 1].flatMap((quality) =>
          [1, 2, 3].map((impact) => {
            const type = detail.model.types.find(
              (entry) => entry.impactLevel === impact && entry.qualityLevel === quality,
            );
            const isIst = marker(detail.ist, impact, quality);
            const isSoll = marker(detail.soll, impact, quality);
            const marks = [isIst && t.ratings.ist, isSoll && t.ratings.soll].filter(Boolean);
            return (
              <li
                key={`${impact}-${quality}`}
                aria-label={t.ratings.cell(type?.name ?? '', marks.join(', '))}
                className={cn(
                  'flex min-h-20 flex-col gap-1 rounded-md border p-2 text-sm',
                  marks.length > 0 && 'border-primary bg-secondary',
                )}
              >
                <span className="break-words">{type?.name}</span>
                <span className="flex flex-wrap gap-1">
                  {isIst && <Badge variant="neutral">{t.ratings.ist}</Badge>}
                  {isSoll && <Badge variant="selected">→ {t.ratings.soll}</Badge>}
                </span>
              </li>
            );
          }),
        )}
      </ul>
    </section>
  );
}
