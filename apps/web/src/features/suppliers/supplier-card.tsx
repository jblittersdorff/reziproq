import { lastFullYear, type Supplier } from '@reziproq/shared';
import { Link } from '@tanstack/react-router';
import { CircleDashedIcon, CircleOffIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tile } from '@/components/ui/tile';
import { useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';

const countryNames = new Intl.DisplayNames(['de'], { type: 'region' });

/**
 * Karte eines Lieferanten (PLT-03): Name als größte Schrift, Land, eigene Nummer und der Spend des
 * letzten vollen Jahres rechtsbündig. Entwurf und Beendet stehen als Kennzeichen mit Symbol und Text.
 * Erscheint auf der Lieferantenseite und als Treffer auf der Fragen-Seite (PLT-12); die ganze
 * Karte führt zum Profil des Lieferanten (PLT-03b).
 */
export function SupplierCard({
  supplier,
  spendYear = lastFullYear(),
  headingLevel = 2,
  className,
}: {
  supplier: Supplier;
  spendYear?: number;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const t = useT();
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const country = supplier.country ? (countryNames.of(supplier.country) ?? supplier.country) : '–';
  return (
    <li className={className}>
      <Tile asChild size="sm" interactive className="h-full">
        <Link to="/lieferanten/$id/strategie/profil" params={{ id: supplier.relationshipId }}>
          <div className="flex flex-col items-start gap-2">
            <Heading className="font-semibold text-lg">{supplier.name}</Heading>
            {supplier.status === 'draft' && (
              <Badge>
                <CircleDashedIcon aria-hidden />
                {t.suppliers.statusDraft}
              </Badge>
            )}
            {supplier.status === 'ended' && (
              <Badge>
                <CircleOffIcon aria-hidden />
                {t.suppliers.statusEnded}
              </Badge>
            )}
          </div>
          <dl className="flex flex-1 flex-col gap-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">{t.suppliers.country}</dt>
              <dd>{country}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">{t.suppliers.externalRef}</dt>
              <dd>{supplier.externalRef ?? '–'}</dd>
            </div>
          </dl>
          <p className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground text-sm">
              {t.suppliers.annualSpend(spendYear)}
            </span>
            <span className="font-semibold text-base tabular-nums">
              {supplier.spend ? formatMoney(supplier.spend, 'de', { wholeUnits: true }) : '–'}
            </span>
          </p>
        </Link>
      </Tile>
    </li>
  );
}
