import {
  levelRank,
  type MyAgent,
  type MyAgentTask,
  type WorkerLevel,
  workerByKey,
  workerLevels,
} from '@reziproq/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { PageTitle } from '@/components/ui/page-title';
import { PrivateNote } from '@/components/ui/private-note';
import { Row, RowGroup } from '@/components/ui/row-group';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SoWhat } from '@/components/ui/so-what';
import { routerLink } from '@/features/shell/navigation';
import { useDocumentTitle } from '@/features/shell/page-header';
import { myAgentQueryOptions, setWorkerLevel } from '@/lib/api';
import { useMessages } from '@/lib/i18n';
import { myAgentMessages } from './my-agent-messages';

type Text = (typeof myAgentMessages)['de'];

/** Unterzeile: was die Aufgabe tut, Übernahmequote, dann warum Stufen gesperrt sind */
function detailOf(text: Text, task: MyAgentTask) {
  const worker = workerByKey(task.key);
  const live = worker?.liveLevels ?? [];
  const cap = task.cap;
  const capped =
    cap !== null &&
    task.allowedLevels.some((level) => live.includes(level) && levelRank(level) > levelRank(cap));
  const later = task.allowedLevels.filter((level) => !live.includes(level));
  return text.detail(
    text.tasks[task.key]?.does,
    task.adoption && task.adoption.decided > 0
      ? text.unchanged(task.adoption.unchanged, task.adoption.decided)
      : null,
    !task.enabled && text.off,
    task.enabled && capped && cap !== null && text.capped(text.levels[cap]),
    later.length > 0 && text.later(later.map((level) => text.levels[level])),
  );
}

/**
 * Mein Agent (MA-01, Vorlage Mein-Agent): je Aufgabe, die es heute gibt, wie viel Reziproq für die
 * Person selbst tut. Wählbar sind nur erlaubte Stufen, die heute wirken und unter der Obergrenze
 * der Organisation liegen; die übrigen sind gesperrt (T1-MA3). Rechts, was nie automatisch
 * geschieht, und wer was festlegt.
 *
 * Bewusst anders als die Vorlage:
 * - „Angebot von Reziproq“ fehlt, bis verdiente Autonomie gebaut ist (AU-01, K5-f).
 * - „Nie automatisch“ nennt alle Leitplanken aus MA-01, nicht nur die vier der Vorlage.
 * - Die Übernahmequote gilt für acht Wochen wie in MA-01; der Satz sagt das.
 * - Die Knöpfe sind 44 px hoch (PLT-10), nicht 36 px.
 */
export function MyAgentPage() {
  const text = useMessages(myAgentMessages);
  useDocumentTitle(text.title);
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({ ...myAgentQueryOptions(accessToken), enabled: accessToken !== '' });
  const data = query.data;
  const header = <PageTitle title={text.title} where={text.where} />;

  if (query.isError) {
    return (
      <div className="flex flex-col gap-5.5">
        {header}
        <ErrorState
          title={text.failed}
          action={
            <Button variant="secondary" onClick={() => query.refetch()}>
              {text.retry}
            </Button>
          }
        />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-5.5">
        {header}
        <LoadingState label={text.loading} />
      </div>
    );
  }

  const percent =
    data.adoption.decided > 0
      ? Math.round((data.adoption.unchanged / data.adoption.decided) * 100)
      : null;
  return (
    <div className="flex flex-col gap-5.5">
      {header}
      <div className="grid gap-5.5 wide:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5.5">
          <section aria-label={text.summaryHeading}>
            <SoWhat
              heading={text.summaryHeading}
              statement={`${text.week(data.week.done, data.week.prepared)} ${
                percent === null ? text.adoptionNone : text.adoption(percent)
              }`}
            />
          </section>
          <RowGroup label={text.tasksLabel}>
            {data.tasks.map((task) => (
              <TaskRow key={task.key} task={task} canEdit={data.canEdit} />
            ))}
          </RowGroup>
          <p className="px-1 text-detail text-muted-foreground">{text.explain}</p>
          {!data.canEdit && (
            <p className="px-1 text-detail text-muted-foreground">{text.readOnly}</p>
          )}
        </div>
        <aside className="flex min-w-0 flex-col gap-5.5">
          <PrivateNote title={text.never.title}>
            <ul className="list-disc pl-5">
              {text.never.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </PrivateNote>
          <RowGroup label={text.whoLabel}>
            <Row title={text.who.own} detail={text.who.ownDetail} />
            {data.canManage ? (
              <Row
                href="/einstellungen/ki"
                title={text.who.admin}
                detail={text.who.adminDetail}
                renderLink={routerLink}
              />
            ) : (
              <Row title={text.who.admin} detail={text.who.adminDetail} />
            )}
            <Row
              href="/erledigt"
              title={text.who.log}
              detail={text.who.logDetail}
              renderLink={routerLink}
            />
          </RowGroup>
        </aside>
      </div>
    </div>
  );
}

/** Eine Aufgabe: Name, was sie tut, Quote und der Schalter der Stufe */
function TaskRow({ task, canEdit }: { task: MyAgentTask; canEdit: boolean }) {
  const text = useMessages(myAgentMessages);
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const client = useQueryClient();
  const [pending, setPending] = useState<WorkerLevel | null>(null);
  const save = useMutation({
    mutationFn: (level: WorkerLevel) => setWorkerLevel(accessToken, task.key, level),
    onMutate: (level) => setPending(level),
    onSuccess: (updated) => {
      client.setQueryData<MyAgent>(['mein-agent'], (old) =>
        old
          ? {
              ...old,
              tasks: old.tasks.map((entry) => (entry.key === updated.key ? updated : entry)),
            }
          : old,
      );
      // Die Stufe ändert, was Heute zeigt (Postfach: Kurz prüfen oder Alles)
      void client.invalidateQueries({ queryKey: ['heute'] });
    },
    onSettled: () => setPending(null),
  });
  const name = text.tasks[task.key]?.name ?? task.key;
  const detail = detailOf(text, task);
  return (
    <Row
      title={name}
      detail={
        save.isError ? (
          <>
            {detail}
            <span role="alert" className="block text-destructive">
              {text.saveFailed}
            </span>
          </>
        ) : (
          detail
        )
      }
      control={
        <SegmentedControl<WorkerLevel>
          label={text.switchLabel(name)}
          value={pending ?? task.level ?? task.chosen ?? task.defaultLevel}
          disabled={!canEdit || !task.enabled}
          onChange={(level) => save.mutate(level)}
          options={workerLevels.map((level) => ({
            value: level,
            label: text.levels[level],
            disabled: !task.selectable.includes(level),
          }))}
        />
      }
    />
  );
}
