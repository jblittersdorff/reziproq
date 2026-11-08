import { type CustomerArea, type CustomerWorkspace, customerAreas } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { EyeOffIcon, InboxIcon, SearchXIcon } from 'lucide-react';
import { useAuth } from 'react-oidc-context';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { LocalBar } from '@/components/ui/local-bar';
import { InLocalBarSlot } from '@/features/shell/local-bar-slot';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { ApiError, customerWorkspaceQueryOptions } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { customerAreaOf, customerPath } from './customer-areas';

function useCustomerWorkspace(relationshipId: string) {
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
    ...customerAreas.map(({ key }) => ({
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

/** Überblick: Kopf mit freigegebenem Typ und nächstem Termin; Kacheln nur für Geteiltes. */
export function CustomerOverviewPage({ relationshipId }: { relationshipId: string }) {
  const text = useT().customers;
  const format = useFormat();
  const query = useCustomerWorkspace(relationshipId);
  if (!query.data) return null;
  const workspace = query.data;
  return (
    <>
      <CustomerPath workspace={workspace} />
      <PageHeader title={workspace.name} purpose={text.overviewPurpose(workspace.name)} />
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground text-sm">{text.relationshipType}</dt>
          <dd className="font-medium">{workspace.relationshipType ?? text.typeNotShared}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground text-sm">{text.nextMeetingLabel}</dt>
          <dd className="font-medium">
            {workspace.nextMeeting ? format.date(workspace.nextMeeting) : text.noneYet}
          </dd>
        </div>
      </dl>
      {/* Noch teilt kein Modul etwas mit dem Lieferanten; Kacheln kommen mit den geteilten Bereichen. */}
      <EmptyState
        size="lg"
        icon={<InboxIcon aria-hidden />}
        title={text.sharedLaterTitle}
        description={text.sharedLater(workspace.name)}
      />
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
  const text = useT().customers;
  const query = useCustomerWorkspace(relationshipId);
  if (!query.data) return null;
  const workspace = query.data;
  const own = area === 'own';
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
