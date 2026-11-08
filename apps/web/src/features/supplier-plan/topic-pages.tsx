import { strategicTopicRequestSchema, type StrategicTopic } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { CheckboxGroup, FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { useToken } from '@/features/ratings/use-rating';
import { useGoBack } from '@/features/shell/page-path';
import { PageHeader } from '@/features/shell/page-header';
import { SupplierFrame } from '@/features/suppliers/supplier-frame';
import { useSupplier } from '@/features/suppliers/use-supplier';
import {
  ApiError,
  createStrategicTopic,
  supplierPlanQueryOptions,
  updateStrategicTopic,
} from '@/lib/api';
import { flash } from '@/lib/flash';
import { useT } from '@/lib/i18n';

const planPath = (relationshipId: string) =>
  `/lieferanten/${relationshipId}/strategie/lieferantenplan`;

/** Strategisches Thema anlegen oder ändern (SPL-06). */
export function StrategicTopicPage({
  relationshipId,
  topicId,
}: {
  relationshipId: string;
  topicId?: string;
}) {
  const t = useT();
  const accessToken = useToken();
  const supplier = useSupplier(relationshipId);
  const planQuery = useQuery({
    ...supplierPlanQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });

  if (!supplier.data) return null;
  return (
    <SupplierFrame
      relationshipId={relationshipId}
      area="strategy"
      current={topicId ? t.supplierPlan.editTopic : t.supplierPlan.addTopic}
      header={
        <PageHeader
          title={topicId ? t.supplierPlan.editTopic : t.supplierPlan.addTopic}
          purpose={t.supplierPlan.topicPagePurpose}
        />
      }
      trail={() => [{ label: t.supplierPlan.title, href: planPath(relationshipId) }]}
    >
      {() => {
        if (planQuery.isError) return <ErrorState title={t.supplierPlan.failed} />;
        if (!planQuery.data) return <LoadingState label={t.supplierPlan.loading} />;
        const plan = planQuery.data.plan;
        if (!plan) {
          return (
            <EmptyState
              size="lg"
              title={t.supplierPlan.noPlanTitle}
              description={t.supplierPlan.noPlanHint}
            />
          );
        }
        const topic = topicId ? plan.topics.find((entry) => entry.id === topicId) : undefined;
        if (topicId && !topic) {
          return (
            <EmptyState
              size="lg"
              title={t.notFound.title}
              description={t.supplierPlan.topicNotFound}
            />
          );
        }
        if (!plan.canManage) {
          return (
            <p role="status" className="rounded-lg bg-muted px-4 py-3 text-muted-foreground">
              {t.supplierPlan.noPermission}
            </p>
          );
        }
        return (
          <TopicForm
            relationshipId={relationshipId}
            planId={plan.id}
            topic={topic}
            objectives={plan.objectives.map((objective) => ({
              value: objective.id,
              label: objective.text,
            }))}
          />
        );
      }}
    </SupplierFrame>
  );
}

function TopicForm({
  relationshipId,
  planId,
  topic,
  objectives,
}: {
  relationshipId: string;
  planId: string;
  topic: StrategicTopic | undefined;
  objectives: { value: string; label: string }[];
}) {
  const t = useT();
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const goBack = useGoBack(planPath(relationshipId));
  const [title, setTitle] = useState(topic?.title ?? '');
  const [reason, setReason] = useState(topic?.reason ?? '');
  const [objectiveIds, setObjectiveIds] = useState<string[]>(
    topic?.objectives.map((objective) => objective.id) ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const request = strategicTopicRequestSchema.safeParse({ title, reason, objectiveIds });
    if (!request.success) {
      setError(
        objectiveIds.length === 0
          ? t.supplierPlan.topicObjectivesRequired
          : t.supplierPlan.topicTitleRequired,
      );
      return;
    }
    setSaving(true);
    try {
      if (topic) {
        await updateStrategicTopic(accessToken, relationshipId, planId, topic.id, request.data);
      } else {
        await createStrategicTopic(accessToken, relationshipId, planId, request.data);
      }
      await queryClient.invalidateQueries({
        queryKey: ['suppliers', relationshipId, 'supplier-plan'],
      });
      flash.set(t.supplierPlan.saved);
      goBack();
    } catch (failure) {
      const code =
        failure instanceof ApiError
          ? (failure.body as { code?: string } | null)?.code
          : undefined;
      setError(
        code && code in t.supplierPlan.errors
          ? t.supplierPlan.errors[code as keyof typeof t.supplierPlan.errors]
          : t.supplierPlan.saveFailed,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {error && <StatusLine message={error} tone="warning" />}
      <form className="flex max-w-3xl flex-col gap-6" onSubmit={(event) => void save(event)}>
        <FormField label={t.supplierPlan.topicTitle}>
          {(field) => (
            <Input
              {...field}
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          )}
        </FormField>
        <FormField label={t.supplierPlan.topicReason}>
          {(field) => (
            <Textarea
              {...field}
              maxLength={2000}
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </FormField>
        {objectives.length === 0 ? (
          <p className="text-muted-foreground">{t.supplierPlan.topicObjectivesNone}</p>
        ) : (
          <CheckboxGroup
            legend={t.supplierPlan.topicObjectives}
            options={objectives}
            value={objectiveIds}
            onChange={setObjectiveIds}
          />
        )}
        <FormActions>
          <Button type="button" variant="outline" onClick={goBack}>
            {t.supplierPlan.cancel}
          </Button>
          <Button type="submit" loading={saving}>
            {t.supplierPlan.save}
          </Button>
        </FormActions>
      </form>
    </>
  );
}
