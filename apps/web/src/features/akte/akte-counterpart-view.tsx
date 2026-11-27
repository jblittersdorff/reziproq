import type { AkteCounterpart, AkteCounterpartItem } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Monogram } from '@/components/ui/monogram';
import { PrivateNote } from '@/components/ui/private-note';
import { Row, RowGroup } from '@/components/ui/row-group';
import { SoWhat, type SoWhatPoint } from '@/components/ui/so-what';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { NextActionCard } from '@/features/start/next-action';
import {
  akteCounterpartQueryOptions,
  invitationsQueryOptions,
  nextActionQueryOptions,
  teamQueryOptions,
} from '@/lib/api';
import { appNow } from '@/lib/clock';
import { useFormat } from '@/lib/format';
import { useLocale, useMessages, useT } from '@/lib/i18n';
import { excerpt, kindCounts, uninvited, waitingItems } from './akte-counterpart';
import { akteCounterpartMessages } from './akte-counterpart-messages';
import { sheetHref } from './akte-sheet';
import { dayMonth, measureText, monthOf, oldPage } from './akte-view';

type Text = (typeof akteCounterpartMessages)['de'];

/**
 * Sicht Von <Gegenüber> (AK-01, K2-c.4, Vorlage K2-Akte-Geteilt): was das Gegenüber aktiv geteilt
 * hat (E-K0-31) als weiße Gruppe mit Petrol-Kante, dazu Das Wichtigste aus belegten Zahlen. Rechts,
 * was das Gegenüber von euch sieht und nie sieht, seine Pflichten aus den Spielregeln und wer von
 * ihm in Reziproq ist.
 */
export function CounterpartView({
  relationshipId,
  name,
}: {
  relationshipId: string;
  name: string;
}) {
  const text = useMessages(akteCounterpartMessages);
  const accessToken = useToken();
  const enabled = accessToken !== '';
  const next = useQuery({ ...nextActionQueryOptions(accessToken, relationshipId), enabled });
  const query = useQuery({ ...akteCounterpartQueryOptions(accessToken, relationshipId), enabled });
  return (
    // Vorlage K2-Akte-Geteilt: Arbeit links, Kontext rechts in einer schmalen Spalte (wie Gemeinsam)
    <div className="grid gap-5.5 wide:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-5.5">
        <NextActionCard next={next.data?.next} />
        {query.data && <Summary data={query.data} relationshipId={relationshipId} name={name} />}
        <Items query={query} relationshipId={relationshipId} name={name} text={text} />
      </div>
      <aside className="flex min-w-0 flex-col gap-5.5">
        <RowGroup tone="shared" label={text.sees.label(name)}>
          <Row
            href={`/beziehungen/${relationshipId}`}
            title={text.sees.title}
            detail={text.sees.detail}
            wrap
            renderLink={routerLink}
          />
        </RowGroup>
        <PrivateNote
          label={text.never.title(name)}
          title={text.never.title(name)}
          chip={text.never.chip}
        >
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {text.never.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </PrivateNote>
        <Duties
          obligations={query.data?.obligations}
          failed={query.isError}
          relationshipId={relationshipId}
          name={name}
          text={text}
        />
        <People relationshipId={relationshipId} name={name} text={text} />
      </aside>
    </div>
  );
}

/** Das Wichtigste: Arten des Geteilten, was davon wartet, Zahl der Pflichten (G-6) */
function Summary({
  data,
  relationshipId,
  name,
}: {
  data: AkteCounterpart;
  relationshipId: string;
  name: string;
}) {
  const text = useMessages(akteCounterpartMessages);
  const summary = text.summary;
  const { locale } = useLocale();
  const counts = kindCounts(data.items);
  const waiting = waitingItems(data.items);
  const latest = data.items[0];
  const statement = [
    latest
      ? summary.shared(
          name,
          counts.map((entry) => summary.kinds[entry.kind](entry.count)),
          dayMonth(latest.at, locale),
        )
      : summary.nothing(name),
    waiting.length > 0 ? summary.waiting(waiting.length) : null,
    data.obligations && data.obligations.items.length > 0
      ? summary.duties(name, data.obligations.items.length, data.obligations.typeName)
      : null,
  ]
    .filter(Boolean)
    .join(' ');
  const points: SoWhatPoint[] = waiting.slice(0, 3).map((item) => {
    const href = hrefOf(item, relationshipId);
    return {
      key: item.id,
      status: item.kind === 'topic' ? summary.proposed : summary.awaiting,
      tone: 'warning',
      text:
        item.kind === 'kpi_value'
          ? text.items.waitingKpi(
              text.items.kpi(
                item.name,
                monthOf(item.period, locale),
                measureText(item.value, item.unit, locale),
              ),
            )
          : item.kind === 'topic'
            ? text.items.waitingTopic(item.title)
            : '',
      ...(href ? { href } : {}),
    };
  });
  return (
    <section aria-label={summary.label}>
      <SoWhat
        heading={summary.heading}
        statement={statement}
        sources={[summary.sources.shared, data.obligations ? summary.sources.rules : null].filter(
          (source): source is string => source !== null,
        )}
        points={points}
        renderLink={routerLink}
      />
    </section>
  );
}

/** Ziel einer Zeile: bis zu ihren Paketen die bisherigen Seiten (E-K2-12) */
function hrefOf(item: AkteCounterpartItem, relationshipId: string): string | undefined {
  switch (item.kind) {
    case 'kpi_value':
      return sheetHref(relationshipId, `kennzahlen/${item.kpiId}`, 'geteilt');
    case 'topic':
    case 'business_update':
      return oldPage(relationshipId, '/plan/themen');
    case 'signature':
      return oldPage(relationshipId, '/plan/scorecard');
    case 'comment':
      return item.objectType === 'meeting'
        ? oldPage(relationshipId, `/umsetzung/termine/${item.objectId}`)
        : item.objectType === 'commitment'
          ? oldPage(relationshipId, `/umsetzung/massnahmen/${item.objectId}`)
          : item.objectType === 'rule_set'
            ? sheetHref(relationshipId, 'spielregeln', 'geteilt')
            : undefined;
  }
}

/** Von <Gegenüber> geteilt: neueste zuerst, weiß mit Petrol-Kante (Designsprache) */
function Items({
  query,
  relationshipId,
  name,
  text,
}: {
  query: { data?: AkteCounterpart | undefined; isError: boolean };
  relationshipId: string;
  name: string;
  text: Text;
}) {
  const { locale } = useLocale();
  const items = query.data?.items ?? [];
  const title = (item: AkteCounterpartItem): string => {
    switch (item.kind) {
      case 'kpi_value':
        return text.items.kpi(
          item.name,
          monthOf(item.period, locale),
          measureText(item.value, item.unit, locale),
        );
      case 'topic':
        return text.items.topic(item.title);
      case 'comment':
        return item.context
          ? text.items.comment(item.context)
          : text.items.commentOn[item.objectType];
      case 'signature':
        return text.items.signature(item.planYear);
      case 'business_update':
        return text.items.update(item.planYear);
    }
  };
  const chip = (item: AkteCounterpartItem) =>
    item.kind === 'kpi_value' && item.awaitingOwn ? (
      <Badge variant="warning">{text.items.chips.awaiting}</Badge>
    ) : item.kind === 'topic' ? (
      <Badge variant={item.status === 'merged' ? 'success' : 'neutral'}>
        {text.items.chips[item.status]}
      </Badge>
    ) : undefined;
  return (
    <div className="flex flex-col gap-2">
      <RowGroup id="geteilt" tone="counterpart" label={text.items.label(name, items.length)}>
        {query.isError ? (
          <Row title={text.failed} />
        ) : !query.data ? (
          <Row title={text.loading} />
        ) : items.length === 0 ? (
          <Row title={text.items.empty} detail={text.items.emptyText(name)} wrap />
        ) : (
          items.map((item) => {
            const href = hrefOf(item, relationshipId);
            const detail = [
              text.items.detail(item.personName, dayMonth(item.at, locale, appNow())),
              item.kind === 'comment'
                ? `„${excerpt(item.body)}“`
                : item.kind === 'business_update'
                  ? excerpt(item.text)
                  : null,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <Row
                key={item.id}
                {...(href ? { href } : {})}
                lead={<Monogram name={item.personName ?? name} tone="petrol" />}
                title={title(item)}
                detail={detail}
                value={chip(item)}
                wrap
                renderLink={routerLink}
              />
            );
          })
        )}
      </RowGroup>
      {query.data && (
        <p className="px-1 text-muted-foreground text-sm">{text.items.footnote(name)}</p>
      )}
    </div>
  );
}

/** Pflichten des Lieferanten aus der zuletzt geteilten Fassung der Spielregeln (PLB-01, SEG-10) */
function Duties({
  obligations,
  failed,
  relationshipId,
  name,
  text,
}: {
  obligations: AkteCounterpart['obligations'] | undefined;
  failed: boolean;
  relationshipId: string;
  name: string;
  text: Text;
}) {
  const t = useT();
  const format = useFormat();
  const { locale } = useLocale();
  const href = sheetHref(relationshipId, 'spielregeln', 'geteilt');
  return (
    <RowGroup id="pflichten" label={text.duties.label(name)}>
      {failed ? (
        <Row title={text.failed} />
      ) : obligations === undefined ? (
        <Row title={text.loading} />
      ) : obligations === null ? (
        <Row
          href={href}
          title={text.duties.none}
          detail={text.duties.noneText(name)}
          wrap
          renderLink={routerLink}
        />
      ) : (
        <>
          {obligations.items.map((item) => (
            <Row
              key={item.id}
              title={item.title[locale]}
              detail={item.cadence ? t.touchpoints.cadences[item.cadence] : text.duties.ongoing}
              wrap
            />
          ))}
          <Row
            href={href}
            title={text.duties.rules(obligations.typeName)}
            detail={text.duties.version(obligations.version, format.date(obligations.sharedAt))}
            wrap
            renderLink={routerLink}
          />
        </>
      )}
    </RowGroup>
  );
}

/** <Gegenüber> in Reziproq: geteilte Mitglieder, Einladungen, Ansprechpartner ohne Einladung */
function People({
  relationshipId,
  name,
  text,
}: {
  relationshipId: string;
  name: string;
  text: Text;
}) {
  return (
    <RowGroup id="team" label={text.people.label(name)}>
      <CounterpartPeopleRows relationshipId={relationshipId} name={name} />
    </RowGroup>
  );
}

/**
 * Zeilen „<Gegenüber> in Reziproq“ aus Team und Einladungen, auch im Blatt Profil (K2-c.5): geteilte
 * Mitglieder „aktiv“, offene und abgelaufene Einladungen, Ansprechpartner ohne Einladung
 */
export function CounterpartPeopleRows({
  relationshipId,
  name,
}: {
  relationshipId: string;
  name: string;
}) {
  const t = useT();
  const text = useMessages(akteCounterpartMessages);
  const format = useFormat();
  const accessToken = useToken();
  const enabled = accessToken !== '';
  const team = useQuery({ ...teamQueryOptions(accessToken, relationshipId), enabled });
  const invitations = useQuery({
    ...invitationsQueryOptions(accessToken, relationshipId),
    enabled,
  });
  const href = oldPage(relationshipId, '/beziehung/team');
  const members = team.data?.counterpart ?? [];
  const open = (invitations.data?.invitations ?? []).filter(
    (entry) => entry.status === 'open' || entry.status === 'expired',
  );
  const missing = uninvited(invitations.data?.suggestions ?? [], members);
  const ready = team.data !== undefined || team.isError;
  if (!ready) return <Row title={text.loading} />;
  if (team.isError) return <Row title={text.failed} />;
  if (members.length === 0 && open.length === 0 && missing.names.length === 0) {
    return (
      <Row
        href={href}
        title={text.people.none(name)}
        detail={text.people.noneText}
        wrap
        renderLink={routerLink}
      />
    );
  }
  return (
    <>
      {members.map((member) => (
        <Row
          key={member.name}
          lead={<Monogram name={member.name} tone="petrol" />}
          title={member.name}
          detail={t.team.supplierRoles[member.teamRole] ?? member.teamRole}
          value={<Badge variant="success">{text.people.active}</Badge>}
          wrap
        />
      ))}
      {open.map((entry) => (
        <Row
          key={entry.id}
          href={href}
          lead={<Monogram name={entry.email} tone="petrol" />}
          title={entry.email}
          detail={
            entry.status === 'open'
              ? text.people.expires(format.date(entry.expiresAt))
              : text.people.expiredOn(format.date(entry.expiresAt))
          }
          value={
            <Badge variant={entry.status === 'open' ? 'warning' : 'neutral'}>
              {entry.status === 'open' ? text.people.invited : text.people.expired}
            </Badge>
          }
          wrap
          renderLink={routerLink}
        />
      ))}
      {missing.names.length > 0 && (
        <Row
          href={href}
          title={text.people.uninvited(missing.names, missing.more)}
          detail={text.people.uninvitedText}
          wrap
          renderLink={routerLink}
        />
      )}
    </>
  );
}
