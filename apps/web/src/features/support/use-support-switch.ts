import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { type SupportCustomer, setSupportCustomer } from '@/lib/support';

/**
 * Wechselt in einen Kunden oder verlässt die Betreiber-Ansicht (PLT-13). Danach lädt die App
 * alle Daten neu, damit nie Daten zweier Kunden gleichzeitig im Speicher liegen.
 */
export function useSupportSwitch() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const go = (customer: SupportCustomer | null) => {
    setSupportCustomer(customer);
    // Leert alle Daten und lädt die sichtbaren sofort neu, nun für den neuen Kunden.
    void queryClient.resetQueries();
    void navigate({ to: '/uebersicht' });
  };

  return { enter: (customer: SupportCustomer) => go(customer), leave: () => go(null) };
}
