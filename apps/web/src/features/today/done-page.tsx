import type { DoneRow } from '@reziproq/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { BackLink } from '@/components/ui/back-link';
import { Badge } from '@/components/ui/badge';
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
import { shortDate } from '@/features/start/next-action';
import { ApiError, doneQueryOptions, undoDone } from '@/lib/api';
import { useLocale, useMessages } from '@/lib/i18n';
import { doneMessages } from './done-messages';

type Text = (typeof doneMessages)['de'];

const pad = (n: number) => String(n).padStart(2, '0');
const localDay = (value: Date) =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

function taskName(text: Text, row: Pick<DoneRow, 'task' | 'taskName'>) {
  return text.tasks[row.task] ?? row.taskName;
}

/** Was getan wurde, als Satz aus den Angaben des Laufs */
function rowText(text: Text, row: DoneRow) {
  if (row.action === 'inbound_assign')
    return text.text.inbound_assign(row.subject, row.counterpart);
  const what = row.subject ?? taskName(text, row);
  if (row.status === 'failed') return text.text.failed(what);
  if (row.action === 'prepared') return text.text.prepared(what, row.openDrafts > 0);
  return text.text.run(what);
}

/**
 * Erledigt im Hintergrund (HE-01, UX-20 `DoneLog`, Vorlage Erledigt): Zeilen mit Uhrzeit, Aufgabe
 * von Reziproq, Text und Objekt; Zurücknehmen bis 30 Tage, solange das Objekt unverändert ist, sonst
 * der Grund; Ansehen führt zum Objekt oder nach Kurz prüfen. Filter nach Aufgabe; rechts die Stufen
 * je Aufgabe mit Verweis auf Mein Agent und was nie automatisch geschieht.
 */
export function DonePage() {
  const text = useMessages(doneMessages);
  useDocumentTitle(text.title);
  const { locale } = useLocale();
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({ ...doneQueryOptions(accessToken), enabled: accessToken !== '' });
  const [task, setTask] = useState('alle');
  const data = query.data;

  const header = (where?: string) => (
    <PageTitle
      title={text.title}
      where={where}
      back={<BackLink label={text.back} href="/heute" renderLink={routerLink} />}
    />
  );
  if (query.isError) {
    return (
      <div className="flex flex-col gap-5.5">
        {header()}
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
        {header()}
        <LoadingState label={text.loading} />
      </div>
    );
  }

  const since = new Date(data.since);
  const recent = data.rows.filter((row) => new Date(row.at) >= since && row.status !== 'undone');
  const count = (action: DoneRow['action']) =>
    recent.filter((row) => row.action === action && row.status !== 'failed').length;
  const failed = recent.filter((row) => row.status === 'failed').length;
  const chips = [
    count('inbound_assign') > 0 && text.chips.inbound_assign(count('inbound_assign')),
    count('prepared') > 0 && text.chips.prepared(count('prepared')),
    count('run') > 0 && text.chips.run(count('run')),
    failed > 0 && text.chips.failed(failed),
  ].filter((chip): chip is string => Boolean(chip));
  const tasks = [...new Map(data.rows.map((row) => [row.task, taskName(text, row)])).entries()];
  const shown = data.rows.filter((row) => task === 'alle' || row.task === task);
  const days = new Map<string, DoneRow[]>();
  for (const row of shown) {
    const key = localDay(new Date(row.at));
    days.set(key, [...(days.get(key) ?? []), row]);
  }
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const dayLabel = (key: string) =>
    key === localDay(now)
      ? text.today
      : key === localDay(yesterday)
        ? text.yesterday
        : shortDate(locale, key);

  return (
    <div className="flex flex-col gap-5.5">
      {header(text.where(data.recent))}
      <div className="grid gap-5.5 wide:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5.5">
          <section aria-label={text.summaryHeading}>
            <SoWhat heading={text.summaryHeading} statement={text.summary(data.recent)}>
              {chips.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {chips.map((chip) => (
                    <Badge key={chip}>{chip}</Badge>
                  ))}
                </div>
              )}
            </SoWhat>
          </section>
          {tasks.length > 1 && (
            <SegmentedControl
              label={text.filter}
              value={task}
              onChange={setTask}
              options={[
                { value: 'alle', label: text.all },
                ...tasks.map(([key, name]) => ({ value: key, label: name })),
              ]}
            />
          )}
          {shown.length === 0 ? (
            <RowGroup>
              <Row title={text.empty} />
            </RowGroup>
          ) : (
            [...days.entries()].map(([key, rows]) => (
              <RowGroup key={key} label={dayLabel(key)}>
                {rows.map((row) => (
                  <DoneEntry key={row.id} row={row} />
                ))}
              </RowGroup>
            ))
          )}
        </div>
        <aside className="flex min-w-0 flex-col gap-5.5">
          <RowGroup label={text.levelsLabel}>
            {data.tasks.map((entry) => (
              <Row
                key={entry.key}
                title={text.tasks[entry.key] ?? entry.key}
                detail={text.levels[entry.level]}
                value={
                  <Badge variant={entry.level === 'do' ? 'shared' : 'neutral'}>
                    {text.levelChips[entry.level]}
                  </Badge>
                }
              />
            ))}
          </RowGroup>
          {routerLink({
            href: '/mein-agent',
            className:
              'inline-flex min-h-11 items-center self-start px-1 font-semibold text-base text-petrol no-underline hover:text-petrol-dark focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            children: `${text.change} ›`,
          })}
          <PrivateNote title={text.never.title}>{text.never.text}</PrivateNote>
        </aside>
      </div>
    </div>
  );
}

/** Eine Zeile: Uhrzeit, was getan wurde, Aufgabe und Gegenüber, Zurücknehmen oder Ansehen */
function DoneEntry({ row }: { row: DoneRow }) {
  const text = useMessages(doneMessages);
  const { locale } = useLocale();
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const client = useQueryClient();
  const undo = useMutation({
    mutationFn: () => undoDone(accessToken, row.id),
    onSuccess: () => client.invalidateQueries({ queryKey: ['heute'] }),
  });
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(row.at),
  );
  const refused =
    undo.error instanceof ApiError && undo.error.status === 409
      ? (undo.error.body as { code?: string; changedBy?: string | null } | undefined)
      : undefined;
  const blocked =
    refused?.code === 'geaendert'
      ? refused.changedBy
        ? text.changedBy(refused.changedBy)
        : text.blocked.geaendert
      : row.undo.blocker === 'geaendert' || row.undo.blocker === 'abgelaufen'
        ? text.blocked[row.undo.blocker]
        : null;
  const value =
    row.status === 'undone' ? (
      <Badge>{text.undone}</Badge>
    ) : row.status === 'failed' ? (
      <Badge variant="danger">{text.failedChip}</Badge>
    ) : row.undo.possible && !refused ? (
      <Button variant="secondary" loading={undo.isPending} onClick={() => undo.mutate()}>
        {text.undo}
      </Button>
    ) : row.href ? (
      <Button variant="secondary" asChild>
        {routerLink({ href: row.href, className: 'no-underline', children: text.view })}
      </Button>
    ) : undefined;
  return (
    <div data-slot="row" className="flex min-h-14 items-start gap-3 px-3.5 py-2.5">
      <span className="w-14 shrink-0 pt-0.5 font-semibold text-muted-strong text-sm tabular-nums">
        {time}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-pretty font-medium text-ink text-row">{rowText(text, row)}</span>
        <span className="text-detail text-input-border">
          {text.detail(text.tasks[row.task] ?? row.taskName, row.counterpart)}
        </span>
        {blocked && (
          <span role={refused ? 'alert' : undefined} className="text-detail text-muted-strong">
            {blocked}
          </span>
        )}
        {undo.isError && !refused && (
          <span role="alert" className="text-destructive text-sm">
            {text.undoFailed}
          </span>
        )}
      </span>
      {value && <span className="shrink-0">{value}</span>}
    </div>
  );
}
