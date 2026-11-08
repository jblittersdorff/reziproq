import { EyeIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useMe } from '@/features/auth/use-me';
import { ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useSupportCustomer } from '@/lib/support';
import { useSupportSwitch } from './use-support-switch';

/**
 * Hinweisleiste auf jeder Seite der Betreiber-Ansicht, mit „Verlassen“ (PLT-13). Schmal über der
 * globalen Leiste, damit sie den Inhalt nicht verdrängt.
 */
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
      data-slot="support-banner"
      className="flex flex-wrap items-center justify-center gap-x-3 bg-warning-soft px-4 text-sm text-warning-soft-foreground"
    >
      <EyeIcon aria-hidden className="size-4 shrink-0" />
      <p>{t.support.banner(customer.name)}</p>
      <Button
        variant="link"
        size="sm"
        onClick={leave}
        // 44 px Klickfläche (PLT-10); so hoch ist auch die Leiste, eine Zeile.
        className="h-11 px-1 font-semibold text-warning-soft-foreground"
      >
        {t.support.leave}
      </Button>
    </div>
  );
}
