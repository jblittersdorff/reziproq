import {
  type SegmentAxis,
  type SegmentModel,
  type SegmentModelResponse,
  type SegmentType,
  updateSegmentBoundariesSchema,
  updateSegmentCriterionSchema,
  updateSegmentTypeSchema,
  updateSegmentWeightsSchema,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { SettingsGroup } from '@/components/ui/settings-group';
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
import { useCan } from '@/features/auth/use-permissions';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath, useGoBack } from '@/features/shell/page-path';
import {
  activateSegmentModelDraft,
  segmentModelQueryOptions,
  updateSegmentBoundaries,
  updateSegmentCriterion,
  updateSegmentType,
  updateSegmentWeights,
} from '@/lib/api';
import { flash, useFlash } from '@/lib/flash';
import { useLocale, useT } from '@/lib/i18n';

const modelPath = '/einstellungen/segmentmodell';

function settingsTrail(t: ReturnType<typeof useT>) {
  return [
    { label: t.profile.title, href: '/profil' },
    { label: t.settings.title, href: '/einstellungen' },
  ];
}

function useSegmentModel() {
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({
    ...segmentModelQueryOptions(accessToken),
    enabled: accessToken !== '',
  });
  return { ...query, accessToken };
}

function visibleModel(data: SegmentModelResponse | undefined, canManage: boolean) {
  return (canManage ? data?.draft : null) ?? data?.active ?? null;
}

function useSegmentSave() {
  const t = useT();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const save = async (request: () => Promise<SegmentModelResponse>) => {
    setFailure(null);
    setSaving(true);
    try {
      const response = await request();
      queryClient.setQueryData(['segment-model'], response);
      flash.set(t.segmentModel.saved);
      await navigate({ to: modelPath });
    } catch {
      setFailure(t.segmentModel.saveFailed);
    } finally {
      setSaving(false);
    }
  };
  return { save, saving, failure };
}

function percent(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function levelName(level: number, t: ReturnType<typeof useT>) {
  return level === 1
    ? t.segmentModel.level1
    : level === 2
      ? t.segmentModel.level2
      : t.segmentModel.level3;
}

export function SegmentModelPage() {
  const t = useT();
  const { locale } = useLocale();
  const canManage = useCan('segmentmodell.verwalten');
  const query = useSegmentModel();
  const [savedMessage, hideSavedMessage] = useFlash();
  const [failure, setFailure] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const model = visibleModel(query.data, canManage);
  const active = query.data?.active ?? null;
  const draft = canManage ? (query.data?.draft ?? null) : null;

  const activate = async () => {
    setFailure(null);
    setMessage(null);
    setActivating(true);
    try {
      const response = await activateSegmentModelDraft(query.accessToken);
      queryClient.setQueryData(['segment-model'], response);
      setMessage(t.segmentModel.activationSuccess);
    } catch {
      setFailure(t.segmentModel.activationFailed);
    } finally {
      setActivating(false);
    }
  };

  return (
    <>
      <PagePath trail={settingsTrail(t)} current={t.segmentModel.title} />
      <PageHeader
        title={t.segmentModel.title}
        purpose={t.segmentModel.purpose}
        badge={
          model ? (
            <Badge variant={draft ? 'warning' : 'success'}>
              {draft ? t.segmentModel.draft : t.segmentModel.active}
            </Badge>
          ) : undefined
        }
      />
      {savedMessage && <StatusLine message={savedMessage} onHidden={hideSavedMessage} />}
      {message && <StatusLine message={message} />}
      {failure && <StatusLine message={failure} tone="warning" />}
      {query.isError ? (
        <ErrorState title={t.segmentModel.failed} />
      ) : !query.data ? (
        <LoadingState label={t.segmentModel.loading} />
      ) : !model ? (
        <EmptyState
          title={t.segmentModel.emptyTitle}
          description={t.segmentModel.emptyDescription}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {!canManage && (
            <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
              {t.segmentModel.readOnly}
            </p>
          )}
          {active && (
            <p className="text-muted-foreground">
              {t.segmentModel.activeSince(
                new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                  new Date(active.activatedAt ?? active.createdAt),
                ),
                active.version,
              )}
            </p>
          )}
          {draft && (
            <section className="flex flex-col gap-3 rounded-lg bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <p className="flex items-center gap-2 font-medium">
                  <Badge variant="warning">{t.segmentModel.draft}</Badge>
                  {t.segmentModel.version(draft.version)}
                </p>
                <p className="text-muted-foreground text-sm">{t.segmentModel.activationHint}</p>
              </div>
              {activating ? (
                <Button loading>{t.segmentModel.activating}</Button>
              ) : (
                <ConfirmButton
                  variant="default"
                  question={t.segmentModel.confirmActivation}
                  confirmLabel={t.segmentModel.activate}
                  cancelLabel={t.segmentModel.cancel}
                  onConfirm={() => void activate()}
                >
                  {t.segmentModel.activate}
                </ConfirmButton>
              )}
            </section>
          )}
          <CriteriaTable model={model} axis="impact" canManage={canManage} locale={locale} />
          <CriteriaTable model={model} axis="quality" canManage={canManage} locale={locale} />
          {canManage &&
            routerLink({
              href: `${modelPath}/gewichte`,
              className:
                'inline-flex min-h-11 items-center self-end text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              children: t.segmentModel.editWeights,
            })}
          <BoundariesSummary model={model} canManage={canManage} />
          <TypesMatrix model={model} canManage={canManage} />
        </div>
      )}
    </>
  );
}

function CriteriaTable({
  model,
  axis,
  canManage,
  locale,
}: {
  model: SegmentModel;
  axis: SegmentAxis;
  canManage: boolean;
  locale: string;
}) {
  const t = useT();
  const criteria = model.criteria.filter((criterion) => criterion.axis === axis);
  const title = axis === 'impact' ? t.segmentModel.impactAxis : t.segmentModel.qualityAxis;
  return (
    <SettingsGroup title={title}>
      <ul className="divide-y divide-border">
        {criteria.map((criterion) => (
          <li
            key={criterion.key}
            className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-6"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{criterion.name}</p>
              <p className="text-muted-foreground text-sm">{criterion.description}</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 sm:justify-end">
              <span className="text-muted-foreground text-sm">{t.segmentModel.weightHeader}</span>
              <span className="text-right tabular-nums">{percent(criterion.weight, locale)} %</span>
              {canManage &&
                routerLink({
                  href: `${modelPath}/kriterium/${encodeURIComponent(criterion.key)}`,
                  className:
                    'inline-flex min-h-11 max-w-full items-center justify-end text-right underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  'aria-label': t.segmentModel.editCriterion(criterion.name),
                  children: t.segmentModel.editCriterion(criterion.name),
                })}
            </div>
          </li>
        ))}
      </ul>
    </SettingsGroup>
  );
}

function BoundariesSummary({ model, canManage }: { model: SegmentModel; canManage: boolean }) {
  const t = useT();
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-semibold text-lg">{t.segmentModel.boundaries}</h2>
        {canManage &&
          routerLink({
            href: `${modelPath}/grenzen`,
            className:
              'inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            children: t.segmentModel.editBoundaries,
          })}
      </div>
      <p className="text-muted-foreground text-sm">{t.segmentModel.boundariesHint}</p>
      <dl className="divide-y divide-border rounded-lg bg-card">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt>{t.segmentModel.lowMax}</dt>
          <dd className="font-medium tabular-nums">{model.lowMax}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt>{t.segmentModel.midMax}</dt>
          <dd className="font-medium tabular-nums">{model.midMax}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt>{t.segmentModel.highFrom(model.midMax + 1)}</dt>
          <dd className="font-medium">100</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt>{t.segmentModel.deviationThreshold}</dt>
          <dd className="font-medium tabular-nums">{model.deviationThreshold}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt>{t.segmentModel.focusSpendShare}</dt>
          <dd className="font-medium tabular-nums">{model.focusSpendShare} %</dd>
        </div>
      </dl>
    </section>
  );
}

function TypesMatrix({ model, canManage }: { model: SegmentModel; canManage: boolean }) {
  const t = useT();
  const levels = [1, 2, 3] as const;
  const byCell = new Map(
    model.types.map((entry) => [`${entry.impactLevel}-${entry.qualityLevel}`, entry]),
  );
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-lg">{t.segmentModel.relationshipTypes}</h2>
      <p className="text-muted-foreground text-sm">{t.segmentModel.typeMatrix}</p>
      <div className="flex flex-col gap-4 md:hidden">
        {levels.map((impactLevel) => (
          <section key={impactLevel} className="flex flex-col gap-2">
            <h3 className="font-medium">
              {t.segmentModel.impactAxis}: {levelName(impactLevel, t)}
            </h3>
            <ul className="divide-y divide-border rounded-lg bg-card">
              {levels.map((qualityLevel) => {
                const entry = byCell.get(`${impactLevel}-${qualityLevel}`);
                return (
                  <li key={qualityLevel} className="flex flex-col gap-2 px-4 py-3">
                    <p className="text-muted-foreground text-sm">
                      {t.segmentModel.qualityAxis}: {levelName(qualityLevel, t)}
                    </p>
                    {entry ? (
                      <TypeCell type={entry} canManage={canManage} t={t} />
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <div className="hidden md:block">
        <Table className="table-fixed">
          <caption className="sr-only">{t.segmentModel.matrixCaption}</caption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[18%]">{t.segmentModel.impactAxis}</TableHead>
              {levels.map((level) => (
                <TableHead key={level} className="text-center">
                  {levelName(level, t)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {levels.map((impactLevel) => (
              <TableRow key={impactLevel}>
                <TableHead scope="row">{levelName(impactLevel, t)}</TableHead>
                {levels.map((qualityLevel) => {
                  const entry = byCell.get(`${impactLevel}-${qualityLevel}`);
                  if (!entry) {
                    return (
                      <TableCell key={qualityLevel} className="text-muted-foreground">
                        –
                      </TableCell>
                    );
                  }
                  return (
                    <TableCell key={qualityLevel} className="whitespace-normal align-top">
                      <TypeCell type={entry} canManage={canManage} t={t} />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function TypeCell({
  type,
  canManage,
  t,
}: {
  type: SegmentType;
  canManage: boolean;
  t: ReturnType<typeof useT>;
}) {
  const label = canManage ? t.segmentModel.editType(type.name) : type.name;
  const content = (
    <>
      <span className="font-medium">{type.name}</span>
      <span className="mt-1 block text-muted-foreground text-sm">{type.description}</span>
    </>
  );
  return canManage
    ? routerLink({
        href: `${modelPath}/typ/${type.impactLevel}-${type.qualityLevel}`,
        'aria-label': label,
        className:
          'block min-h-11 rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        children: content,
      })
    : content;
}

function EditorFrame({
  title,
  purpose,
  children,
}: {
  title: string;
  purpose: string;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <>
      <PagePath
        trail={[...settingsTrail(t), { label: t.segmentModel.title, href: modelPath }]}
        current={title}
      />
      <PageHeader title={title} purpose={purpose} />
      {children}
    </>
  );
}

function EditorState({
  model,
  isError,
  isLoading,
  children,
}: {
  model: SegmentModel | null;
  isError: boolean;
  isLoading: boolean;
  children: (model: SegmentModel) => ReactNode;
}) {
  const t = useT();
  if (isError) return <ErrorState title={t.segmentModel.failed} />;
  if (isLoading) return <LoadingState label={t.segmentModel.loading} />;
  if (!model) {
    return (
      <EmptyState title={t.segmentModel.emptyTitle} description={t.segmentModel.emptyDescription} />
    );
  }
  return children(model);
}

function SaveError({ failure }: { failure: string | null }) {
  return failure ? <StatusLine message={failure} tone="warning" /> : null;
}

function SaveActions({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  const t = useT();
  return (
    <FormActions>
      <Button type="button" variant="ghost" onClick={onCancel}>
        {t.segmentModel.cancel}
      </Button>
      <Button type="submit" loading={saving}>
        {saving ? t.segmentModel.saving : t.segmentModel.save}
      </Button>
    </FormActions>
  );
}

export function SegmentCriterionPage({ criterionKey }: { criterionKey: string }) {
  const t = useT();
  const canManage = useCan('segmentmodell.verwalten');
  const query = useSegmentModel();
  const model = visibleModel(query.data, canManage);
  const criterion = model?.criteria.find((entry) => entry.key === criterionKey);
  const title = criterion
    ? t.segmentModel.editCriterion(criterion.name)
    : t.segmentModel.criterionTitle;

  return (
    <EditorFrame title={title} purpose={t.segmentModel.purpose}>
      <EditorState model={model} isError={query.isError} isLoading={!query.data}>
        {(current) => {
          const currentCriterion = current.criteria.find((entry) => entry.key === criterionKey);
          if (!currentCriterion) {
            return (
              <EmptyState title={t.segmentModel.notFound} description={t.notFound.description} />
            );
          }
          return (
            <CriterionForm
              key={`${current.id}-${currentCriterion.key}`}
              criterion={currentCriterion}
              criterionKey={criterionKey}
              accessToken={query.accessToken}
              canManage={canManage}
            />
          );
        }}
      </EditorState>
    </EditorFrame>
  );
}

function CriterionForm({
  criterion,
  criterionKey,
  accessToken,
  canManage,
}: {
  criterion: SegmentModel['criteria'][number];
  criterionKey: string;
  accessToken: string;
  canManage: boolean;
}) {
  const t = useT();
  const [name, setName] = useState(criterion.name);
  const [description, setDescription] = useState(criterion.description);
  const [invalid, setInvalid] = useState(false);
  const { save, saving, failure } = useSegmentSave();
  const goBack = useGoBack(modelPath);
  if (!canManage) return <ReadOnlyNotice />;
  return (
    <form
      noValidate
      className="flex max-w-xl flex-col gap-6"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        const parsed = updateSegmentCriterionSchema.safeParse({ name, description });
        if (!parsed.success) {
          setInvalid(true);
          return;
        }
        setInvalid(false);
        void save(() => updateSegmentCriterion(accessToken, criterionKey, parsed.data));
      }}
    >
      <SaveError failure={failure} />
      {invalid && (
        <p role="alert" className="text-destructive text-sm">
          {t.segmentModel.invalidText}
        </p>
      )}
      <FormField label={t.segmentModel.name}>
        {(field) => (
          <Input
            {...field}
            name="name"
            value={name}
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
          />
        )}
      </FormField>
      <FormField label={t.segmentModel.description}>
        {(field) => (
          <Textarea
            {...field}
            name="description"
            value={description}
            maxLength={500}
            onChange={(event) => setDescription(event.target.value)}
          />
        )}
      </FormField>
      <SaveActions saving={saving} onCancel={goBack} />
    </form>
  );
}

export function SegmentWeightsPage() {
  const t = useT();
  const canManage = useCan('segmentmodell.verwalten');
  const query = useSegmentModel();
  const model = visibleModel(query.data, canManage);

  return (
    <EditorFrame title={t.segmentModel.weightTitle} purpose={t.segmentModel.purpose}>
      <EditorState model={model} isError={query.isError} isLoading={!query.data}>
        {(current) => {
          if (!canManage) return <ReadOnlyNotice />;
          return <WeightsForm key={current.id} model={current} accessToken={query.accessToken} />;
        }}
      </EditorState>
    </EditorFrame>
  );
}

function WeightsForm({ model, accessToken }: { model: SegmentModel; accessToken: string }) {
  const t = useT();
  const { locale } = useLocale();
  const [weights, setWeights] = useState<Record<SegmentAxis, Record<string, string>>>(() => ({
    impact: Object.fromEntries(
      model.criteria
        .filter((criterion) => criterion.axis === 'impact')
        .map((criterion) => [criterion.key, String(criterion.weight)]),
    ),
    quality: Object.fromEntries(
      model.criteria
        .filter((criterion) => criterion.axis === 'quality')
        .map((criterion) => [criterion.key, String(criterion.weight)]),
    ),
  }));
  const [invalid, setInvalid] = useState(false);
  const { save, saving, failure } = useSegmentSave();
  const goBack = useGoBack(modelPath);
  const request = {
    impact: model.criteria
      .filter((criterion) => criterion.axis === 'impact')
      .map((criterion) => ({
        key: criterion.key,
        weight:
          weights.impact[criterion.key] === '' ? Number.NaN : Number(weights.impact[criterion.key]),
      })),
    quality: model.criteria
      .filter((criterion) => criterion.axis === 'quality')
      .map((criterion) => ({
        key: criterion.key,
        weight:
          weights.quality[criterion.key] === ''
            ? Number.NaN
            : Number(weights.quality[criterion.key]),
      })),
  };
  const totals = {
    impact: request.impact.reduce((sum, entry) => sum + entry.weight, 0),
    quality: request.quality.reduce((sum, entry) => sum + entry.weight, 0),
  };
  return (
    <form
      noValidate
      className="flex max-w-2xl flex-col gap-6"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        const parsed = updateSegmentWeightsSchema.safeParse(request);
        if (!parsed.success) {
          setInvalid(true);
          return;
        }
        setInvalid(false);
        void save(() => updateSegmentWeights(accessToken, parsed.data));
      }}
    >
      <SaveError failure={failure} />
      {invalid && (
        <p role="alert" className="text-destructive text-sm">
          {t.segmentModel.invalidWeights}
        </p>
      )}
      {(['impact', 'quality'] as const).map((axis) => (
        <SettingsGroup
          key={axis}
          title={axis === 'impact' ? t.segmentModel.impactAxis : t.segmentModel.qualityAxis}
        >
          <div className="flex flex-col gap-4 p-4">
            {model.criteria
              .filter((criterion) => criterion.axis === axis)
              .map((criterion) => (
                <FormField key={criterion.key} label={criterion.name} hint={criterion.description}>
                  {(field) => (
                    <Input
                      {...field}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      inputMode="decimal"
                      value={weights[axis][criterion.key] ?? ''}
                      onChange={(event) => {
                        setInvalid(false);
                        setWeights({
                          ...weights,
                          [axis]: { ...weights[axis], [criterion.key]: event.target.value },
                        });
                      }}
                    />
                  )}
                </FormField>
              ))}
            <p className="text-right font-medium tabular-nums">
              {t.segmentModel.weightTotal(percent(totals[axis], locale))}
            </p>
          </div>
        </SettingsGroup>
      ))}
      <SaveActions saving={saving} onCancel={goBack} />
    </form>
  );
}

export function SegmentBoundariesPage() {
  const t = useT();
  const canManage = useCan('segmentmodell.verwalten');
  const query = useSegmentModel();
  const model = visibleModel(query.data, canManage);

  return (
    <EditorFrame title={t.segmentModel.boundaryTitle} purpose={t.segmentModel.boundariesHint}>
      <EditorState model={model} isError={query.isError} isLoading={!query.data}>
        {(current) => {
          if (!canManage) return <ReadOnlyNotice />;
          return (
            <BoundariesForm key={current.id} model={current} accessToken={query.accessToken} />
          );
        }}
      </EditorState>
    </EditorFrame>
  );
}

function BoundariesForm({ model, accessToken }: { model: SegmentModel; accessToken: string }) {
  const t = useT();
  const [lowMax, setLowMax] = useState(String(model.lowMax));
  const [midMax, setMidMax] = useState(String(model.midMax));
  const [deviation, setDeviation] = useState(String(model.deviationThreshold));
  const [focusShare, setFocusShare] = useState(String(model.focusSpendShare));
  const [invalid, setInvalid] = useState(false);
  const { save, saving, failure } = useSegmentSave();
  const goBack = useGoBack(modelPath);
  const request = {
    lowMax: lowMax === '' ? Number.NaN : Number(lowMax),
    midMax: midMax === '' ? Number.NaN : Number(midMax),
    deviationThreshold: deviation === '' ? Number.NaN : Number(deviation),
    focusSpendShare: focusShare === '' ? Number.NaN : Number(focusShare),
  };
  return (
    <form
      noValidate
      className="flex max-w-xl flex-col gap-6"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        const parsed = updateSegmentBoundariesSchema.safeParse(request);
        if (!parsed.success) {
          setInvalid(true);
          return;
        }
        setInvalid(false);
        void save(() => updateSegmentBoundaries(accessToken, parsed.data));
      }}
    >
      <SaveError failure={failure} />
      {invalid && (
        <p role="alert" className="text-destructive text-sm">
          {t.segmentModel.invalidBoundaries}
        </p>
      )}
      <FormField label={t.segmentModel.lowMax}>
        {(field) => (
          <Input
            {...field}
            type="number"
            min="0"
            max="99"
            step="1"
            value={lowMax}
            onChange={(event) => {
              setInvalid(false);
              setLowMax(event.target.value);
            }}
          />
        )}
      </FormField>
      <FormField
        label={t.segmentModel.midMax}
        hint={t.segmentModel.highFrom((request.midMax || model.midMax) + 1)}
      >
        {(field) => (
          <Input
            {...field}
            type="number"
            min="1"
            max="100"
            step="1"
            value={midMax}
            onChange={(event) => {
              setInvalid(false);
              setMidMax(event.target.value);
            }}
          />
        )}
      </FormField>
      <FormField label={t.segmentModel.deviationThreshold} hint={t.segmentModel.deviationHint}>
        {(field) => (
          <Input
            {...field}
            type="number"
            min="1"
            max="100"
            step="1"
            value={deviation}
            onChange={(event) => {
              setInvalid(false);
              setDeviation(event.target.value);
            }}
          />
        )}
      </FormField>
      <FormField label={t.segmentModel.focusSpendShare} hint={t.segmentModel.focusSpendShareHint}>
        {(field) => (
          <Input
            {...field}
            type="number"
            min="1"
            max="100"
            step="1"
            value={focusShare}
            onChange={(event) => {
              setInvalid(false);
              setFocusShare(event.target.value);
            }}
          />
        )}
      </FormField>
      <SaveActions saving={saving} onCancel={goBack} />
    </form>
  );
}

export function SegmentTypePage({ pair }: { pair: string }) {
  const t = useT();
  const canManage = useCan('segmentmodell.verwalten');
  const query = useSegmentModel();
  const model = visibleModel(query.data, canManage);
  const match = /^([1-3])-([1-3])$/.exec(pair);
  const impactLevel = match ? Number(match[1]) : 0;
  const qualityLevel = match ? Number(match[2]) : 0;
  const type = model?.types.find(
    (entry) => entry.impactLevel === impactLevel && entry.qualityLevel === qualityLevel,
  );
  const title = type ? t.segmentModel.editType(type.name) : t.segmentModel.typeTitle;

  return (
    <EditorFrame title={title} purpose={t.segmentModel.typeMatrix}>
      <EditorState model={model} isError={query.isError} isLoading={!query.data}>
        {(current) => {
          const currentType = current.types.find(
            (entry) => entry.impactLevel === impactLevel && entry.qualityLevel === qualityLevel,
          );
          if (!currentType) {
            return (
              <EmptyState title={t.segmentModel.notFound} description={t.notFound.description} />
            );
          }
          return (
            <TypeForm
              key={`${current.id}-${impactLevel}-${qualityLevel}`}
              type={currentType}
              accessToken={query.accessToken}
              canManage={canManage}
            />
          );
        }}
      </EditorState>
    </EditorFrame>
  );
}

function TypeForm({
  type,
  accessToken,
  canManage,
}: {
  type: SegmentType;
  accessToken: string;
  canManage: boolean;
}) {
  const t = useT();
  const [name, setName] = useState(type.name);
  const [description, setDescription] = useState(type.description);
  const [invalid, setInvalid] = useState(false);
  const { save, saving, failure } = useSegmentSave();
  const goBack = useGoBack(modelPath);
  if (!canManage) return <ReadOnlyNotice />;
  return (
    <form
      noValidate
      className="flex max-w-xl flex-col gap-6"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        const parsed = updateSegmentTypeSchema.safeParse({ name, description });
        if (!parsed.success) {
          setInvalid(true);
          return;
        }
        setInvalid(false);
        void save(() =>
          updateSegmentType(accessToken, type.impactLevel, type.qualityLevel, parsed.data),
        );
      }}
    >
      <SaveError failure={failure} />
      {invalid && (
        <p role="alert" className="text-destructive text-sm">
          {t.segmentModel.invalidText}
        </p>
      )}
      <FormField label={t.segmentModel.name}>
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
      <FormField label={t.segmentModel.description}>
        {(field) => (
          <Textarea
            {...field}
            name="description"
            value={description}
            maxLength={500}
            onChange={(event) => setDescription(event.target.value)}
          />
        )}
      </FormField>
      <SaveActions saving={saving} onCancel={goBack} />
    </form>
  );
}

function ReadOnlyNotice() {
  const t = useT();
  return (
    <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
      {t.segmentModel.readOnly}
    </p>
  );
}
