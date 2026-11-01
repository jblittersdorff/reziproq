import type { SuppliersResponse } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { useMe } from '@/features/auth/use-me';
import { suppliersQueryOptions } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import type { Messages } from '@/locales/de';

/**
 * Lieferantenliste der eigenen Organisation. Angefragt wird sie nur, wenn die API in /me
 * meldet, dass die Person sie sehen darf (can() im Backend).
 */
export function useSuppliers() {
  const auth = useAuth();
  const me = useMe();
  const allowed = me.data?.permissions.viewSuppliers === true;
  const query = useQuery({
    ...suppliersQueryOptions(auth.user?.access_token ?? ''),
    enabled: allowed,
  });
  return { me, allowed, ...query };
}

/** „15 Lieferanten · 32.110.000 € Jahresspend 2025“ für die Kopfzeile, ohne Beendete. */
export function supplierSummary(data: SuppliersResponse, t: Messages): string {
  const totals = data.totalSpend.map((money) =>
    t.suppliers.totalSpend(formatMoney(money, 'de', { wholeUnits: true }), data.spendYear),
  );
  return [t.suppliers.count(data.count), ...totals].join(' · ');
}
