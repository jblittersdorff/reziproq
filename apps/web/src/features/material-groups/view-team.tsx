import type { AnalysisStep, AnalysisViewKey } from '@reziproq/shared';
import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckboxGroup, FormField } from '@/components/ui/form-field';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { useToken } from '@/features/ratings/use-rating';
import { analysisStepQueryOptions, assignAnalysisView, commentAnalysisView } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';

/**
 * WG-07 (Schritt 24, nach Regeln): Lead, Commodity Manager oder Admin weist eine Sicht Personen mit
 * Funktion im Team zu; sie kommentieren nur zugewiesene Sichten, das übrige Team jede. Die
 * Kostensicht wird nie zugewiesen. Kommentare sieht nur das Team.
 */
export function ViewTeamPanel({
  strategyId,
  step,
  view,
}: {
  strategyId: string;
  step: AnalysisStep;
  view: AnalysisViewKey;
}) {
  const text = useT().analysis;
  const format = useFormat();
  const token = useToken();
  const client = useQueryClient();
  const current = step.views.find((entry) => entry.view === view);
  const [selected, setSelected] = useState<string[]>(
    current?.assignees.map((entry) => entry.userId) ?? [],
  );
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState<'assign' | 'comment' | null>(null);
  const [failed, setFailed] = useState(false);
  if (!current) return null;
  const queryKey = analysisStepQueryOptions(token, strategyId, step.step).queryKey;
  const run = async (key: 'assign' | 'comment', work: () => Promise<AnalysisStep>) => {
    setBusy(key);
    setFailed(false);
    try {
      client.setQueryData(queryKey, await work());
      if (key === 'comment') setBody('');
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };
  const assignable = step.canAssign && view !== 'cost';
  const team = current.assignees.length > 0 || assignable || current.comments.length > 0;
  if (!team && !current.canComment) return null;

  return (
    <section
      aria-label={text.teamTitle}
      className="flex flex-col gap-4 rounded-lg bg-card p-5 shadow-card"
    >
      <h2 className="font-semibold text-lg">{text.teamTitle}</h2>
      {failed && <StatusLine message={text.commentFailed} tone="warning" />}
      <p className="text-muted-foreground text-sm">
        {current.assignees.length > 0
          ? text.assignedTo(current.assignees.map((entry) => entry.name).join(', '))
          : text.nobodyAssigned}
      </p>
      {step.canAssign && view === 'cost' && (
        <p className="text-muted-foreground text-sm">{text.costNotAssignable}</p>
      )}
      {assignable &&
        (step.functionMembers.length === 0 ? (
          <p className="text-muted-foreground text-sm">{text.noFunctionMembers}</p>
        ) : (
          <div className="flex flex-col gap-2">
            <CheckboxGroup
              legend={text.assignLegend}
              options={step.functionMembers.map((entry) => ({
                value: entry.userId,
                label: entry.name,
              }))}
              value={selected}
              onChange={setSelected}
            />
            <Button
              variant="secondary"
              className="self-start"
              loading={busy === 'assign'}
              onClick={() =>
                void run('assign', () => assignAnalysisView(token, strategyId, view, selected))
              }
            >
              {text.saveAssignment}
            </Button>
          </div>
        ))}
      <div className="flex flex-col gap-2 border-line-soft border-t pt-3">
        <h3 className="font-semibold text-sm">{text.comments}</h3>
        {current.comments.length === 0 ? (
          <p className="text-muted-foreground text-sm">{text.noComments}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {current.comments.map((comment) => (
              <li key={comment.id} className="flex flex-col gap-0.5 text-sm">
                <span className="font-semibold">
                  {comment.authorName}{' '}
                  <span className="font-normal text-muted-foreground">
                    {format.dateTime(comment.createdAt)}
                  </span>
                </span>
                <span className="whitespace-pre-wrap break-words">{comment.body}</span>
              </li>
            ))}
          </ul>
        )}
        {current.canComment && (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              if (body.trim())
                void run('comment', () =>
                  commentAnalysisView(token, strategyId, view, body.trim()),
                );
            }}
          >
            <FormField label={text.commentLabel}>
              {(props) => (
                <Textarea
                  {...props}
                  rows={3}
                  maxLength={2000}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                />
              )}
            </FormField>
            <Button
              type="submit"
              className="self-start"
              loading={busy === 'comment'}
              disabled={!body.trim()}
            >
              {text.sendComment}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
