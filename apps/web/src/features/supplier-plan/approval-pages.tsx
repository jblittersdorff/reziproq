import type { PlanVersion, SupplierPlan } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { useToken } from '@/features/ratings/use-rating';
import { PageHeader } from '@/features/shell/page-header';
import { formatDate } from '@/features/start/start-page';
import { SupplierFrame } from '@/features/suppliers/supplier-frame';
import { decideSupplierPlan, planVersionsQueryOptions, supplierPlanQueryOptions } from '@/lib/api';
import { useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// SPL-07: Freigabe-Seite und Vergleich der Versionen des Lieferantenplans, beide käuferintern.

const planTrail = (t: ReturnType<typeof useT>, relationshipId: string) => () => [
  { label: t.supplierPlan.title, href: `/lieferanten/${relationshipId}/strategie/lieferantenplan` },
];

/** Freigabe-Seite: Plan in Leseansicht, Entscheidungen, Freigeben oder Zurückgeben mit Begründung. */
export function PlanApprovalPage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = t.supplierPlan.approvalFlow;
  return (
    <SupplierFrame
      relationshipId={relationshipId}
      area="strategy"
      trail={planTrail(t, relationshipId)}
      current={text.title}
      header={<PageHeader title={text.title} purpose={text.purpose} />}
    >
      {() => <ApprovalContent relationshipId={relationshipId} />}
    </SupplierFrame>
  );
}

function ApprovalContent({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = t.supplierPlan.approvalFlow;
  const { locale } = useLocale();
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const query = useQuery({
    ...supplierPlanQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (query.isError) return <ErrorState title={t.supplierPlan.failed} />;
  if (!query.data) return <LoadingState label={t.supplierPlan.loading} />;
  const plan = query.data.plan;
  if (!plan) return <ErrorState title={t.supplierPlan.noPlanTitle} />;
  const date = (iso: string) => formatDate(locale, iso.slice(0, 10));

  const decide = async (decision: 'approved' | 'returned', comment: string | null) => {
    setSaving(true);
    try {
      await decideSupplierPlan(accessToken, relationshipId, plan.id, { decision, comment });
      setMessage(text.decided);
      setReturning(false);
      await queryClient.invalidateQueries({
        queryKey: ['suppliers', relationshipId, 'supplier-plan'],
      });
    } catch {
      setError(text.failed);
    } finally {
      setSaving(false);
    }
  };
  const submitReturn = (event: FormEvent) => {
    event.preventDefault();
    if (reason.trim() === '') {
      setError(text.required);
      return;
    }
    setError(null);
    void decide('returned', reason.trim());
  };

  return (
    <>
      {message && <StatusLine message={message} onHidden={() => setMessage(null)} />}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={plan.status === 'approved' ? 'success' : 'neutral'}>
          {t.supplierPlan.status[plan.status]}
        </Badge>
        <span className="text-muted-foreground text-sm">
          {t.supplierPlan.version(plan.version)}
        </span>
        {plan.approval.approvedAt && (
          <span className="font-semibold text-sm">
            {text.approvedAt(date(plan.approval.approvedAt))}
          </span>
        )}
      </div>
      {!plan.approval.hasSponsor && plan.status === 'in_review' && (
        <p className="text-muted-foreground">{text.noSponsor}</p>
      )}

      {plan.status !== 'in_review' ? (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {text.notInReview}
        </p>
      ) : !plan.approval.canDecide ? (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {text.cannotDecide}
        </p>
      ) : returning ? (
        <form noValidate onSubmit={submitReturn} className="flex max-w-2xl flex-col gap-4">
          <FormField label={text.returnReason} hint={text.returnHint} error={error ?? undefined}>
            {(field) => (
              <Textarea
                {...field}
                rows={4}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            )}
          </FormField>
          <FormActions>
            <Button type="button" variant="secondary" onClick={() => setReturning(false)}>
              {t.supplierPlan.cancel}
            </Button>
            <Button type="submit" variant="destructive" loading={saving}>
              {text.returnConfirm}
            </Button>
          </FormActions>
        </form>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button loading={saving} onClick={() => void decide('approved', null)}>
            {text.approve}
          </Button>
          <Button variant="outline" onClick={() => setReturning(true)}>
            {text.return}
          </Button>
          {error && <p className="text-destructive">{error}</p>}
        </div>
      )}

      <PlanReadView plan={plan} />

      {plan.approval.decisions.length > 0 && (
        <section aria-labelledby="plan-entscheidungen" className="flex flex-col gap-3">
          <h2 id="plan-entscheidungen" className="font-display font-semibold text-section tracking-section">
            {text.decisions}
          </h2>
          <ul className="overflow-hidden rounded-lg bg-card shadow-card">
            {plan.approval.decisions.map((entry) => (
              <li
                key={`${entry.round}-${entry.userName}`}
                className="flex flex-col gap-1 border-line-soft border-b px-5 py-3 last:border-b-0"
              >
                <span>
                  <span className="font-semibold">{entry.userName}</span> ({text.roles[entry.role]}){' '}
                  {text.outcome[entry.decision]} · {text.round(entry.round)} ·{' '}
                  {date(entry.decidedAt)}
                </span>
                {entry.comment && <span className="text-muted-foreground">{entry.comment}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Leseansicht des Plans: Zusammenfassung, Themen, Ziele. */
function PlanReadView({ plan }: { plan: SupplierPlan }) {
  const t = useT();
  return (
    <section
      aria-label={t.supplierPlan.title}
      className="flex flex-col gap-4 rounded-lg bg-card shadow-card p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-display font-semibold text-lg tracking-title">{t.supplierPlan.summary}</h2>
        <p className="whitespace-pre-wrap text-muted-foreground">
          {plan.summary || t.supplierPlan.summaryEmpty}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="font-display font-semibold text-lg tracking-title">{t.supplierPlan.versions.topics}</h2>
        <ol className="list-decimal pl-5">
          {plan.topics.map((topic) => (
            <li key={topic.id}>
              <span className="font-medium">{topic.title}</span>
              <span className="text-muted-foreground"> · {topic.reason}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="font-display font-semibold text-lg tracking-title">{t.supplierPlan.versions.objectives}</h2>
        <ul className="flex flex-col gap-1">
          {plan.objectives.map((objective) => (
            <li key={objective.id}>
              <span className="font-medium">{objective.categoryName}</span>
              <span className="text-muted-foreground">
                {' '}
                · {objective.businessUnit?.name ?? objective.materialGroup?.name} · {objective.text}{' '}
                · {objective.targetYear}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Versionen: Liste und Vergleich zweier Versionen je Abschnitt. */
export function PlanVersionsPage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = t.supplierPlan.versions;
  return (
    <SupplierFrame
      relationshipId={relationshipId}
      area="strategy"
      trail={planTrail(t, relationshipId)}
      current={text.title}
      header={<PageHeader title={text.title} purpose={text.purpose} />}
    >
      {() => <VersionsContent relationshipId={relationshipId} />}
    </SupplierFrame>
  );
}

const objectiveKey = (entry: PlanVersion['objectives'][number]) =>
  `${entry.categoryName} · ${entry.reference ?? ''} · ${entry.text} · ${entry.targetYear}`;

/** Vergleich je Abschnitt: was neu ist, was entfällt, was sich geändert hat. */
export function compareVersions(from: PlanVersion, to: PlanVersion) {
  const fromObjectives = new Set(from.objectives.map(objectiveKey));
  const toObjectives = new Set(to.objectives.map(objectiveKey));
  const fromTopics = new Map(from.topics.map((topic) => [topic.title, topic]));
  const toTopics = new Map(to.topics.map((topic) => [topic.title, topic]));
  return {
    summary: from.summary === to.summary ? null : { from: from.summary, to: to.summary },
    objectives: {
      added: [...toObjectives].filter((key) => !fromObjectives.has(key)),
      removed: [...fromObjectives].filter((key) => !toObjectives.has(key)),
    },
    topics: {
      added: [...toTopics.keys()].filter((title) => !fromTopics.has(title)),
      removed: [...fromTopics.keys()].filter((title) => !toTopics.has(title)),
      changed: [...toTopics.values()]
        .filter((topic) => {
          const before = fromTopics.get(topic.title);
          return before && (before.reason !== topic.reason || before.priority !== topic.priority);
        })
        .map((topic) => topic.title),
    },
  };
}

function VersionsContent({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = t.supplierPlan.versions;
  const accessToken = useToken();
  const query = useQuery({
    ...planVersionsQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  if (query.isError) return <ErrorState title={t.supplierPlan.failed} />;
  if (!query.data) return <LoadingState label={t.supplierPlan.loading} />;
  const { versions } = query.data;
  if (versions.length === 0) return <p className="text-muted-foreground">{text.empty}</p>;
  const label = (version: PlanVersion) =>
    text.label(version.version, t.supplierPlan.status[version.status]);
  const to = versions.find((entry) => entry.id === toId) ?? versions[0];
  const from = versions.find((entry) => entry.id === fromId) ?? versions[1] ?? versions[0];
  const diff = from && to ? compareVersions(from, to) : null;

  return (
    <>
      <ul aria-label={text.title} className="overflow-hidden rounded-lg bg-card shadow-card">
        {versions.map((version) => (
          <li key={version.id} className="border-line-soft border-b px-5 py-3 last:border-b-0">
            {label(version)}
          </li>
        ))}
      </ul>
      {versions.length > 1 && from && to && diff && (
        <section aria-labelledby="plan-vergleich" className="flex flex-col gap-4">
          <h2 id="plan-vergleich" className="font-display font-semibold text-section tracking-section">
            {text.compare}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={text.from}>
              {(field) => (
                <NativeSelect
                  {...field}
                  value={from.id}
                  onChange={(event) => setFromId(event.target.value)}
                >
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {label(version)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField label={text.to}>
              {(field) => (
                <NativeSelect
                  {...field}
                  value={to.id}
                  onChange={(event) => setToId(event.target.value)}
                >
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {label(version)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          </div>
          <DiffSection title={text.summary} empty={diff.summary === null}>
            {diff.summary && (
              <div className="grid gap-3 sm:grid-cols-2">
                <p className="whitespace-pre-wrap rounded-lg bg-destructive-soft px-3 py-2 text-destructive-soft-foreground">
                  {diff.summary.from || '–'}
                </p>
                <p className="whitespace-pre-wrap rounded-lg bg-success-soft px-3 py-2 text-success-soft-foreground">
                  {diff.summary.to || '–'}
                </p>
              </div>
            )}
          </DiffSection>
          <DiffSection
            title={text.objectives}
            empty={diff.objectives.added.length + diff.objectives.removed.length === 0}
          >
            <DiffList added={diff.objectives.added} removed={diff.objectives.removed} />
          </DiffSection>
          <DiffSection
            title={text.topics}
            empty={
              diff.topics.added.length + diff.topics.removed.length + diff.topics.changed.length ===
              0
            }
          >
            <DiffList
              added={diff.topics.added}
              removed={diff.topics.removed}
              changed={diff.topics.changed}
            />
          </DiffSection>
        </section>
      )}
    </>
  );
}

function DiffSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  const text = useT().supplierPlan.versions;
  return (
    <section
      aria-label={title}
      data-changed={!empty}
      className="flex flex-col gap-2 rounded-lg bg-card shadow-card p-5"
    >
      <h3 className="font-display font-semibold text-lg tracking-title">{title}</h3>
      {empty ? <p className="text-muted-foreground">{text.unchanged}</p> : children}
    </section>
  );
}

function DiffList({
  added,
  removed,
  changed = [],
}: {
  added: string[];
  removed: string[];
  changed?: string[];
}) {
  const text = useT().supplierPlan.versions;
  const rows: [string, string, string][] = [
    ...added.map((entry): [string, string, string] => [text.added, entry, 'success']),
    ...removed.map((entry): [string, string, string] => [text.removed, entry, 'danger']),
    ...changed.map((entry): [string, string, string] => [text.changed, entry, 'warning']),
  ];
  return (
    <ul className="flex flex-col gap-2">
      {rows.map(([label, entry, tone]) => (
        <li key={`${label}-${entry}`} className="flex flex-wrap items-center gap-2">
          <Badge variant={tone as 'success' | 'danger' | 'warning'}>{label}</Badge>
          <span className={cn(tone === 'danger' && 'line-through')}>{entry}</span>
        </li>
      ))}
    </ul>
  );
}
