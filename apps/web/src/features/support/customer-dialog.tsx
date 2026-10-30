import { useQuery } from '@tanstack/react-query';
import { Building2Icon } from 'lucide-react';
import { useAuth } from 'react-oidc-context';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { customersQueryOptions } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useSupportCustomer } from '@/lib/support';
import { useSupportSwitch } from './use-support-switch';

const countryNames = new Intl.DisplayNames(['de'], { type: 'region' });

/** Auswahl „Kunde wechseln“ für Betreiber (PLT-13). */
export function CustomerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="flex flex-col gap-1 border-border border-b px-5 py-4">
          <DialogTitle className="font-semibold text-lg">{t.support.dialogTitle}</DialogTitle>
          <p className="text-muted-foreground text-sm">{t.support.dialogDescription}</p>
        </div>
        <CustomerList onChosen={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CustomerList({ onChosen }: { onChosen: () => void }) {
  const t = useT();
  const auth = useAuth();
  const current = useSupportCustomer();
  const { enter } = useSupportSwitch();
  const customers = useQuery(customersQueryOptions(auth.user?.access_token ?? ''));

  if (customers.isPending) {
    return (
      <p role="status" className="px-5 py-4 text-muted-foreground">
        {t.support.loading}
      </p>
    );
  }
  if (customers.isError) {
    return (
      <p role="alert" className="px-5 py-4 text-destructive">
        {t.support.failed}
      </p>
    );
  }
  if (customers.data.customers.length === 0) {
    return <p className="px-5 py-4 text-muted-foreground">{t.support.empty}</p>;
  }

  return (
    <ul
      aria-label={t.support.dialogTitle}
      className="flex min-h-0 flex-col gap-1 overflow-y-auto p-3"
    >
      {customers.data.customers.map((customer) => (
        <li key={customer.id}>
          <button
            type="button"
            aria-current={current?.id === customer.id ? 'true' : undefined}
            onClick={() => {
              enter({ id: customer.id, name: customer.name });
              onChosen();
            }}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current]:bg-primary-soft aria-[current]:text-primary-soft-foreground"
          >
            <Building2Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
            <span className="flex flex-1 flex-col">
              <span className="font-medium text-base">{customer.name}</span>
              {customer.country && (
                <span className="text-muted-foreground text-sm">
                  {countryNames.of(customer.country) ?? customer.country}
                </span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
