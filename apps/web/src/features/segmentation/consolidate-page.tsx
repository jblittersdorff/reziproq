import type { ConsolidateRequest, Segmentation } from '@reziproq/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { StatusLine } from '@/components/ui/status-line';
import { StepActions, StepProgress } from '@/components/ui/step-progress';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/features/auth/use-permissions';
import { errorBody, linkClass, useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { SupplierFrame } from '@/features/suppliers/supplier-frame';
import { InternalBadge } from '@/features/workspace/internal-badge';
import { consolidate } from '@/lib/api';
import { flash } from '@/lib/flash';
import { useT } from '@/lib/i18n';
import { useDecisions } from './use-decisions';
import { useSegmentation } from './use-segmentation';

type Data = NonNullable<Segmentation['segmentation']>;
type Levels = { impactLevel: number; qualityLevel: number };
type Choice = { ist: Levels; soll: Levels; reason: string };

export const segmentationPath = (relationshipId: string) =>
  `/lieferanten/${relationshipId}/strategie/segmentierung`;

const fallback: Levels = { impactLevel: 2, qualityLevel: 2 };
const levelsKey = (levels: Levels) => `${levels.impactLevel}-${levels.qualityLevel}`;
const parseLevels = (value: string): Levels => {
  const [impact, quality] = value.split('-').map(Number);
  return { impactLevel: impact ?? 2, qualityLevel: quality ?? 2 };
};
const pick = (outcome: Levels | null | undefined): Levels =>
  outcome ? { impactLevel: outcome.impactLevel, qualityLevel: outcome.qualityLevel } : fallback;

const groupId = (group: Data['groups'][number]) =>
  `${group.businessUnit.id}:${group.materialGroup?.id ?? ''}`;

/** Strategie › Segmentierung › Konsolidieren (SEG-06): je Gruppe Ist und Soll festlegen, am Ende gesamt. */
export function ConsolidatePage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = t.segmentation;
  const query = useSegmentation(relationshipId);
  const decisions = useDecisions(relationshipId);
  const data = query.data?.segmentation;
  const allowed = useCan('segmentierung.konsolidieren');

  return (
    <SupplierFrame
      relationshipId={relationshipId}
      area="strategy"
      trail={() => [{ label: text.title, href: segmentationPath(relationshipId) }]}
      current={text.consolidate.title}
    >
      {() => (
        <>
          <PageHeader
            title={text.consolidate.title}
            purpose={text.consolidate.purpose}
            badge={<InternalBadge />}
          />
          {query.isError || decisions.isError ? (
            <ErrorState title={text.failed} />
          ) : !query.data || !decisions.data ? (
            <LoadingState label={text.loading} />
          ) : !data ? (
            <EmptyState
              size="lg"
              title={text.emptyTitle}
              description={text.emptyDescription}
              action={routerLink({
                href: segmentationPath(relationshipId),
                className: linkClass,
                children: text.consolidate.back,
              })}
            />
          ) : !allowed || !decisions.data.canConsolidate ? (
            <EmptyState
              size="lg"
              title={text.consolidate.deniedTitle}
              description={text.consolidate.deniedDescription}
              action={routerLink({
                href: segmentationPath(relationshipId),
                className: linkClass,
                children: text.consolidate.back,
              })}
            />
          ) : (
            <Steps relationshipId={relationshipId} data={data} />
          )}
        </>
      )}
    </SupplierFrame>
  );
}

function Steps({ relationshipId, data }: { relationshipId: string; data: Data }) {
  const t = useT();
  const text = t.segmentation.consolidate;
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const groups = data.groups;
  const total = groups.length + 1;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, Choice>>(() => {
    const initial: Record<string, Choice> = {
      total: { ist: pick(data.overall.ist), soll: pick(data.overall.soll), reason: '' },
    };
    for (const group of groups) {
      initial[groupId(group)] = { ist: pick(group.ist), soll: pick(group.soll), reason: '' };
    }
    return initial;
  });

  const isTotal = step === total;
  const group = isTotal ? null : groups[step - 1];
  const id = group ? groupId(group) : 'total';
  const choice = choices[id] as Choice;
  const update = (patch: Partial<Choice>) =>
    setChoices({ ...choices, [id]: { ...choice, ...patch } });
  const complete = choice.reason.trim() !== '';

  const deviations = group
    ? data.rows
        .filter(
          (row) =>
            row.businessUnit.id === group.businessUnit.id &&
            (row.materialGroup?.id ?? null) === (group.materialGroup?.id ?? null),
        )
        .slice(0, 3)
    : data.rows.slice(0, 3);

  const submit = async () => {
    setSaving(true);
    setFailure(null);
    const request: ConsolidateRequest = {
      total: choices.total as Choice,
      entries: groups.map((entry) => ({
        businessUnitId: entry.businessUnit.id,
        materialGroupId: entry.materialGroup?.id ?? null,
        ...(choices[groupId(entry)] as Choice),
      })),
    };
    try {
      await consolidate(accessToken, relationshipId, request);
      await queryClient.invalidateQueries({ queryKey: ['ratings'] });
      await queryClient.invalidateQueries({ queryKey: ['suppliers', relationshipId] });
      await queryClient.invalidateQueries({ queryKey: ['start'] });
      flash.set(text.done);
      await navigate({ to: segmentationPath(relationshipId) });
    } catch (error) {
      const code = errorBody(error).code;
      setFailure(code === 'keine_bewertungen' ? text.noRatings : text.failed);
      setSaving(false);
    }
  };

  const label = isTotal
    ? text.total
    : [group?.businessUnit.name, group?.materialGroup?.name].filter(Boolean).join(' · ');
  const types = data.model.types;
  const typeSelect = (field: 'ist' | 'soll', title: string, hint: string) => (
    <FormField label={title} hint={hint}>
      {(props) => (
        <NativeSelect
          {...props}
          value={levelsKey(choice[field])}
          onChange={(event) => update({ [field]: parseLevels(event.target.value) })}
        >
          {types.map((type) => (
            <option key={levelsKey(type)} value={levelsKey(type)}>
              {type.name}
            </option>
          ))}
        </NativeSelect>
      )}
    </FormField>
  );

  return (
    <div className="flex flex-col gap-8">
      {failure && <StatusLine message={failure} tone="warning" />}
      <StepProgress current={step} total={total} label={text.step} stepTitle={label} />
      <section className="flex flex-col gap-2" aria-label={text.proposal}>
        <p className="text-sm">
          {text.proposalText(
            (group ? group.ist : data.overall.ist)?.typeName ?? '–',
            (group ? group.soll : data.overall.soll)?.typeName ?? '–',
          )}
        </p>
        {deviations.length > 0 && (
          <>
            <h4 className="text-muted-foreground text-sm">{text.deviations}</h4>
            <ul className="divide-y rounded-md border">
              {deviations.map((row) => (
                <li key={row.assignmentId} className="flex justify-between gap-4 p-3 text-sm">
                  <span className="min-w-0 break-words">
                    {t.roles.functions[row.function as 'quality']}
                  </span>
                  <span className="tabular-nums">{Math.round(row.deviation)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        {typeSelect('ist', text.ist, text.istHint)}
        {typeSelect('soll', text.soll, text.sollHint)}
      </div>
      <FormField label={text.reason} hint={text.reasonHint}>
        {(props) => (
          <Textarea
            {...props}
            value={choice.reason}
            maxLength={1000}
            onChange={(event) => update({ reason: event.target.value })}
          />
        )}
      </FormField>
      <StepActions
        back={
          step > 1 ? (
            <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
              {text.previous}
            </Button>
          ) : (
            routerLink({
              href: segmentationPath(relationshipId),
              className: linkClass,
              children: text.back,
            })
          )
        }
        next={
          isTotal ? (
            <Button type="button" loading={saving} disabled={!complete} onClick={submit}>
              {text.submit}
            </Button>
          ) : (
            <Button type="button" disabled={!complete} onClick={() => setStep(step + 1)}>
              {text.next}
            </Button>
          )
        }
      />
    </div>
  );
}
