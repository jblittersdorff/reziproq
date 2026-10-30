import type { Supplier } from '@reziproq/shared';
import { Tile } from '@/components/ui/tile';
import { useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';

const countryNames = new Intl.DisplayNames(['de'], { type: 'region' });

/**
 * Karte eines Lieferanten (PLT-02): Name als größte Schrift, Spend rechtsbündig.
 * Erscheint auf der Lieferantenseite und als Treffer im Prompt-Fenster (PLT-12).
 */
export function SupplierCard({
  supplier,
  headingLevel = 2,
  className,
}: {
  supplier: Supplier;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const t = useT();
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const country = supplier.country ? (countryNames.of(supplier.country) ?? supplier.country) : '–';
  return (
    <Tile asChild size="sm" className={className}>
      <li>
        <Heading className="font-semibold text-lg">{supplier.name}</Heading>
        <dl className="flex flex-1 flex-col gap-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t.suppliers.country}</dt>
            <dd>{country}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t.suppliers.category}</dt>
            <dd>{supplier.category}</dd>
          </div>
        </dl>
        <p className="flex items-baseline justify-between gap-2">
          <span className="text-muted-foreground text-sm">
            {t.suppliers.annualSpend(supplier.spendYear)}
          </span>
          <span className="font-semibold text-base tabular-nums">
            {formatMoney(supplier.annualSpend, 'de', { wholeUnits: true })}
          </span>
        </p>
      </li>
    </Tile>
  );
}
