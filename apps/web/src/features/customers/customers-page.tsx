import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { BuildingIcon, CalendarIcon } from 'lucide-react';
import { useAuth } from 'react-oidc-context';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Tile, TileText, TileTitle } from '@/components/ui/tile';
import { PageHeader } from '@/features/shell/page-header';
import { customerListQueryOptions } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { customerAreaFromSegment, customerPath } from './customer-areas';

/**
 * Kunden (LIF-02): Karten aller aktiven Kunden. Kommt die Person über den Kundenwechsel aus einem
 * Bereich (?bereich=…), öffnet die Karte denselben Bereich beim anderen Kunden.
 */
export function CustomersPage({ area: segment }: { area?: string | undefined }) {
  const t = useT();
  const text = t.customers;
  const format = useFormat();
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({ ...customerListQueryOptions(accessToken), enabled: accessToken !== '' });
  const area = customerAreaFromSegment(segment);

  return (
    <>
      <PageHeader title={text.title} purpose={text.purpose} />
      {area && (
        <p className="text-muted-foreground" role="status">
          {text.switchHint(text.areas[area])}
        </p>
      )}
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : query.data.customers.length === 0 ? (
        <EmptyState
          size="lg"
          icon={<BuildingIcon aria-hidden />}
          title={text.emptyTitle}
          description={text.emptyDescription}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.customers.map((customer) => (
            <li key={customer.relationshipId}>
              <Tile asChild interactive className="flex h-full flex-col gap-2">
                <Link to={customerPath(customer.relationshipId, area)} aria-label={customer.name}>
                  <TileTitle className="[overflow-wrap:anywhere]">{customer.name}</TileTitle>
                  <TileText className="flex items-center gap-2">
                    <CalendarIcon aria-hidden className="size-4 shrink-0" />
                    {customer.nextMeeting
                      ? text.nextMeeting(format.date(customer.nextMeeting))
                      : text.noMeeting}
                  </TileText>
                </Link>
              </Tile>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
