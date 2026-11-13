import { useQuery } from '@tanstack/react-query';
import { ReceiptEuroIcon } from 'lucide-react';
import { LinkList } from '@/components/ui/link-list';
import { useCan } from '@/features/auth/use-permissions';
import { useToken } from '@/features/jbp/jbp-pages';
import { ComingPage } from '@/features/shell/coming-page';
import { routerLink } from '@/features/shell/navigation';
import { validationsQueryOptions } from '@/lib/api';
import { useT } from '@/lib/i18n';

/**
 * Wirkung (PLT-11): Pipeline und P&L-Brücke folgen mit PNL-10. Seit PNL-06 führt die Seite zu den
 * Freigaben durch Controlling, mit der Zahl offener Anfragen.
 */
export function ImpactPage() {
  const t = useT();
  const canSee = useCan('wirkung.sehen');
  const accessToken = useToken();
  const validations = useQuery({
    ...validationsQueryOptions(accessToken),
    enabled: accessToken !== '' && canSee,
  });
  const open =
    validations.data?.validations.filter((entry) => entry.status === 'requested').length ?? 0;
  return (
    <>
      <ComingPage
        title={t.impact.title}
        purpose={t.impact.purpose}
        icon={<ReceiptEuroIcon aria-hidden />}
        emptyTitle={t.impact.emptyTitle}
        emptyDescription={t.impact.emptyDescription}
      />
      {canSee && (
        <LinkList
          label={t.impact.validationsTitle}
          renderLink={routerLink}
          items={[
            {
              key: 'freigaben',
              href: '/wirkung/freigaben',
              title: t.impact.toValidations,
              status:
                open > 0
                  ? `${t.impact.toValidationsHint} · ${open} ${t.impact.validationStatuses.requested}`
                  : t.impact.toValidationsHint,
            },
          ]}
        />
      )}
    </>
  );
}
