import type * as React from 'react';
import { useId } from 'react';
import { cn } from '@/lib/utils';
import { Card } from './card';

/**
 * Karte mit Abschnittslabel innen (Vorlage Demo-Regie): graues Label in Versalien oben in der weißen
 * Karte, darunter der Inhalt, etwa Pillen, eine Liste oder ein Satz. Wie RowGroup, nur gehört das
 * Label hier zur Karte; für Bereiche mit Knöpfen statt Zeilen.
 */
function SectionCard({
  label,
  className,
  children,
}: {
  label: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const headingId = useId();
  return (
    <Card data-slot="section-card" className={cn('p-5.5', className)}>
      <section aria-labelledby={headingId} className="flex flex-col gap-4">
        <h2
          id={headingId}
          className="font-semibold text-input-border text-sm uppercase tracking-label"
        >
          {label}
        </h2>
        {children}
      </section>
    </Card>
  );
}

export { SectionCard };
