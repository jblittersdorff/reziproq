import { type CustomerArea, type CustomerWorkspace, customerAreas } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import {
  BadgeCheckIcon,
  CalendarDaysIcon,
  EyeOffIcon,
  GaugeIcon,
  HandHeartIcon,
  HandshakeIcon,
  InboxIcon,
  ListChecksIcon,
  ListOrderedIcon,
  MessagesSquareIcon,
  ScaleIcon,
  SearchXIcon,
  TargetIcon,
} from 'lucide-react';
import { useAuth } from 'react-oidc-context';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LinkList } from '@/components/ui/link-list';
import { LoadingState } from '@/components/ui/loading-state';
import { LocalBar } from '@/components/ui/local-bar';
import { Stage, StageFacts } from '@/components/ui/stage';
import { Tile, TileIcon, TileText, TileTitle } from '@/components/ui/tile';
import { VisibilityBadge } from '@/components/ui/visibility-badge';
import { SharedView } from '@/features/playbook/rule-set-pages';
import { InLocalBarSlot } from '@/features/shell/local-bar-slot';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader, useDocumentTitle } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { InStageSlot } from '@/features/shell/stage-slot';
import { ApiError, customerRuleSetQueryOptions, customerWorkspaceQueryOptions } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { builtCustomerAreas, customerAreaOf, customerPath } from './customer-areas';

export function useCustomerWorkspace(relationshipId: string) {
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  return useQuery({
    ...customerWorkspaceQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
}

/**
 * Arbeitsbereich eines Kunden für die Lieferantenseite (LIF-02): lokale Leiste mit Kundenname und
 * den Bereichen, ohne Strategie. Der Kundenname führt zum Kundenwechsel und nimmt den aktuellen
 * Bereich mit. Hier liegen Lade-, Fehler- und Nicht-gefunden-Zustand für alle Seiten des Kunden.
 */
export function CustomerWorkspaceLayout({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = t.customers;
  const query = useCustomerWorkspace(relationshipId);
  const area = useRouterState({ select: (state) => customerAreaOf(state.location.pathname) });
  const root = { label: text.title, href: '/kunden' };

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    const title = notFound ? text.notFoundTitle : text.detailFailed;
    return (
      <>
        <PagePath trail={[root]} current={title} />
        {notFound ? (
          <EmptyState
            size="lg"
            icon={<SearchXIcon aria-hidden />}
            title={text.notFoundTitle}
            description={text.notFoundDescription}
          />
        ) : (
          <>
            <PageHeader title={text.title} />
            <ErrorState title={text.detailFailed} />
          </>
        )}
      </>
    );
  }
  if (!query.data) {
    return (
      <>
        <PageHeader title={text.title} />
        <LoadingState label={text.detailLoading} />
      </>
    );
  }

  const segment = customerAreas.find((entry) => entry.key === area)?.segment;
  const items = [
    { key: 'overview', label: text.overview, href: customerPath(relationshipId) },
    ...customerAreas
      .filter(({ key }) => builtCustomerAreas.includes(key))
      .map(({ key }) => ({
        key,
        label: text.areas[key],
        href: customerPath(relationshipId, key),
      })),
  ];
  return (
    <>
      <InLocalBarSlot>
        <LocalBar
          label={text.workspaceLabel}
          name={query.data.name}
          nameHref={segment ? `/kunden?bereich=${segment}` : '/kunden'}
          items={items}
          activeKey={area ?? 'overview'}
          renderLink={routerLink}
        />
      </InLocalBarSlot>
      <Outlet />
    </>
  );
}

/** Pfad über den Seiten des Kunden: Kunden › Name › Bereich. */
function CustomerPath({ workspace, area }: { workspace: CustomerWorkspace; area?: CustomerArea }) {
  const text = useT().customers;
  return (
    <PagePath
      trail={[
        { label: text.title, href: '/kunden' },
        ...(area ? [{ label: workspace.name, href: customerPath(workspace.relationshipId) }] : []),
      ]}
      current={area ? text.areas[area] : workspace.name}
    />
  );
}

/**
 * Überblick: helle Bühne mit Name, freigegebenem Typ und nächstem Termin (PLT-10); Kacheln nur
 * für Geteiltes.
 */
export function CustomerOverviewPage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = t.customers;
  const format = useFormat();
  const query = useCustomerWorkspace(relationshipId);
  useDocumentTitle(query.data ? `${query.data.name} · ${text.overview}` : text.overview);
  if (!query.data) return null;
  const workspace = query.data;
  return (
    <>
      <InStageSlot>
        <Stage
          tone="light"
          path={<CustomerPath workspace={workspace} />}
          eyebrow={text.overview}
          title={workspace.name}
          text={text.overviewPurpose(workspace.name)}
          aside={
            <StageFacts
              label={text.overview}
              items={[
                {
                  key: 'type',
                  label: text.relationshipType,
                  value: workspace.relationshipType ?? text.typeNotShared,
                  muted: !workspace.relationshipType,
                },
                {
                  key: 'nextMeeting',
                  label: text.nextMeetingLabel,
                  value: workspace.nextMeeting ? format.date(workspace.nextMeeting) : text.noneYet,
                  muted: !workspace.nextMeeting,
                },
              ]}
            />
          }
        />
      </InStageSlot>
      {/* Nur Gebautes (UMB-05): je Bereich die geteilten Seiten als Zeilen. */}
      <section aria-labelledby="kunde-beziehung" className="flex flex-col gap-3">
        <h2 id="kunde-beziehung" className="font-bold text-xl tracking-title">
          {text.areas.relationship}
        </h2>
        <LinkList
          label={text.areas.relationship}
          renderLink={routerLink}
          items={[
            {
              key: 'team',
              href: `${customerPath(relationshipId, 'relationship')}/team`,
              title: t.team.title,
              status: text.teamHint,
            },
            {
              key: 'touchpoints',
              href: `${customerPath(relationshipId, 'relationship')}/kontaktpunkte`,
              title: t.touchpoints.title,
              status: text.touchpointsHint,
            },
            {
              key: 'rules',
              href: `${customerPath(relationshipId, 'relationship')}/spielregeln`,
              title: text.rulesTitle,
              status: text.rulesHint,
            },
          ]}
        />
      </section>
      <section aria-labelledby="kunde-plan" className="flex flex-col gap-3">
        <h2 id="kunde-plan" className="font-bold text-xl tracking-title">
          {text.areas.plan}
        </h2>
        <LinkList
          label={text.areas.plan}
          renderLink={routerLink}
          items={[
            {
              key: 'preparation',
              href: `${customerPath(relationshipId, 'plan')}/vorbereitung`,
              title: t.jbp.title,
              status: t.jbp.purpose,
            },
            {
              key: 'topics',
              href: `${customerPath(relationshipId, 'plan')}/themen`,
              title: t.jbp.topics.title,
              status: t.jbp.topics.purpose,
            },
            {
              key: 'initiatives',
              href: `${customerPath(relationshipId, 'plan')}/initiativen`,
              title: t.jbp.initiatives.title,
              status: t.jbp.initiatives.purpose,
            },
            {
              key: 'commitments',
              href: `${customerPath(relationshipId, 'plan')}/zusagen`,
              title: t.jbp.commitments.title,
              status: t.jbp.commitments.purpose,
            },
            {
              key: 'approval',
              href: `${customerPath(relationshipId, 'plan')}/freigabe`,
              title: t.jbp.approval.title,
              status: t.jbp.approval.purpose,
            },
            {
              key: 'scorecard',
              href: `${customerPath(relationshipId, 'plan')}/scorecard`,
              title: t.jbp.scorecard.title,
              status: t.jbp.scorecard.purpose,
            },
          ]}
        />
      </section>
      <section aria-labelledby="kunde-umsetzung" className="flex flex-col gap-3">
        <h2 id="kunde-umsetzung" className="font-bold text-xl tracking-title">
          {text.areas.execution}
        </h2>
        <LinkList
          label={text.areas.execution}
          renderLink={routerLink}
          items={[
            {
              key: 'meetings',
              href: `${customerPath(relationshipId, 'execution')}/termine`,
              title: text.meetingsTitle,
              status: text.meetingsHint,
            },
            {
              key: 'actions',
              href: `${customerPath(relationshipId, 'execution')}/massnahmen`,
              title: t.actions.title,
              status: t.actions.purpose,
            },
          ]}
        />
      </section>
    </>
  );
}

/** Ein Bereich beim Kunden; leer erklärt er, was der Kunde noch teilen wird. */
export function CustomerAreaPage({
  relationshipId,
  area,
}: {
  relationshipId: string;
  area: CustomerArea;
}) {
  const t = useT();
  const text = t.customers;
  const query = useCustomerWorkspace(relationshipId);
  if (!query.data) return null;
  const workspace = query.data;
  const own = area === 'own';
  if (area === 'execution') {
    return (
      <>
        <CustomerPath workspace={workspace} area={area} />
        <PageHeader title={text.areas[area]} purpose={text.areaPurpose[area]} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Tile asChild interactive className="flex flex-col gap-3">
            <Link to="/kunden/$id/umsetzung/termine" params={{ id: relationshipId }}>
              <TileIcon>
                <CalendarDaysIcon aria-hidden />
              </TileIcon>
              <TileTitle>{text.meetingsTitle}</TileTitle>
              <TileText>{text.meetingsHint}</TileText>
            </Link>
          </Tile>
          <Tile asChild interactive className="flex flex-col gap-3">
            <Link to="/kunden/$id/umsetzung/massnahmen" params={{ id: relationshipId }}>
              <TileIcon>
                <ListChecksIcon aria-hidden />
              </TileIcon>
              <TileTitle>{t.actions.title}</TileTitle>
              <TileText>{t.actions.purpose}</TileText>
            </Link>
          </Tile>
        </div>
      </>
    );
  }
  if (area === 'plan') {
    return (
      <>
        <CustomerPath workspace={workspace} area={area} />
        <PageHeader title={text.areas[area]} purpose={text.areaPurpose[area]} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Tile asChild interactive className="flex flex-col gap-3">
            <Link to="/kunden/$id/plan/vorbereitung" params={{ id: relationshipId }}>
              <TileIcon>
                <HandshakeIcon aria-hidden />
              </TileIcon>
              <TileTitle>{t.jbp.title}</TileTitle>
              <TileText>{t.jbp.purpose}</TileText>
            </Link>
          </Tile>
          <Tile asChild interactive className="flex flex-col gap-3">
            <Link to="/kunden/$id/plan/themen" params={{ id: relationshipId }}>
              <TileIcon>
                <ListOrderedIcon aria-hidden />
              </TileIcon>
              <TileTitle>{t.jbp.topics.title}</TileTitle>
              <TileText>{t.jbp.topics.purpose}</TileText>
            </Link>
          </Tile>
          <Tile asChild interactive className="flex flex-col gap-3">
            <Link to="/kunden/$id/plan/initiativen" params={{ id: relationshipId }}>
              <TileIcon>
                <TargetIcon aria-hidden />
              </TileIcon>
              <TileTitle>{t.jbp.initiatives.title}</TileTitle>
              <TileText>{t.jbp.initiatives.purpose}</TileText>
            </Link>
          </Tile>
          <Tile asChild interactive className="flex flex-col gap-3">
            <Link to="/kunden/$id/plan/zusagen" params={{ id: relationshipId }}>
              <TileIcon>
                <HandHeartIcon aria-hidden />
              </TileIcon>
              <TileTitle>{t.jbp.commitments.title}</TileTitle>
              <TileText>{t.jbp.commitments.purpose}</TileText>
            </Link>
          </Tile>
          <Tile asChild interactive className="flex flex-col gap-3">
            <Link to="/kunden/$id/plan/freigabe" params={{ id: relationshipId }}>
              <TileIcon>
                <BadgeCheckIcon aria-hidden />
              </TileIcon>
              <TileTitle>{t.jbp.approval.title}</TileTitle>
              <TileText>{t.jbp.approval.purpose}</TileText>
            </Link>
          </Tile>
          <Tile asChild interactive className="flex flex-col gap-3">
            <Link to="/kunden/$id/plan/scorecard" params={{ id: relationshipId }}>
              <TileIcon>
                <GaugeIcon aria-hidden />
              </TileIcon>
              <TileTitle>{t.jbp.scorecard.title}</TileTitle>
              <TileText>{t.jbp.scorecard.purpose}</TileText>
            </Link>
          </Tile>
        </div>
      </>
    );
  }
  if (area === 'relationship') {
    return (
      <>
        <CustomerPath workspace={workspace} area={area} />
        <PageHeader title={text.areas[area]} purpose={text.areaPurpose[area]} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Tile asChild interactive className="flex flex-col gap-3">
            <Link to="/kunden/$id/beziehung/spielregeln" params={{ id: relationshipId }}>
              <TileIcon>
                <ScaleIcon aria-hidden />
              </TileIcon>
              <TileTitle>{text.rulesTitle}</TileTitle>
              <TileText>{text.rulesHint}</TileText>
            </Link>
          </Tile>
          <Tile asChild interactive className="flex flex-col gap-3">
            <Link to="/kunden/$id/beziehung/feedback" params={{ id: relationshipId }}>
              <TileIcon>
                <MessagesSquareIcon aria-hidden />
              </TileIcon>
              <TileTitle>{t.feedback.title}</TileTitle>
              <TileText>{t.feedback.emptyHint}</TileText>
            </Link>
          </Tile>
        </div>
      </>
    );
  }
  return (
    <>
      <CustomerPath workspace={workspace} area={area} />
      <PageHeader title={text.areas[area]} purpose={text.areaPurpose[area]} />
      <EmptyState
        size="lg"
        icon={own ? <EyeOffIcon aria-hidden /> : <InboxIcon aria-hidden />}
        title={own ? text.ownLaterTitle : text.sharedLaterTitle}
        description={own ? text.ownLater : text.sharedLater(workspace.name)}
      />
    </>
  );
}

/** Beziehung › Spielregeln beim Kunden (SEG-10): der geteilte Stand, gekennzeichnet „Geteilt am …“. */
export function CustomerRulesPage({ relationshipId }: { relationshipId: string }) {
  const text = useT().customers;
  const format = useFormat();
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const workspace = useCustomerWorkspace(relationshipId);
  const query = useQuery({
    ...customerRuleSetQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  if (!workspace.data) return null;
  const name = workspace.data.name;
  const target = query.data?.target;
  return (
    <>
      <PagePath
        trail={[
          { label: text.title, href: '/kunden' },
          { label: name, href: customerPath(relationshipId) },
          { label: text.areas.relationship, href: customerPath(relationshipId, 'relationship') },
        ]}
        current={text.rulesTitle}
      />
      <PageHeader
        title={text.rulesTitle}
        purpose={text.rulesPurpose}
        badge={
          target && (
            <VisibilityBadge
              visibility="shared"
              label={text.sharedOn(format.date(target.sharedAt))}
            />
          )
        }
      />
      {query.isError ? (
        <ErrorState title={text.rulesFailed} />
      ) : !query.data ? (
        <LoadingState label={text.rulesLoading} />
      ) : !target ? (
        <EmptyState
          size="lg"
          icon={<InboxIcon aria-hidden />}
          title={text.rulesEmptyTitle}
          description={text.rulesEmpty(name)}
        />
      ) : (
        <SharedView
          typeName={target.typeName}
          typeDescription={target.typeDescription}
          items={query.data.items}
        />
      )}
    </>
  );
}
