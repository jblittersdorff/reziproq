import { Link } from '@tanstack/react-router';
import { PlusIcon, ReceiptEuroIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusLine } from '@/components/ui/status-line';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useMe } from '@/features/auth/use-me';
import { PageHeader } from '@/features/shell/page-header';
import { useFlash } from '@/lib/flash';
import { useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { SupplierFrame } from './supplier-frame';

/** Strategie › Spend (PLT-03b): Spend je Jahr als Liste, Jahr hinzufügen oder ändern auf eigener Seite. */
export function SupplierSpendPage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const me = useMe();
  const [message, hideMessage] = useFlash();
  const canEdit = me.data?.permissions.editSuppliers === true;
  const addYear = canEdit && (
    <Button asChild>
      <Link to="/lieferanten/$id/strategie/spend/neu" params={{ id: relationshipId }}>
        <PlusIcon />
        {t.suppliers.addYear}
      </Link>
    </Button>
  );

  return (
    <SupplierFrame
      relationshipId={relationshipId}
      trail={(supplier) => [
        { label: supplier.name, href: `/lieferanten/${relationshipId}/strategie/profil` },
      ]}
      current={t.suppliers.spend}
    >
      {(supplier) => (
        <>
          <PageHeader
            title={`${t.suppliers.spend} · ${supplier.name}`}
            purpose={t.suppliers.spendPurpose}
          />
          {message && <StatusLine message={message} onHidden={hideMessage} />}
          {supplier.spend.length === 0 ? (
            <EmptyState
              size="lg"
              icon={<ReceiptEuroIcon aria-hidden />}
              title={t.suppliers.spendEmptyTitle}
              description={t.suppliers.spendEmptyDescription}
              action={addYear || undefined}
            />
          ) : (
            <>
              <div>{addYear}</div>
              <Table>
                <caption className="sr-only">{t.suppliers.spend}</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.suppliers.spendYear}</TableHead>
                    <TableHead className="text-right">{t.suppliers.spend}</TableHead>
                    {canEdit && <TableHead className="sr-only">{t.suppliers.edit}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.spend.map((entry) => (
                    <TableRow key={entry.year}>
                      <TableCell className="font-medium tabular-nums">{entry.year}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(entry.amount, 'de')}
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <Button asChild variant="ghost">
                            <Link
                              to="/lieferanten/$id/strategie/spend/$jahr"
                              params={{ id: relationshipId, jahr: String(entry.year) }}
                              aria-label={t.suppliers.changeYear(entry.year)}
                            >
                              {t.suppliers.edit}
                            </Link>
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </>
      )}
    </SupplierFrame>
  );
}
