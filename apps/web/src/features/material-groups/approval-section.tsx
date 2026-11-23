import {
  type ApprovalView,
  defaultObjectiveCategories,
  goalDimensions,
  relevanceCriteria,
  relevanceKeys,
  type StrategyContext,
  type SummaryPart,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { NextStep, NextStepArrow } from '@/components/ui/next-step';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { useToken } from '@/features/ratings/use-rating';
import {
  approvalViewQueryOptions,
  confirmStrategySummary,
  newStrategyVersion,
  overrideRelevance,
  returnApproval,
  saveRelevance,
  saveStrategySummary,
  signApproval,
  submitStrategy,
  supplierMapQueryOptions,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { SupplierMapMatrix } from './supplier-map-section';

const parts: SummaryPart[] = ['statusQuo', 'targetState', 'roadmap'];
const card = 'flex flex-col gap-3 rounded-lg bg-card p-5 shadow-card';

/**
 * WG-16 Schritt 10 (nach Vorlage WG-Freigabe.neu.dc.html): nächster Schritt mit „Zur Freigabe
 * vorlegen“, Zusammenfassung in drei Teilen mit „geändert“ seit der letzten Vorlage, Relevanz und
 * Freigabeweg, Lieferantenbasis heute und im Zieljahr, Unterschriften, Versionen und wofür die
 * Strategie danach gilt. Bewusste Abweichung: Ist und Soll in einer Matrix (wie Supplier Map).
 */
export function ApprovalSection({
  groupId,
  context,
  dimensions,
  editable,
}: {
  groupId: string;
  context: StrategyContext;
  dimensions: { key: string; name: string }[];
  editable: boolean;
}) {
  const text = useT().strategyApproval;
  const format = useFormat();
  const accessToken = useToken();
  const client = useQueryClient();
  const navigate = useNavigate();
  const strategyId = context.strategy.id;
  const options = approvalViewQueryOptions(accessToken, strategyId);
  const query = useQuery({ ...options, enabled: accessToken !== '' });
  const map = useQuery({
    ...supplierMapQueryOptions(accessToken, strategyId),
    enabled: accessToken !== '',
  });
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  if (query.isError) return <ErrorState title={text.failed} />;
  const data = query.data;
  if (!data) return <LoadingState label={text.loading} />;
  const canEdit = data.canEdit && editable;

  const run = async (work: (token: string) => Promise<ApprovalView>) => {
    setMessage(null);
    setFailure(null);
    try {
      client.setQueryData(options.queryKey, await work(accessToken));
      void client.invalidateQueries({ queryKey: ['warengruppen', groupId] });
      setMessage(text.saved);
      return true;
    } catch (error) {
      const code = (error as { body?: { code?: string } }).body?.code;
      setFailure((code && text.errors[code]) || text.saveFailed);
      return false;
    }
  };
  const createVersion = async () => {
    setFailure(null);
    try {
      await newStrategyVersion(accessToken, strategyId);
      await client.invalidateQueries({ queryKey: ['warengruppen'] });
      await navigate({
        to: '/warengruppen/$id/strategie/$step',
        params: { id: groupId, step: '1' },
      });
    } catch (error) {
      const code = (error as { body?: { code?: string } }).body?.code;
      setFailure((code && text.errors[code]) || text.saveFailed);
    }
  };
  const missing = data.blockers.filter((blocker) => blocker !== 'approved');
  const leadMayAct = !data.blockers.includes('not_lead') && data.status !== 'approved';

  return (
    <section aria-label={text.approvalTitle} className="flex flex-col gap-5">
      {leadMayAct && data.route && (
        <NextStep
          nested
          headingAs="h2"
          eyebrow={text.nextEyebrow}
          title={text.nextSubmit(text.routes[data.route] ?? '')}
          text={
            data.canSubmit
              ? text.nextReady
              : text.nextMissing(missing.map((blocker) => text.blockers[blocker]).join(', '))
          }
          action={
            data.canSubmit ? (
              <Button
                variant="mint"
                size="hero"
                onClick={() => void run((token) => submitStrategy(token, strategyId))}
              >
                {text.submit}
                <NextStepArrow />
              </Button>
            ) : undefined
          }
        />
      )}
      {leadMayAct && !data.route && (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-sm shadow-card">
          {text.nextMissing(missing.map((blocker) => text.blockers[blocker]).join(', '))}
        </p>
      )}
      {data.openSteps.length > 0 && data.status !== 'approved' && (
        <p className="text-muted-foreground text-sm">{text.openSteps(data.openSteps.join(', '))}</p>
      )}
      {message && <StatusLine message={message} onHidden={() => setMessage(null)} />}
      {failure && <StatusLine message={failure} tone="warning" />}
      <SummaryCard
        data={data}
        canEdit={canEdit}
        onSave={(input) => run((token) => saveStrategySummary(token, strategyId, input))}
        onConfirm={() => run((token) => confirmStrategySummary(token, strategyId))}
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <RelevanceCard
          data={data}
          dimensions={dimensions}
          canEdit={canEdit}
          onSave={(scores) => run((token) => saveRelevance(token, strategyId, scores))}
          onOverride={(input) => run((token) => overrideRelevance(token, strategyId, input))}
        />
        <section aria-labelledby="wg-approval-signatures" className={card}>
          <h2 id="wg-approval-signatures" className="font-semibold text-lg">
            {text.approvalTitle}
          </h2>
          <ol
            aria-label={text.stateCurrent(text.states[data.status] ?? '')}
            className="flex flex-wrap gap-2"
          >
            {(['draft', 'resubmit', 'approved'] as const).map((state) => (
              <li key={state}>
                <Badge variant={state === data.status ? 'ink' : 'neutral'}>
                  {text.states[state]}
                  {state === data.status && <span className="sr-only"> ✓</span>}
                </Badge>
              </li>
            ))}
          </ol>
          {data.approvals.length === 0 ? (
            <p className="text-muted-foreground text-sm">{text.noApprovals}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line-soft">
              {data.approvals.map((approval) => (
                <SignatureRow
                  key={approval.id}
                  approval={approval}
                  onSign={() => run((token) => signApproval(token, approval.id))}
                  onReturn={(comment) =>
                    run((token) => returnApproval(token, approval.id, comment))
                  }
                />
              ))}
            </ul>
          )}
          {data.lastSubmittedAt && (
            <p className="text-muted-foreground text-sm">
              {text.lastSubmitted(format.date(data.lastSubmittedAt), data.changedSinceSubmission)}{' '}
              {text.yearly}
            </p>
          )}
        </section>
      </div>
      {map.data && !map.data.restricted && (
        <section aria-labelledby="wg-approval-base" className="flex flex-col gap-2">
          <h2 id="wg-approval-base" className="font-semibold text-lg">
            {text.baseTitle}
          </h2>
          <SupplierMapMatrix data={map.data} groupId={groupId} />
        </section>
      )}
      <section aria-labelledby="wg-approval-versions" className={card}>
        <h2 id="wg-approval-versions" className="font-semibold text-lg">
          {text.versionsTitle}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {data.versions.map((entry) => (
            <li key={entry.id}>
              <Badge variant={entry.id === data.strategyId ? 'ink' : 'neutral'}>
                {text.version(entry.version, text.states[entry.status] ?? '')}
              </Badge>
            </li>
          ))}
        </ul>
        {data.canNewVersion && (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm">{text.newVersionHint}</p>
            <Button variant="secondary" className="self-start" onClick={() => void createVersion()}>
              {text.newVersion}
            </Button>
          </div>
        )}
      </section>
      <section aria-labelledby="wg-approval-applies" className={card}>
        <h2 id="wg-approval-applies" className="font-semibold text-lg">
          {text.appliesTitle}
        </h2>
        <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {text.applies.map(([title, body], index) => (
            <li key={title} className="flex gap-3">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-petrol font-display font-semibold text-petrol-dark text-sm"
              >
                {index + 1}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <strong className="font-semibold">{title}</strong>
                <span className="text-muted-foreground text-sm">{body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}

function SummaryCard({
  data,
  canEdit,
  onSave,
  onConfirm,
}: {
  data: ApprovalView;
  canEdit: boolean;
  onSave: (input: Record<SummaryPart, string>) => Promise<boolean>;
  onConfirm: () => Promise<boolean>;
}) {
  const text = useT().strategyApproval;
  const format = useFormat();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<SummaryPart, string>>({
    statusQuo: data.summary.statusQuo,
    targetState: data.summary.targetState,
    roadmap: data.summary.roadmap,
  });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await onSave(draft)) setEditing(false);
  };
  return (
    <section aria-labelledby="wg-approval-summary" className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="wg-approval-summary" className="font-semibold text-lg">
          {text.summaryTitle}
        </h2>
        <Badge variant={data.summary.status === 'confirmed' ? 'success' : 'neutral'}>
          {data.summary.status === 'confirmed' ? text.summaryConfirmed : text.summaryDraft}
        </Badge>
      </div>
      <p className="text-muted-foreground text-sm">{text.summaryHint}</p>
      {editing ? (
        <form className="flex flex-col gap-3" onSubmit={submit}>
          {parts.map((part) => (
            <FormField key={part} label={text[part]}>
              {(field) => (
                <Textarea
                  {...field}
                  rows={3}
                  maxLength={4000}
                  value={draft[part]}
                  onChange={(event) => setDraft({ ...draft, [part]: event.target.value })}
                />
              )}
            </FormField>
          ))}
          <FormActions>
            <Button type="submit">{text.summarySave}</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              {text.cancel}
            </Button>
          </FormActions>
        </form>
      ) : (
        <>
          <dl className="grid gap-4 md:grid-cols-3">
            {parts.map((part) => (
              <div key={part} className="flex flex-col gap-1">
                <dt className="flex flex-wrap items-center gap-2 font-semibold">
                  {text[part]}
                  {data.summary.changed.includes(part) && (
                    <Badge variant="shared">{text.changed}</Badge>
                  )}
                </dt>
                <dd className="whitespace-pre-line text-sm">{data.summary[part] || '–'}</dd>
              </div>
            ))}
          </dl>
          {data.summary.changed.length > 0 && data.lastSubmittedAt && (
            <p className="text-muted-foreground text-sm">
              {text.changedLegend(format.date(data.lastSubmittedAt))}
            </p>
          )}
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              {data.summary.status !== 'confirmed' && (
                <Button onClick={() => void onConfirm()}>{text.summaryConfirm}</Button>
              )}
              <Button variant="secondary" onClick={() => setEditing(true)}>
                {text.summaryEdit}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function RelevanceCard({
  data,
  dimensions,
  canEdit,
  onSave,
  onOverride,
}: {
  data: ApprovalView;
  dimensions: { key: string; name: string }[];
  canEdit: boolean;
  onSave: (scores: Record<string, number>) => Promise<boolean>;
  onOverride: (input: { override: 'high' | 'low' | null; reason: string }) => Promise<boolean>;
}) {
  const text = useT().strategyApproval;
  const format = useFormat();
  const [scores, setScores] = useState<Record<string, number>>(data.relevance.scores);
  const [override, setOverride] = useState<'' | 'high' | 'low'>(data.relevance.override ?? '');
  const [reason, setReason] = useState(data.relevance.overrideReason ?? '');
  // Namen der Organisation; ohne sie die Startnamen der Dimensionen
  const nameOf = (key: string) =>
    dimensions.find((entry) => entry.key === key)?.name ??
    defaultObjectiveCategories.find((entry) => entry.key === key)?.name ??
    key;
  const level = (high: boolean) => (high ? text.high : text.low);
  return (
    <section aria-labelledby="wg-approval-relevance" className={card}>
      <h2 id="wg-approval-relevance" className="font-semibold text-lg">
        {text.relevanceTitle}
      </h2>
      <p className="text-muted-foreground text-sm">{text.relevanceHint}</p>
      <ul className="flex flex-col gap-1 text-sm">
        <li className="font-semibold">
          {data.relevance.score !== null && data.relevance.high !== null
            ? text.relevanceScore(format.number(data.relevance.score), level(data.relevance.high))
            : data.relevance.high !== null
              ? text.overrideActive(level(data.relevance.high), data.relevance.overrideReason ?? '')
              : text.relevanceOpen}
        </li>
        {data.relevance.override && (
          <li>
            {text.overrideActive(
              data.relevance.override === 'high' ? text.high : text.low,
              data.relevance.overrideReason ?? '',
            )}
          </li>
        )}
        <li>
          {data.spend
            ? text.spend(
                format.money(
                  { amountCents: data.spend.amountCents, currency: data.spend.currency },
                  { compact: true },
                ),
                level(data.spend.high),
              )
            : text.noSpend}
        </li>
        {data.route && <li>{text.route(text.routeNames[data.route] ?? '')}</li>}
      </ul>
      {canEdit && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave(scores);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {goalDimensions.flatMap((dimension) =>
              relevanceCriteria.map((criterion) => {
                const key = `${dimension}.${criterion}`;
                return (
                  <FormField
                    key={key}
                    label={text.relevanceLabel(
                      nameOf(dimension),
                      text.criteria[criterion] ?? criterion,
                    )}
                  >
                    {(field) => (
                      <NativeSelect
                        {...field}
                        value={scores[key] ?? ''}
                        onChange={(event) =>
                          setScores({ ...scores, [key]: Number(event.target.value) })
                        }
                      >
                        <option value="">–</option>
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </NativeSelect>
                    )}
                  </FormField>
                );
              }),
            )}
          </div>
          <FormActions>
            <Button
              type="submit"
              variant="secondary"
              disabled={relevanceKeys.some((key) => !scores[key])}
            >
              {text.relevanceSave}
            </Button>
          </FormActions>
        </form>
      )}
      {data.relevance.canOverride && data.status !== 'approved' && (
        <form
          aria-label={text.overrideTitle}
          className="flex flex-col gap-3 border-line-soft border-t pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            void onOverride({ override: override || null, reason });
          }}
        >
          <h3 className="font-semibold">{text.overrideTitle}</h3>
          <FormField label={text.overrideLabel}>
            {(field) => (
              <NativeSelect
                {...field}
                value={override}
                onChange={(event) => setOverride(event.target.value as '' | 'high' | 'low')}
              >
                <option value="">{text.overrideNone}</option>
                <option value="high">{text.overrideHigh}</option>
                <option value="low">{text.overrideLow}</option>
              </NativeSelect>
            )}
          </FormField>
          <FormField label={text.overrideReason}>
            {(field) => (
              <Textarea
                {...field}
                rows={2}
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            )}
          </FormField>
          <FormActions>
            <Button type="submit" variant="secondary">
              {text.overrideSave}
            </Button>
          </FormActions>
        </form>
      )}
    </section>
  );
}

function SignatureRow({
  approval,
  onSign,
  onReturn,
}: {
  approval: ApprovalView['approvals'][number];
  onSign: () => Promise<boolean>;
  onReturn: (comment: string) => Promise<boolean>;
}) {
  const text = useT().strategyApproval;
  const format = useFormat();
  const [returning, setReturning] = useState(false);
  const [comment, setComment] = useState('');
  const status =
    approval.status === 'signed' && approval.decidedAt
      ? text.signedOn(format.date(approval.decidedAt))
      : approval.status === 'returned' && approval.decidedAt
        ? text.returnedOn(format.date(approval.decidedAt), approval.comment ?? '')
        : (text.approvalStates[approval.status] ?? approval.status);
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 flex-col">
          <span className="text-muted-foreground text-sm">{text.roles[approval.role]}</span>
          <strong className="font-semibold">{approval.name}</strong>
        </span>
        <Badge
          variant={
            approval.status === 'signed'
              ? 'success'
              : approval.status === 'returned'
                ? 'warning'
                : 'neutral'
          }
        >
          {status}
        </Badge>
      </div>
      {approval.canDecide && !returning && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void onSign()}>
            {approval.role === 'approver' ? text.approve : text.sign}
          </Button>
          {approval.role === 'approver' && (
            <Button size="sm" variant="secondary" onClick={() => setReturning(true)}>
              {text.giveBack}
            </Button>
          )}
        </div>
      )}
      {returning && (
        <form
          className="flex flex-col gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await onReturn(comment)) setReturning(false);
          }}
        >
          <FormField label={text.giveBackLabel}>
            {(field) => (
              <Textarea
                {...field}
                rows={2}
                maxLength={2000}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            )}
          </FormField>
          <FormActions>
            <Button type="submit" size="sm">
              {text.giveBackConfirm}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setReturning(false)}>
              {text.cancel}
            </Button>
          </FormActions>
        </form>
      )}
    </li>
  );
}
