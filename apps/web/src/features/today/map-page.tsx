import type { FocusMap } from '@reziproq/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { BackLink } from '@/components/ui/back-link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { NextCard } from '@/components/ui/next-card';
import { PageTitle } from '@/components/ui/page-title';
import { PrivateNote } from '@/components/ui/private-note';
import { Row, RowGroup } from '@/components/ui/row-group';
import { SoWhat } from '@/components/ui/so-what';
import { StepRing } from '@/components/ui/step-ring';
import { routerLink } from '@/features/shell/navigation';
import { useDocumentTitle } from '@/features/shell/page-header';
import { shortDate } from '@/features/start/next-action';
import { focusMapQueryOptions, snoozeTopic } from '@/lib/api';
import { useLocale, useMessages } from '@/lib/i18n';
import { useTopicTitle } from './today-page';
import { whyMessages } from './why-messages';

/**
 * Fokus-Mappe (HE-01, UX-20 `FocusMappe`, Vorlage K1-Mappe): ein Fokus-Thema als Entscheidung in
 * fünf Teilen – worum es geht, Belege, Optionen, Empfehlung (höchstens eine, nur mit Grundlage) und
 * dein Schritt als Karte „Als Nächstes“; rechts „So geht es weiter“ und „Nur für dich“. Werte für beide
 * Seiten kommen mit der Wert-Engine (K4-a); bis dahin keine Zahl ohne Beleg (G-6).
 */
export function MapPage({ id }: { id: string }) {
  const text = useMessages(whyMessages).map;
  const all = useMessages(whyMessages);
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({ ...focusMapQueryOptions(accessToken, id), enabled: accessToken !== '' });
  const data = query.data;
  const title = useTopicTitle();
  useDocumentTitle(data ? text.title(title(data.topic)) : all.topic.title);
  const back = <BackLink label={all.back} href="/heute" renderLink={routerLink} />;
  if (query.isError) {
    return (
      <div className="flex flex-col gap-5.5">
        <PageTitle title={all.topic.title} back={back} />
        <ErrorState
          title={all.failed}
          action={
            <Button variant="secondary" onClick={() => query.refetch()}>
              {all.retry}
            </Button>
          }
        />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-5.5">
        <PageTitle title={all.topic.title} back={back} />
        <LoadingState label={all.loading} />
      </div>
    );
  }
  return <Folder data={data} />;
}

function Folder({ data }: { data: FocusMap }) {
  const all = useMessages(whyMessages);
  const text = all.map;
  const { locale } = useLocale();
  const title = useTopicTitle();
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const client = useQueryClient();
  const snooze = useMutation({
    mutationFn: () => snoozeTopic(accessToken, data.topic.id),
    onSuccess: () => client.invalidateQueries({ queryKey: ['heute'] }),
  });
  const { topic } = data;
  const step = title(topic);
  // Der Ort der Entscheidung: beim Hinweis sein Warum, sonst der Ort der Erledigung
  const target = data.hintId ? `/warum/${data.hintId}` : (topic.href ?? '/heute?ansicht=alles');
  const evidenceCount = topic.facts.length + data.sources.length;
  return (
    <div className="flex flex-col gap-5.5">
      <PageTitle
        title={text.title(step)}
        where={text.where(
          topic.counterpart,
          topic.materialGroup,
          topic.dueDate ? text.due(shortDate(locale, topic.dueDate)) : null,
        )}
        back={<BackLink label={all.back} href="/heute" renderLink={routerLink} />}
      />
      <div className="grid gap-5.5 wide:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5.5">
          {data.state === 'open' ? (
            <NextCard
              kicker={data.recommendation ? text.kickerRecommended : text.kickerStep}
              title={data.recommendation ?? step}
              text={topic.sentence}
              action={{
                label: data.hintId ? text.decideHint : text.open,
                href: target,
                ariaLabel: text.openLabel(step),
              }}
              secondary={
                <Button
                  variant="dark"
                  size="lg"
                  className="w-full shell:w-auto"
                  loading={snooze.isPending}
                  onClick={() => snooze.mutate()}
                >
                  {text.snooze}
                </Button>
              }
              renderLink={routerLink}
            />
          ) : (
            <RowGroup>
              <Row title={data.state === 'snoozed' ? text.snoozed : text.closed} />
            </RowGroup>
          )}
          <section aria-label={text.aboutLabel}>
            <SoWhat
              heading={text.aboutHeading}
              statement={topic.sentence}
              sources={data.sources.map((source) => source.title)}
            />
          </section>
          <RowGroup label={text.evidenceLabel}>
            <Row
              href={`/warum/${topic.id}`}
              title={text.evidence(evidenceCount)}
              detail={text.evidenceDetail}
              renderLink={routerLink}
            />
          </RowGroup>
          <RowGroup label={text.optionsLabel}>
            <Row
              title={text.optionNow(step)}
              detail={text.optionNowDetail}
              value={
                data.recommendation ? (
                  <Badge variant="success">{text.recommended}</Badge>
                ) : undefined
              }
            />
            <Row title={text.optionLater} detail={text.optionLaterDetail} />
            {data.hintId && <Row title={text.optionDismiss} detail={text.optionDismissDetail} />}
          </RowGroup>
          <p className="px-1 text-input-border text-sm">{text.valueLater}</p>
        </div>
        <aside className="flex min-w-0 flex-col gap-5.5">
          <RowGroup label={text.nextLabel}>
            <Row
              lead={<StepRing state="done" number={1} doneLabel={text.stepFound} size="sm" />}
              title={text.stepFound}
              detail={shortDate(locale, data.since.slice(0, 10))}
            />
            <Row
              lead={
                <StepRing
                  state={data.state === 'open' ? 'current' : 'done'}
                  number={2}
                  doneLabel={text.stepDecide}
                  size="sm"
                />
              }
              title={text.stepDecide}
              detail={text.stepDecideWhen}
            />
            <Row
              lead={<StepRing state="open" number={3} doneLabel={text.stepDone} size="sm" />}
              title={text.stepDone}
              detail={text.stepDoneDetail}
              wrap
            />
          </RowGroup>
          <PrivateNote title={text.privateTitle} chip={text.privateChip}>
            {text.privateText}
          </PrivateNote>
        </aside>
      </div>
    </div>
  );
}
