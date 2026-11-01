import { useQuery } from '@tanstack/react-query';
import { Building2Icon, LockIcon } from 'lucide-react';
import { useAuth } from 'react-oidc-context';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Tile, TileText, TileTitle } from '@/components/ui/tile';
import { useMe } from '@/features/auth/use-me';
import { PagePath } from '@/features/shell/page-path';
import { PageHeader } from '@/features/shell/page-header';
import { ApiError, customersQueryOptions } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useSupportSwitch } from './use-support-switch';


/**
 * In einen Kunden wechseln (UMB-01) als eigene Seite statt Fenster: die Kunden als Kacheln, ein
 * Klick wechselt und führt zu Start. Nur für Betreiber (is_operator); entscheidend ist die API.
 */
export function CustomersPage() {
  const t = useT();
  const format = useFormat();
  const auth = useAuth();
  const me = useMe();
  const { enter } = useSupportSwitch();
  const accessToken = auth.user?.access_token ?? '';
  const operator = me.data?.isOperator === true;
  const customers = useQuery({
    ...customersQueryOptions(accessToken),
    enabled: accessToken !== '' && operator,
  });
  const denied =
    (me.data && !operator) ||
    (customers.error instanceof ApiError && customers.error.status === 403);

  return (
    <>
      <PagePath trail={[{ label: t.profile.title, href: '/profil' }]} current={t.support.title} />
      <PageHeader title={t.support.title} purpose={t.support.purpose} />
      {denied ? (
        <EmptyState
          size="lg"
          icon={<LockIcon aria-hidden />}
          title={t.support.onlyOperators}
          description={t.support.purpose}
        />
      ) : customers.isError || me.isError ? (
        <ErrorState title={t.support.failed} />
      ) : !customers.data ? (
        <LoadingState label={t.support.loading} />
      ) : customers.data.customers.length === 0 ? (
        <EmptyState
          size="lg"
          icon={<Building2Icon aria-hidden />}
          title={t.support.empty}
          description={t.support.emptyDescription}
        />
      ) : (
        <div className="@container">
          <ul aria-label={t.support.title} className="grid gap-4 @xl:grid-cols-2 @3xl:grid-cols-3">
            {customers.data.customers.map((customer) => (
              <li key={customer.id}>
                <Tile asChild interactive className="h-full w-full text-left">
                  <button
                    type="button"
                    aria-label={t.support.open(customer.name)}
                    onClick={() => enter({ id: customer.id, name: customer.name })}
                  >
                    <TileTitle>{customer.name}</TileTitle>
                    <TileText>
                      {format.country(customer.country)}
                    </TileText>
                  </button>
                </Tile>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
