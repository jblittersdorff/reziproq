import { type AkteShared, displayNameOf } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { LockIcon, SearchXIcon } from 'lucide-react';
import { AkteHead as AkteHeadBlock } from '@/components/ui/akte-head';
import { Badge } from '@/components/ui/badge';
import { BrandMark } from '@/components/ui/brand-mark';
import { buttonVariants } from '@/components/ui/button';
import { DateList, type DateListItem } from '@/components/ui/date-list';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Mirror } from '@/components/ui/mirror';
import { Monogram } from '@/components/ui/monogram';
import { Row, RowGroup } from '@/components/ui/row-group';
import { SoWhat } from '@/components/ui/so-what';
import { useMe } from '@/features/auth/use-me';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { useDocumentTitle } from '@/features/shell/page-header';
import { localToday, NextActionCard, shortDate, weekdayTime } from '@/features/start/next-action';
import { currentStepIndex } from '@/features/workspace/phases';
import { useOverview } from '@/features/workspace/use-overview';
import {
  ApiError,
  akteHeadQueryOptions,
  akteSharedQueryOptions,
  nextActionQueryOptions,
} from '@/lib/api';
import { type Format, useFormat } from '@/lib/format';
import { useLocale, useMessages, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useAkteActions } from './akte-actions';
import { CounterpartView } from './akte-counterpart-view';
import { akteMessages } from './akte-messages';
import { PrivateView } from './akte-private-view';
import { sheetHref } from './akte-sheet';
import { comparison, isNear, measureText, monthOf, oldPage, overdueOf, viewOf } from './akte-view';

type Text = (typeof akteMessages)['de'];

const old = oldPage;

/**
 * Akte einer Beziehung (AK-01, nach den Vorlagen L-Ueberblick, K2-Akte-Privat und A-Lieferant): Kopf
 * mit Aktionen und Sichten-Umschalter, der die Adresse setzt (T2-04). Gemeinsam (K2-c.2) zeigt, was
 * beide Seiten gleich sehen, Nur für dich (K2-c.3) was nur das eigene Team sieht, Von <Gegenüber>
 * (K2-c.4) was das Gegenüber aktiv geteilt hat (Vorlage K2-Akte-Geteilt).
 */
export function AktePage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = useMessages(akteMessages);
  const format = useFormat();
  const accessToken = useToken();
  const me = useMe();
  const search = useSearch({ from: '/_app/beziehungen/$id' });
  const view = viewOf(search);
  const allowed = me.data?.permissions.viewSuppliers === true;
  const enabled = accessToken !== '' && allowed;
  const head = useQuery({ ...akteHeadQueryOptions(accessToken, relationshipId), enabled });
  const overview = useOverview(relationshipId);
  const name = head.data ? displayNameOf(head.data.name).name : '';
  useDocumentTitle(name || text.back);
  const runs = useAkteActions({
    relationshipId,
    name,
    nextMeeting: head.data?.nextMeeting ?? null,
  });

  if (me.data && !me.data.organization) return null;
  const denied =
    (me.data && !allowed) ||
    (head.error instanceof ApiError && head.error.code === 'keine_berechtigung');
  if (denied) {
    return (
      <EmptyState
        size="lg"
        icon={<LockIcon aria-hidden />}
        title={text.states.deniedTitle}
        description={text.states.deniedText}
      />
    );
  }
  if (head.error instanceof ApiError && head.error.status === 404) {
    return (
      <EmptyState
        size="lg"
        icon={<SearchXIcon aria-hidden />}
        title={text.states.notFoundTitle}
        description={text.states.notFoundText}
        action={routerLink({
          href: '/beziehungen',
          className: buttonVariants({ variant: 'secondary' }),
          children: text.back,
        })}
      />
    );
  }
  if (head.isError || me.isError) return <ErrorState title={text.states.failed} />;
  if (!head.data) return <LoadingState label={text.states.loading} />;

  const data = head.data;
  const cycle = overview.data?.cycle ?? null;
  const step = cycle ? cycle.steps[currentStepIndex(cycle)] : undefined;
  const spend = data.spend ? format.money(data.spend, { compact: true, fractionDigits: 2 }) : null;
  const segment = data.segment?.name ?? text.meta.unrated;
  const meta = [
    segment,
    data.materialGroups.join(', ') || null,
    spend ? text.meta.spend(spend, data.year) : null,
    data.lead ? text.meta.lead(data.lead) : null,
    step ? text.meta.step(t.workspace.cycle.steps[step.key] ?? step.key) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const base = `/beziehungen/${relationshipId}`;

  return (
    <div className="flex flex-col gap-5.5">
      <AkteHeadBlock
        back={{ label: text.back, href: '/beziehungen' }}
        name={name}
        meta={meta}
        metaShort={[segment, spend].filter(Boolean).join(' · ')}
        actionsLabel={text.actions.label}
        actions={runs.actions}
        more={{ label: text.actions.more, href: sheetHref(relationshipId, 'profil', view) }}
        views={{
          label: text.views.label,
          active: view,
          items: [
            {
              key: 'gemeinsam',
              label: text.views.shared,
              href: base,
              icon: <BrandMark className="h-3.5 w-5" />,
            },
            {
              key: 'privat',
              label: text.views.private,
              shortLabel: text.views.privateShort,
              href: `${base}?sicht=privat`,
              icon: <LockIcon aria-hidden className="size-3.5 shrink-0" />,
            },
            {
              key: 'geteilt',
              label: text.views.counterpart(name),
              shortLabel: name,
              href: `${base}?sicht=geteilt`,
              icon: <span aria-hidden className="size-2 shrink-0 rounded-full bg-petrol" />,
            },
          ],
        }}
        renderLink={routerLink}
      />
      {runs.status}
      {view === 'gemeinsam' ? (
        <SharedView relationshipId={relationshipId} name={name} text={text} />
      ) : view === 'privat' ? (
        <PrivateView relationshipId={relationshipId} name={name} />
      ) : (
        <CounterpartView relationshipId={relationshipId} name={name} />
      )}
    </div>
  );
}

/** Sicht Gemeinsam (Vorlage L-Ueberblick): was beide Seiten gleich sehen */
function SharedView({
  relationshipId,
  name,
  text,
}: {
  relationshipId: string;
  name: string;
  text: Text;
}) {
  const format = useFormat();
  const { locale } = useLocale();
  const accessToken = useToken();
  const me = useMe();
  const query = useQuery({
    ...akteSharedQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  const next = useQuery({
    ...nextActionQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  if (query.isError) return <ErrorState title={text.states.failed} />;
  const akte = query.data;
  if (!akte) return <LoadingState label={text.states.loading} />;
  const ownName = me.data?.organization?.name ?? '';
  const today = localToday();

  return (
    // Vorlage L-Ueberblick: Arbeit links, Kontext rechts in einer schmalen Spalte (wie die Liste)
    <div className="grid gap-5.5 wide:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-5.5">
        <NextActionCard next={next.data?.next} />
        <Summary akte={akte} name={name} text={text} />
        <Commitments
          akte={akte}
          relationshipId={relationshipId}
          name={name}
          ownName={ownName}
          today={today}
          text={text}
          locale={locale}
        />
        <Scorecard
          akte={akte}
          relationshipId={relationshipId}
          name={name}
          text={text}
          locale={locale}
        />
      </div>
      <aside className="flex min-w-0 flex-col gap-5.5">
        <Weeks
          akte={akte}
          relationshipId={relationshipId}
          name={name}
          text={text}
          locale={locale}
        />
        <PlanAndRules akte={akte} relationshipId={relationshipId} text={text} format={format} />
        <Feedback
          akte={akte}
          relationshipId={relationshipId}
          name={name}
          text={text}
          locale={locale}
        />
        <Team akte={akte} relationshipId={relationshipId} name={name} text={text} />
        <p className="px-1 text-muted-foreground text-sm">{text.aside.footnote(name)}</p>
      </aside>
    </div>
  );
}

/** Das Wichtigste mit Spiegel der Zusagequoten (ZQ-01): Sätze aus belegten Zahlen (G-6) */
function Summary({ akte, name, text }: { akte: AkteShared; name: string; text: Text }) {
  const versus = comparison(akte.quota);
  const overdue = overdueOf(akte.commitments, 'supplier');
  const ownOverdue = overdueOf(akte.commitments, 'buyer');
  const statement = [
    versus === 'more'
      ? text.summary.more(name)
      : versus === 'less'
        ? text.summary.less(name)
        : versus === 'equal'
          ? text.summary.equal
          : text.summary.none(akte.year),
    overdue.length === 1 && overdue[0]
      ? text.summary.overdueOne(overdue[0].title)
      : overdue.length > 1
        ? text.summary.overdueMany(overdue.length, name)
        : null,
    ownOverdue.length > 0 ? text.summary.ownOverdue(ownOverdue.length) : null,
  ]
    .filter(Boolean)
    .join(' ');
  const percent = (value: number | null) => (value === null ? text.mirror.none : `${value} %`);
  const sources = [
    text.summary.sources.commitments,
    akte.scorecard ? text.summary.sources.scorecard : null,
    akte.feedback.length > 0 ? text.summary.sources.feedback : null,
  ].filter((source): source is string => source !== null);
  return (
    <section aria-label={text.summary.label}>
      <SoWhat
        heading={text.summary.heading}
        statement={statement}
        sources={sources}
        renderLink={routerLink}
      >
        <Mirror
          className="pt-1"
          label={text.mirror.label(
            akte.year,
            percent(akte.quota.own.percent),
            name,
            percent(akte.quota.counterpart.percent),
          )}
          own={{
            percent: akte.quota.own.percent,
            text: text.mirror.own(akte.quota.own.kept, akte.quota.own.due),
          }}
          counterpart={{
            percent: akte.quota.counterpart.percent,
            text: text.mirror.counterpart(
              name,
              akte.quota.counterpart.kept,
              akte.quota.counterpart.due,
            ),
          }}
          caption={text.mirror.caption(akte.year, name)}
        />
      </SoWhat>
    </section>
  );
}

/** Zusagen beider Seiten (ZQ-01): Seite, Person, Frist, Herkunft und Stand als Chip */
function Commitments({
  akte,
  relationshipId,
  name,
  ownName,
  today,
  text,
  locale,
}: {
  akte: AkteShared;
  relationshipId: string;
  name: string;
  ownName: string;
  today: string;
  text: Text;
  locale: string;
}) {
  const plainDate = (date: string) =>
    new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(
      new Date(`${date}T12:00:00Z`),
    );
  const dateText = (date: string) =>
    isNear(date, today) ? shortDate(locale, date) : plainDate(date);
  const sideName = (side: 'buyer' | 'supplier') =>
    side === 'supplier' ? name : text.commitments.ownSide;
  return (
    <div id="zusagen" className="scroll-mt-6">
      <RowGroup tone="shared" label={text.commitments.label(akte.commitments.length)}>
        {akte.commitments.map((entry) => {
          const origin =
            entry.origin === 'plan' && entry.planYear
              ? text.commitments.plan(entry.planYear)
              : entry.origin
                ? (text.commitments.origin[entry.origin] ?? null)
                : null;
          const entered =
            entry.side === 'supplier' && entry.enteredBy === 'buyer'
              ? text.commitments.enteredByOwn
              : entry.side === 'buyer' && entry.enteredBy === 'supplier'
                ? text.commitments.enteredByCounterpart(name)
                : null;
          const when =
            entry.measure ??
            (entry.state === 'overdue'
              ? text.commitments.overdue(plainDate(entry.dueOn))
              : text.commitments.due(dateText(entry.dueOn)));
          const chip =
            entry.state === 'overdue' ? (
              <Badge variant="danger">{text.commitments.chips.overdue}</Badge>
            ) : entry.state === 'awaiting_counterpart' ? (
              // Auf dem Telefon kurz: Die Seite steht schon in der Unterzeile
              <Badge variant="warning">
                <span className="shell:hidden">{text.commitments.chips.awaitingShort}</span>
                <span className="hidden shell:inline">
                  {text.commitments.chips.awaiting_counterpart(name)}
                </span>
              </Badge>
            ) : entry.state === 'awaiting_own' ? (
              <Badge variant="warning">{text.commitments.chips.awaiting_own}</Badge>
            ) : (
              <Badge variant="neutral">{text.commitments.chips.open}</Badge>
            );
          return (
            <Row
              key={entry.id}
              href={old(relationshipId, `/umsetzung/massnahmen/${entry.id}`)}
              lead={
                entry.side === 'supplier' ? (
                  <Monogram name={name} tone="petrol" />
                ) : (
                  <Monogram name={ownName} tone="ink" />
                )
              }
              title={entry.title}
              detail={[sideName(entry.side), entry.ownerName, when, origin, entered]
                .filter(Boolean)
                .join(' · ')}
              value={chip}
              wrap
              renderLink={routerLink}
            />
          );
        })}
        <Row
          title={text.commitments.kept(akte.kept.count, akte.year)}
          detail={
            akte.kept.last
              ? text.commitments.lastKept(akte.kept.last.title, sideName(akte.kept.last.side))
              : text.commitments.noneKept
          }
          wrap
        />
      </RowGroup>
    </div>
  );
}

/** Scorecard mit Stand je Kennzahl (JBP-09) und Unterschrift; die Zeile öffnet die Kennzahl */
function Scorecard({
  akte,
  relationshipId,
  name,
  text,
  locale,
}: {
  akte: AkteShared;
  relationshipId: string;
  name: string;
  text: Text;
  locale: string;
}) {
  const card = akte.scorecard;
  if (!card) {
    return (
      <div id="scorecard" className="scroll-mt-6">
        <RowGroup tone="shared" label={text.scorecard.label(akte.plan?.year ?? null, null)}>
          <Row
            href={old(relationshipId, '/plan/scorecard')}
            title={text.scorecard.empty}
            detail={text.scorecard.emptyText}
            renderLink={routerLink}
          />
        </RowGroup>
      </div>
    );
  }
  const side = (value: 'buyer' | 'supplier') =>
    value === 'supplier' ? name : text.commitments.ownSide;
  const tones = { on_track: 'success', close: 'warning', off: 'danger' } as const;
  const signature =
    card.signed.own && card.signed.counterpart
      ? text.scorecard.signedBoth
      : card.signed.counterpart
        ? text.scorecard.ownMissing(name)
        : card.signed.own
          ? text.scorecard.counterpartMissing(name)
          : text.scorecard.noneSigned;
  return (
    <div id="scorecard" className="scroll-mt-6">
      <RowGroup
        tone="shared"
        label={text.scorecard.label(
          akte.plan?.year ?? null,
          card.period ? monthOf(card.period, locale) : null,
        )}
      >
        {card.kpis.map((kpi) => (
          <Row
            key={kpi.id}
            href={sheetHref(relationshipId, `kennzahlen/${kpi.id}`)}
            title={kpi.name}
            detail={
              kpi.latest
                ? text.scorecard.line(
                    side(kpi.ownerSide),
                    measureText(kpi.latest.value, kpi.unit, locale),
                    measureText(kpi.target, kpi.unit, locale),
                  )
                : text.scorecard.noValue(
                    side(kpi.ownerSide),
                    measureText(kpi.target, kpi.unit, locale),
                  )
            }
            value={
              <Badge variant={kpi.track ? tones[kpi.track] : 'neutral'}>
                {text.scorecard.tracks[kpi.track ?? 'none']}
              </Badge>
            }
            wrap
            renderLink={routerLink}
          />
        ))}
        <Row
          title={text.scorecard.signature}
          detail={signature}
          value={
            card.signed.counterpart && !card.signed.own
              ? routerLink({
                  href: old(relationshipId, '/plan/scorecard/unterschreiben'),
                  className: cn(buttonVariants({ variant: 'secondary' }), 'no-underline'),
                  children: text.scorecard.sign,
                })
              : undefined
          }
        />
      </RowGroup>
    </div>
  );
}

/** Nächste Wochen: geteilte Termine und Fristen offener Zusagen, mit Datumskreis */
function Weeks({
  akte,
  relationshipId,
  name,
  text,
  locale,
}: {
  akte: AkteShared;
  relationshipId: string;
  name: string;
  text: Text;
  locale: string;
}) {
  const states = {
    open: text.commitments.chips.open,
    overdue: text.commitments.chips.overdue,
    awaiting_counterpart: text.commitments.chips.awaitingShort,
    awaiting_own: text.commitments.chips.awaiting_own,
  };
  const items: DateListItem[] = akte.weeks.map((entry) =>
    entry.kind === 'meeting'
      ? {
          key: entry.id,
          date: berlinDay(entry.startsAt),
          title: entry.title,
          sub: text.aside.meeting(weekdayTime(locale, entry.startsAt), entry.location),
          href: old(relationshipId, `/umsetzung/termine/${entry.id}`),
        }
      : {
          key: entry.id,
          date: entry.dueOn,
          title: entry.title,
          sub: text.aside.commitment(
            entry.side === 'supplier' ? name : text.commitments.ownSide,
            states[entry.state],
          ),
          href: old(relationshipId, `/umsetzung/massnahmen/${entry.id}`),
        },
  );
  return (
    <RowGroup label={text.aside.weeks}>
      <div className="px-3.5 py-3">
        {items.length > 0 ? (
          <DateList
            items={items}
            locale={locale}
            label={text.aside.weeks}
            renderLink={routerLink}
          />
        ) : (
          <p className="text-muted-foreground text-sm">{text.aside.weeksEmpty}</p>
        )}
      </div>
    </RowGroup>
  );
}

/** Gemeinsamer Plan und Spielregeln */
function PlanAndRules({
  akte,
  relationshipId,
  text,
  format,
}: {
  akte: AkteShared;
  relationshipId: string;
  text: Text;
  format: Format;
}) {
  return (
    <RowGroup label={text.aside.plan}>
      {akte.plan && (
        <Row
          href={old(relationshipId, '/plan')}
          title={text.aside.planTitle(akte.plan.year)}
          detail={text.aside.planDetail(akte.plan.version)}
          value={
            <Badge variant={akte.plan.status === 'approved' ? 'success' : 'warning'}>
              {text.aside.planStatus[akte.plan.status]}
            </Badge>
          }
          wrap
          renderLink={routerLink}
        />
      )}
      {akte.rules ? (
        <Row
          href={sheetHref(relationshipId, 'spielregeln')}
          title={text.aside.rules(akte.rules.typeName)}
          detail={[
            akte.rules.since ? text.aside.rulesSince(format.date(akte.rules.since)) : null,
            akte.rules.unshared
              ? akte.rules.since
                ? text.aside.rulesUnshared
                : text.aside.rulesDraft
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          wrap
          renderLink={routerLink}
        />
      ) : (
        <Row
          href={sheetHref(relationshipId, 'spielregeln')}
          title={text.aside.rulesNone}
          detail={text.aside.rulesNoneText}
          wrap
          renderLink={routerLink}
        />
      )}
    </RowGroup>
  );
}

/** Feedback-Wellen mit Rücklauf je Seite */
function Feedback({
  akte,
  relationshipId,
  name,
  text,
  locale,
}: {
  akte: AkteShared;
  relationshipId: string;
  name: string;
  text: Text;
  locale: string;
}) {
  return (
    <RowGroup label={text.aside.feedback}>
      {akte.feedback.length === 0 ? (
        <Row
          href={old(relationshipId, '/beziehung/feedback')}
          title={text.aside.feedbackNone}
          renderLink={routerLink}
        />
      ) : (
        akte.feedback.map((wave) => (
          <Row
            key={wave.id}
            href={old(relationshipId, `/beziehung/feedback/${wave.id}`)}
            title={`${text.aside.wave[wave.kind] ?? wave.kind} · ${
              wave.closed
                ? text.aside.waveClosed(shortDate(locale, wave.dueDate))
                : text.aside.waveRunning(shortDate(locale, wave.dueDate))
            }`}
            detail={text.aside.turnout(
              text.aside.ofTotal(wave.own.completed, wave.own.invited),
              name,
              text.aside.ofTotal(wave.counterpart.completed, wave.counterpart.invited),
            )}
            wrap
            renderLink={routerLink}
          />
        ))
      )}
    </RowGroup>
  );
}

/** Team beider Seiten; vom Gegenüber nur die geteilten Mitglieder */
function Team({
  akte,
  relationshipId,
  name,
  text,
}: {
  akte: AkteShared;
  relationshipId: string;
  name: string;
  text: Text;
}) {
  const names = [
    akte.team.own.map((member) => member.name).join(', '),
    akte.team.counterpart.map((member) => member.name).join(', '),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <RowGroup label={text.aside.team}>
      <Row
        href={sheetHref(relationshipId, 'profil', 'gemeinsam', 'team')}
        title={text.aside.teamTitle(akte.team.own.length, akte.team.counterpart.length, name)}
        detail={names || undefined}
        wrap
        renderLink={routerLink}
      />
    </RowGroup>
  );
}

/** Tag eines Termins in Berlin (JJJJ-MM-TT) */
function berlinDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}
