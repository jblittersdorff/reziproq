import {
  type LeverChoice,
  type StrategyAssessment,
  type StrategyContext,
  type StrategyStep,
  type SwotItem,
  type SwotType,
  swotTypes,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckIcon, PlusIcon, XIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { GuideQuestions } from '@/components/ui/guide-questions';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import {
  ApiError,
  addCustomLever,
  addSwotItem,
  assessmentQueryOptions,
  removeLeverChoice,
  removeSwotItem,
  saveLeverChoice,
  updateSwotItem,
} from '@/lib/api';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const originOptions = [
  '3:volume',
  '3:supply_chain',
  '3:cost',
  '3:technology',
  '4:revenue_finance',
  '4:quality',
  '4:footprint',
  '5:',
];

const codeOf = (error: unknown) =>
  error instanceof ApiError ? (error.body as { code?: string } | null)?.code : undefined;

function useAssessmentSave(strategyId: string) {
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const all = useT();
  const text = all.assessment;
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (work: (token: string) => Promise<StrategyAssessment | unknown>) => {
    setBusy(true);
    setFailure(null);
    try {
      const result = await work(accessToken);
      const key = assessmentQueryOptions(accessToken, strategyId).queryKey;
      if (result && typeof result === 'object' && 'items' in result) {
        queryClient.setQueryData(key, result as StrategyAssessment);
      } else {
        await queryClient.invalidateQueries({ queryKey: key });
      }
      await queryClient.invalidateQueries({ queryKey: ['warengruppen'] });
      return true;
    } catch (error) {
      const code = codeOf(error);
      setFailure(
        code === 'invalid_pairing'
          ? text.invalidPairing
          : code === 'lever_exists'
            ? text.leverExists
            : all.strategy.failedSave,
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { run, failure, busy };
}

/**
 * Schritt 6 Bewertung (WG-10, nach WG-Bewertung.dc.html): Hinweis „Kern der Strategie“, Profil in
 * vier Feldern mit Kürzeln und Herkunft, Tabelle der gewählten Hebel mit Paarung, Wirkung,
 * Begründung und Stand, Hebelkatalog; rechts Leitfragen und der Weg zurück zu den Zielen.
 */
export function AssessmentSection({
  groupId,
  context,
  content,
  editable,
}: {
  groupId: string;
  context: StrategyContext;
  content: StrategyStep;
  editable: boolean;
}) {
  const all = useT();
  const text = all.assessment;
  const accessToken = useToken();
  const strategyId = context.strategy.id;
  const query = useQuery({
    ...assessmentQueryOptions(accessToken, strategyId),
    enabled: accessToken !== '',
  });
  if (query.isError) return <ErrorState title={text.failed} />;
  if (!query.data) return <LoadingState label={text.loading} />;
  const data = query.data;
  const canEdit = data.canEdit && editable;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg bg-mint-soft px-5 py-4 text-sm">
        <strong className="font-semibold">{text.coreTitle}</strong> {text.coreText}
      </section>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {swotTypes.map((type) => (
              <SwotField
                key={type}
                type={type}
                items={data.items.filter((item) => item.type === type)}
                strategyId={strategyId}
                canEdit={canEdit}
              />
            ))}
          </div>
          <ChoicesSection data={data} strategyId={strategyId} canEdit={canEdit} />
          <CatalogSection data={data} strategyId={strategyId} canEdit={canEdit} />
        </div>
        <aside className="flex min-w-0 flex-col gap-4">
          {content.questions.length > 0 && (
            <GuideQuestions
              title={all.strategy.guide}
              questions={content.questions.map((question) => question.text)}
            />
          )}
          <section className="flex flex-col gap-2 rounded-lg bg-card p-5 shadow-card">
            <p className="text-muted-foreground text-sm">{text.toGoalsHint}</p>
            {routerLink({
              href: `/warengruppen/${groupId}/strategie/2`,
              className: buttonVariants({
                variant: 'secondary',
                size: 'sm',
                className: 'self-start',
              }),
              children: text.toGoals,
            })}
          </section>
        </aside>
      </div>
    </div>
  );
}

function SwotField({
  type,
  items,
  strategyId,
  canEdit,
}: {
  type: SwotType;
  items: SwotItem[];
  strategyId: string;
  canEdit: boolean;
}) {
  const text = useT().assessment;
  const save = useAssessmentSave(strategyId);
  const [value, setValue] = useState('');
  const [origin, setOrigin] = useState('');
  const [adding, setAdding] = useState(false);
  const headingId = `swot-${type}`;
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-lg bg-card p-5 shadow-card"
    >
      <div className="flex flex-col">
        <h2 id={headingId} className="font-semibold text-lg">
          {text.types[type]}
        </h2>
        <span className="text-chip text-muted-foreground">{text.typeHints[type]}</span>
      </div>
      {save.failure && <StatusLine message={save.failure} tone="warning" />}
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{text.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const originKey = item.originStep
              ? `${item.originStep}:${item.originView ?? ''}`
              : null;
            return (
              <li
                key={item.id}
                className={cn(
                  'flex items-start gap-3 rounded-md p-2 text-sm',
                  item.status === 'draft' && 'border-2 border-petrol border-dashed',
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-line-soft font-semibold text-chip">
                  {item.code}
                </span>
                <span className="flex min-w-0 grow flex-col">
                  <span>{item.text}</span>
                  <span className="text-chip text-muted-foreground">
                    {[
                      originKey && text.origins[originKey]
                        ? text.from(text.origins[originKey] ?? '')
                        : null,
                      item.status === 'draft' ? text.draft : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                {canEdit && (
                  <span className="flex shrink-0 gap-1">
                    {item.status === 'draft' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={`${text.confirm}: ${item.code}`}
                        onClick={() =>
                          void save.run((token) =>
                            updateSwotItem(token, strategyId, item.id, { confirm: true }),
                          )
                        }
                      >
                        <CheckIcon aria-hidden />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={text.remove(item.code)}
                      onClick={() =>
                        void save.run((token) => removeSwotItem(token, strategyId, item.id))
                      }
                    >
                      <XIcon aria-hidden />
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canEdit && !adding && (
        <Button
          size="sm"
          variant="secondary"
          className="self-start"
          onClick={() => setAdding(true)}
        >
          <PlusIcon aria-hidden />
          {text.newEntries[type]}
        </Button>
      )}
      {canEdit && adding && (
        <form
          aria-label={text.newEntries[type]}
          className="flex flex-col gap-2"
          onSubmit={async (event: FormEvent) => {
            event.preventDefault();
            if (!value.trim()) return;
            const [stepPart, view] = origin.split(':');
            const ok = await save.run((token) =>
              addSwotItem(token, strategyId, {
                type,
                text: value.trim(),
                originStep: stepPart ? Number(stepPart) : null,
                originView: view || null,
              }),
            );
            if (ok) {
              setValue('');
              setOrigin('');
              setAdding(false);
            }
          }}
        >
          <FormField label={text.newEntries[type]}>
            {(field) => (
              <Input
                {...field}
                value={value}
                maxLength={300}
                onChange={(event) => setValue(event.target.value)}
              />
            )}
          </FormField>
          <div className="flex flex-wrap items-end gap-2">
            <FormField label={text.origin} className="min-w-0 grow">
              {(field) => (
                <NativeSelect
                  {...field}
                  value={origin}
                  onChange={(event) => setOrigin(event.target.value)}
                >
                  <option value="">{text.originNone}</option>
                  {originOptions.map((key) => (
                    <option key={key} value={key}>
                      {text.origins[key]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <Button type="submit" variant="secondary" loading={save.busy}>
              {text.add}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              {text.cancel}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function ChoicesSection({
  data,
  strategyId,
  canEdit,
}: {
  data: StrategyAssessment;
  strategyId: string;
  canEdit: boolean;
}) {
  const text = useT().assessment;
  const save = useAssessmentSave(strategyId);
  const [editing, setEditing] = useState<LeverChoice | 'new' | null>(null);
  const code = (id: string) => data.items.find((item) => item.id === id)?.code ?? '?';
  const pairing = (choice: LeverChoice) =>
    `${code(choice.internalItemId)} · ${code(choice.externalItemId)}`;
  const dimensionName = (key: string) =>
    data.dimensions.find((entry) => entry.key === key)?.name ?? key;
  return (
    <section
      aria-labelledby="choices"
      className="flex flex-col gap-3 rounded-lg bg-card p-5 shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="choices" className="font-semibold text-lg">
          {text.choicesTitle}
        </h2>
        {canEdit && editing === null && (
          <Button size="sm" variant="secondary" onClick={() => setEditing('new')}>
            <PlusIcon aria-hidden />
            {text.addPairing}
          </Button>
        )}
      </div>
      {save.failure && <StatusLine message={save.failure} tone="warning" />}
      {editing !== null && (
        <ChoiceForm
          data={data}
          strategyId={strategyId}
          choice={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}
      {data.choices.length === 0 ? (
        <p className="text-muted-foreground text-sm">{text.choicesEmpty}</p>
      ) : (
        // Bewusste Abweichung von WG-Bewertung.dc.html: Zeilen statt Tabelle, weil die Tabelle in
        // der Hauptspalte neben den Leitfragen nicht auf die Breite passt (Stand und Aktionen fielen raus).
        <ul className="flex flex-col divide-y divide-line-soft">
          {data.choices.map((choice) => {
            const lever = data.levers.find((entry) => entry.id === choice.leverId);
            return (
              <li
                key={choice.id}
                aria-label={pairing(choice)}
                className={cn(
                  'flex flex-wrap items-start gap-x-4 gap-y-2 py-3 text-sm',
                  choice.status === 'dismissed' && 'text-muted-foreground',
                  // Vorschlag von Reziproq (KI-08): gestrichelt Petrol, wird geprüft oder verworfen
                  choice.status === 'proposed' &&
                    'my-1 rounded-md border-2 border-petrol border-dashed px-3',
                )}
              >
                {choice.status === 'proposed' && (
                  <span className="basis-full font-semibold text-petrol-dark text-chip">
                    {text.proposalHeading}
                  </span>
                )}
                <span className="flex size-auto min-w-16 shrink-0 font-semibold">
                  {pairing(choice)}
                </span>
                <span className="flex min-w-0 grow basis-64 flex-col gap-1">
                  <strong className="font-semibold">{lever?.name ?? '–'}</strong>
                  <span className="text-chip text-muted-foreground">
                    {text.effect}: {lever?.dimensions.map(dimensionName).join(', ')}
                  </span>
                  <span>{choice.reason || '–'}</span>
                </span>
                <span className="flex shrink-0 flex-wrap items-center gap-1">
                  {choice.status !== 'proposed' && (
                    <span className="font-semibold">{text.statuses[choice.status]}</span>
                  )}
                  {canEdit && choice.status === 'proposed' && (
                    <>
                      <Button
                        size="sm"
                        aria-label={text.reviewProposal(pairing(choice))}
                        onClick={() => setEditing(choice)}
                      >
                        {text.reviewShort}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={text.dismissProposal(pairing(choice))}
                        onClick={() =>
                          void save.run((token) =>
                            saveLeverChoice(
                              token,
                              strategyId,
                              {
                                internalItemId: choice.internalItemId,
                                externalItemId: choice.externalItemId,
                                leverId: choice.leverId,
                                reason: choice.reason,
                                status: 'dismissed',
                              },
                              choice.id,
                            ),
                          )
                        }
                      >
                        {text.dismissShort}
                      </Button>
                    </>
                  )}
                  {canEdit && choice.status !== 'proposed' && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={text.edit(pairing(choice))}
                        onClick={() => setEditing(choice)}
                      >
                        {text.editShort}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={text.removeChoice(pairing(choice))}
                        onClick={() =>
                          void save.run((token) => removeLeverChoice(token, strategyId, choice.id))
                        }
                      >
                        <XIcon aria-hidden />
                      </Button>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-chip text-muted-foreground">{text.pairingHint}</p>
    </section>
  );
}

function ChoiceForm({
  data,
  strategyId,
  choice,
  onDone,
}: {
  data: StrategyAssessment;
  strategyId: string;
  choice: LeverChoice | null;
  onDone: () => void;
}) {
  const text = useT().assessment;
  const save = useAssessmentSave(strategyId);
  const [internal, setInternal] = useState(choice?.internalItemId ?? '');
  const [external, setExternal] = useState(choice?.externalItemId ?? '');
  const [lever, setLever] = useState(choice?.leverId ?? '');
  const [reason, setReason] = useState(choice?.reason ?? '');
  const [status, setStatus] = useState<LeverChoice['status']>(
    choice?.status === 'proposed' ? 'chosen' : (choice?.status ?? 'chosen'),
  );
  const [missing, setMissing] = useState(false);
  const options = (types: SwotType[]) =>
    data.items
      .filter((item) => types.includes(item.type))
      .map((item) => (
        <option key={item.id} value={item.id}>
          {item.code} · {item.text}
        </option>
      ));
  const select = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    children: React.ReactNode,
  ) => (
    <FormField label={label}>
      {(field) => (
        <NativeSelect
          {...field}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{text.choose}</option>
          {children}
        </NativeSelect>
      )}
    </FormField>
  );
  return (
    <form
      aria-label={choice ? text.edit(text.pairing) : text.addPairing}
      className="flex flex-col gap-3 rounded-md bg-paper p-4"
      onSubmit={async (event: FormEvent) => {
        event.preventDefault();
        if (status === 'chosen' && !reason.trim()) {
          setMissing(true);
          return;
        }
        const ok = await save.run((token) =>
          saveLeverChoice(
            token,
            strategyId,
            {
              internalItemId: internal,
              externalItemId: external,
              leverId: lever,
              reason: reason.trim(),
              status,
            },
            choice?.id,
          ),
        );
        if (ok) onDone();
      }}
    >
      {save.failure && <StatusLine message={save.failure} tone="warning" />}
      <div className="grid gap-3 sm:grid-cols-2">
        {select(text.internal, internal, setInternal, options(['strength', 'weakness']))}
        {select(text.external, external, setExternal, options(['opportunity', 'threat']))}
      </div>
      {select(
        text.lever,
        lever,
        setLever,
        data.levers
          .filter((entry) => entry.active || entry.id === choice?.leverId)
          .map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          )),
      )}
      <FormField
        label={text.reason}
        error={missing && !reason.trim() ? text.reasonRequired : undefined}
      >
        {(field) => (
          <Textarea
            {...field}
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        )}
      </FormField>
      <FormField label={text.stateLabel} className="max-w-xs">
        {(field) => (
          <NativeSelect
            {...field}
            value={status}
            onChange={(event) => setStatus(event.target.value as LeverChoice['status'])}
          >
            {(['chosen', 'proposed', 'dismissed'] as const).map((value) => (
              <option key={value} value={value}>
                {text.statuses[value]}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormActions>
        <Button type="submit" loading={save.busy}>
          {text.save}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {text.cancel}
        </Button>
      </FormActions>
    </form>
  );
}

function CatalogSection({
  data,
  strategyId,
  canEdit,
}: {
  data: StrategyAssessment;
  strategyId: string;
  canEdit: boolean;
}) {
  const text = useT().assessment;
  const save = useAssessmentSave(strategyId);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    reason: '',
    dimensions: [] as string[],
  });
  const chosen = new Set(
    data.choices.filter((choice) => choice.status === 'chosen').map((choice) => choice.leverId),
  );
  const proposed = new Set(
    data.choices.filter((choice) => choice.status === 'proposed').map((choice) => choice.leverId),
  );
  const active = data.levers.filter((entry) => entry.active);
  return (
    <section
      aria-labelledby="catalog"
      className="flex flex-col gap-3 rounded-lg bg-card p-5 shadow-card"
    >
      <div className="flex flex-col gap-1">
        <h2 id="catalog" className="font-semibold text-lg">
          {text.catalogTitle(active.length)}
        </h2>
        <p className="text-muted-foreground text-sm">{text.catalogHint}</p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {active.map((entry) => (
          <li key={entry.id}>
            <Badge
              variant={
                chosen.has(entry.id) ? 'success' : proposed.has(entry.id) ? 'selected' : 'neutral'
              }
              title={entry.description}
            >
              {chosen.has(entry.id) && <CheckIcon aria-hidden />}
              {entry.name}
              {chosen.has(entry.id) && <span className="sr-only"> ({text.chosenMark})</span>}
              {!chosen.has(entry.id) && proposed.has(entry.id) && ` · ${text.proposedMark}`}
              {entry.custom && ` · ${text.custom}`}
            </Badge>
          </li>
        ))}
      </ul>
      {save.failure && <StatusLine message={save.failure} tone="warning" />}
      {canEdit &&
        (open ? (
          <form
            aria-label={text.addLever}
            className="flex flex-col gap-3 rounded-md bg-paper p-4"
            onSubmit={async (event: FormEvent) => {
              event.preventDefault();
              const ok = await save.run((token) =>
                addCustomLever(token, {
                  name: draft.name,
                  description: draft.description,
                  reason: draft.reason,
                  dimensions: draft.dimensions as (
                    | 'supply'
                    | 'quality'
                    | 'cost'
                    | 'technology'
                    | 'sustainability'
                  )[],
                }),
              );
              if (ok) {
                setOpen(false);
                setDraft({ name: '', description: '', reason: '', dimensions: [] });
              }
            }}
          >
            <FormField label={text.leverName}>
              {(field) => (
                <Input
                  {...field}
                  required
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                />
              )}
            </FormField>
            <FormField label={text.leverDescription}>
              {(field) => (
                <Input
                  {...field}
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, description: event.target.value }))
                  }
                />
              )}
            </FormField>
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 font-semibold text-sm">{text.leverDimensions}</legend>
              <div className="flex flex-wrap gap-x-4">
                {data.dimensions.map((dimension) => (
                  <label key={dimension.key} className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-5 accent-petrol"
                      checked={draft.dimensions.includes(dimension.key)}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          dimensions: event.target.checked
                            ? [...current.dimensions, dimension.key]
                            : current.dimensions.filter((key) => key !== dimension.key),
                        }))
                      }
                    />
                    {dimension.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <FormField label={text.leverReason}>
              {(field) => (
                <Textarea
                  {...field}
                  required
                  rows={2}
                  value={draft.reason}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, reason: event.target.value }))
                  }
                />
              )}
            </FormField>
            <FormActions>
              <Button type="submit" loading={save.busy} disabled={draft.dimensions.length === 0}>
                {text.save}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {text.cancel}
              </Button>
            </FormActions>
          </form>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            className="self-start"
            onClick={() => setOpen(true)}
          >
            <PlusIcon aria-hidden />
            {text.addLever}
          </Button>
        ))}
    </section>
  );
}
