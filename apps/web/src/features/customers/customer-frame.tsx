import type { CustomerArea } from '@reziproq/shared';
import type { ReactNode } from 'react';
import { PagePath } from '@/features/shell/page-path';
import { useT } from '@/lib/i18n';
import { customerPath } from './customer-areas';
import { useCustomerWorkspace } from './customer-workspace';

type Trail = { label: string; href: string }[];

/** Pfad der Lieferantenseite: Kunden › Kunde › Bereich › weitere Ebenen (LIF-02). */
export function CustomerFrame({
  relationshipId,
  area = 'relationship',
  trail = [],
  current,
  children,
}: {
  relationshipId: string;
  area?: CustomerArea;
  trail?: Trail;
  current: string;
  children: ReactNode;
}) {
  const t = useT();
  const workspace = useCustomerWorkspace(relationshipId);
  return (
    <>
      <PagePath
        trail={[
          { label: t.customers.title, href: '/kunden' },
          ...(workspace.data
            ? [{ label: workspace.data.name, href: customerPath(relationshipId) }]
            : []),
          // Ist der Bereich selbst die Seite, steht er nur einmal, als aktuelle Seite.
          ...(current === t.customers.areas[area] && trail.length === 0
            ? []
            : [{ label: t.customers.areas[area], href: customerPath(relationshipId, area) }]),
          ...trail,
        ]}
        current={current}
      />
      {children}
    </>
  );
}
