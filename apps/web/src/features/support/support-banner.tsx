import { EyeIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useMe } from '@/features/auth/use-me';
import { ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useSupportCustomer } from '@/lib/support';
import { useSupportSwitch } from './use-support-switch';

/** Hinweisleiste auf jeder Seite der Betreiber-Ansicht, mit „Verlassen“ (PLT-13). */
export function SupportBanner() {
  const t = useT();
  const customer = useSupportCustomer();
  const me = useMe();
  const { leave } = useSupportSwitch();

  // Lehnt die API den Kunden ab (Rolle entzogen, Kunde gelöscht), endet die Ansicht.
  const rejected = me.error instanceof ApiError && [403, 404].includes(me.error.status);
  useEffect(() => {
    if (customer && rejected) leave();
  }, [customer, rejected, leave]);

  if (!customer) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-lg bg-warning-soft px-4 py-2 text-warning-soft-foreground"
    >
      <EyeIcon aria-hidden className="size-5 shrink-0" />
      <p className="flex-1">{t.support.banner(customer.name)}</p>
      <Button variant="outline" onClick={leave}>
        {t.support.leave}
      </Button>
    </div>
  );
}
