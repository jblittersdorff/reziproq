import type { WhyView } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import type * as React from 'react';
import { useAuth } from 'react-oidc-context';
import { AiDraft } from '@/components/ui/ai-draft';
import { BackLink } from '@/components/ui/back-link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { PageTitle } from '@/components/ui/page-title';
import { Row, RowGroup } from '@/components/ui/row-group';
import { HintPanel } from '@/features/hints/hint-panel';
import { routerLink } from '@/features/shell/navigation';
import { useDocumentTitle } from '@/features/shell/page-header';
import { shortDate } from '@/features/start/next-action';
import { hintQueryOptions, whyQueryOptions } from '@/lib/api';
import { useLocale, useMessages, useT } from '@/lib/i18n';
import { doneMessages } from './done-messages';
import { useTopicTitle } from './today-page';
import { whyMessages } from './why-messages';

type Text = (typeof whyMessages)['de'];

const pad = (n: number) => String(n).padStart(2, '0');
const localDay = (value: Date) =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

function useAccessToken() {
  const auth = useAuth();
  return auth.user?.access_token ?? '';
}

/** Kurzdatum mit Uhrzeit, z. B. „Mo 23.11. 06:10“ */
function useDateTime() {
  const { locale } = useLocale();
  return (iso: string) => {
    const value = new Date(iso);
    const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
      value,
    );
    return `${shortDate(locale, localDay(value))} ${time}`;
  };
}

function Frame({
  title,
  where,
  children,
}: {
  title: string;
  where?: React.ReactNode;
  children: React.ReactNode;
}) {
  const text = useMessages(whyMessages);
  useDocumentTitle(title);
  return (
    <div className="flex flex-col gap-5.5">
      <PageTitle
        title={title}
        where={where}
        back={<BackLink label={text.back} href="/heute" renderLink={routerLink} />}
      />
      {children}
    </div>
  );
}

/**
 * Warum (HE-01, UX-20 `WhyPanel`, Vorlage K1-Warum): zu einem Hinweis Beleg, Begründung, Regel und
 * Entscheidung; zu einem Lauf, was Reziproq getan und formuliert hat, mit Zeit, Schritten, Kosten
 * und Rechten; zu einem Fokus-Thema Rechenweg und Satz. Jede Zahl kommt aus Daten (G-6).
 */
export function WhyPage({ id }: { id: string }) {
  const text = useMessages(whyMessages);
  const accessToken = useAccessToken();
  const query = useQuery({ ...whyQueryOptions(accessToken, id), enabled: accessToken !== '' });
  const data = query.data;
  if (query.isError) {
    return (
      <Frame title={text.topic.title}>
        <ErrorState
          title={text.failed}
          action={
            <Button variant="secondary" onClick={() => query.refetch()}>
              {text.retry}
            </Button>
          }
        />
      </Frame>
    );
  }
  if (!data) {
    return (
      <Frame title={text.topic.title}>
        <LoadingState label={text.loading} />
      </Frame>
    );
  }
  if (data.kind === 'hint') return <HintWhy hintId={data.hintId} />;
  if (data.kind === 'run') return <RunWhy view={data} />;
  return <TopicWhy view={data} />;
}

/** Warum zum Hinweis: Regel und Datum im Kopf, darunter Beleg, Begründung, Quellen und Knöpfe */
function HintWhy({ hintId }: { hintId: string }) {
  const text = useMessages(whyMessages);
  const t = useT();
  const { locale } = useLocale();
  const accessToken = useAccessToken();
  const query = useQuery({ ...hintQueryOptions(accessToken, hintId), enabled: accessToken !== '' });
  const hint = query.data;
  if (query.isError) {
    return (
      <Frame title={text.hint.title}>
        <ErrorState title={text.failed} />
      </Frame>
    );
  }
  if (!hint) {
    return (
      <Frame title={text.hint.title}>
        <LoadingState label={text.loading} />
      </Frame>
    );
  }
  return (
    <Frame
      title={text.hint.title}
      where={text.hint.where(
        t.hints.rules[hint.ruleKey],
        shortDate(locale, hint.createdAt.slice(0, 10)),
        hint.supplier,
      )}
    >
      <div className="max-w-3xl">
        <HintPanel hint={hint} standalone />
      </div>
    </Frame>
  );
}

function Sources({
  text,
  sources,
}: {
  text: Text;
  sources: { title: string; href: string | null }[];
}) {
  return (
    <RowGroup label={text.sourcesLabel}>
      {sources.length === 0 ? (
        <Row title={text.noSources} />
      ) : (
        sources.map((source) => (
          <Row
            key={source.title}
            title={source.title}
            {...(source.href ? { href: source.href } : {})}
            renderLink={routerLink}
          />
        ))
      )}
    </RowGroup>
  );
}

/** Warum zu einem Lauf (Inventar T1-I15): Schritte, Aussagen mit Quellen, Zeit, Kosten, Rechte */
function RunWhy({ view }: { view: Extract<WhyView, { kind: 'run' }> }) {
  const text = useMessages(whyMessages);
  const tasks = useMessages(doneMessages).tasks;
  const { locale } = useLocale();
  const dateTime = useDateTime();
  const { run } = view;
  const task = tasks[run.task] ?? run.taskName;
  const cost = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(run.costMicrocents / 100_000_000);
  return (
    <Frame title={text.run.title(task)} where={text.run.where(dateTime(run.at), run.counterpart)}>
      <div className="grid gap-5.5 wide:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5.5">
          <RowGroup label={text.run.stepsLabel}>
            {view.steps.length === 0 ? (
              <Row title={text.run.noSteps} />
            ) : (
              view.steps.map((step) => (
                <Row
                  key={step.seq}
                  title={step.title}
                  value={<Badge>{text.run.status[step.status] ?? step.status}</Badge>}
                />
              ))
            )}
          </RowGroup>
          {view.statements.length > 0 && (
            <AiDraft
              heading={text.run.saidLabel}
              sourcesLabel={text.sourcesLabel}
              sources={[...new Set(view.statements.flatMap((entry) => entry.sources))].map(
                (source) => ({ key: source, label: source }),
              )}
            >
              <ul className="flex flex-col gap-1.5 text-base">
                {[...new Set(view.statements.map((entry) => entry.text))].map((statement) => (
                  <li key={statement}>{statement}</li>
                ))}
              </ul>
              <p className="mt-2 text-muted-foreground text-sm">{text.run.saidNote}</p>
            </AiDraft>
          )}
        </div>
        <aside className="flex min-w-0 flex-col gap-5.5">
          <RowGroup label={text.run.runLabel}>
            <Row
              title={task}
              detail={text.run.when(dateTime(run.at), run.steps, cost)}
              value={
                run.undone ? (
                  <Badge>{text.run.undone}</Badge>
                ) : (
                  <Badge variant={run.status === 'failed' ? 'danger' : 'neutral'}>
                    {text.run.status[run.status] ?? run.status}
                  </Badge>
                )
              }
            />
            <Row title={text.run.trigger} detail={text.run.triggers[run.trigger]} wrap />
            <Row
              title={text.run.may}
              detail={run.tools.length > 0 ? run.tools.join(', ') : text.run.mayNothing}
              wrap
            />
          </RowGroup>
          <Sources text={text} sources={view.sources} />
        </aside>
      </div>
    </Frame>
  );
}

/** Warum zu einem Fokus-Thema: Rechenweg aus den Fakten, Punktzahl und der geprüfte Satz */
function TopicWhy({ view }: { view: Extract<WhyView, { kind: 'topic' }> }) {
  const text = useMessages(whyMessages);
  const title = useTopicTitle();
  const { locale } = useLocale();
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const { topic } = view;
  return (
    <Frame title={text.topic.title} where={text.topic.where(title(topic))}>
      <div className="grid gap-5.5 wide:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5.5">
          <RowGroup label={text.topic.mathLabel}>
            {topic.facts.length === 0 ? (
              <Row title={text.topic.noFactsTitle} detail={text.topic.noFacts} wrap />
            ) : (
              topic.facts.map((fact) => (
                <Row
                  key={fact.key}
                  title={fact.source.label}
                  {...(text.topic.factKeys[fact.key]
                    ? { detail: text.topic.factKeys[fact.key] }
                    : {})}
                  value={`${typeof fact.value === 'number' ? number.format(fact.value) : fact.value}${fact.unit ? ` ${fact.unit}` : ''}`}
                  valueTone="accent"
                />
              ))
            )}
            <Row
              title={text.topic.scoreLabel}
              detail={
                view.rank
                  ? `${text.topic.scoreDetail} · ${text.topic.rank(view.rank)}`
                  : text.topic.scoreDetail
              }
              value={text.topic.score(topic.score)}
              valueTone="accent"
              wrap
            />
          </RowGroup>
          <AiDraft heading={text.topic.saidLabel} sourcesLabel={text.sourcesLabel} sources={[]}>
            <p className="font-display font-semibold text-lg tracking-section">{topic.sentence}</p>
            <p className="mt-2 text-muted-foreground text-sm">{text.topic.saidNote}</p>
          </AiDraft>
        </div>
        <aside className="flex min-w-0 flex-col gap-5.5">
          <Sources text={text} sources={view.sources} />
        </aside>
      </div>
    </Frame>
  );
}
