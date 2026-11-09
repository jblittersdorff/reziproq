import { lastFullYear, type Supplier } from '@reziproq/shared';
import { Link } from '@tanstack/react-router';
import { CircleDashedIcon, CircleOffIcon, StarIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Monogram } from '@/components/ui/monogram';
import { Tile } from '@/components/ui/tile';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';

/**
 * Karte eines Lieferanten (PLT-03, Handschrift A2): Monogramm, Warengruppe und Land klein über dem
 * Namen, der Spend des letzten vollen Jahres als Kennzahl, die eigene Nummer klein daneben. Entwurf und Beendet stehen als Kennzeichen mit Symbol und Text.
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
  const format = useFormat();
  const country = format.country(supplier.country);
  // Warengruppe und Land klein über dem Namen, wie im Entwurf A2; Bezeichnungen nur für Screenreader.
  const facts = [
    { key: 'group', label: t.masterData.assignment.primary, value: supplier.primaryMaterialGroup },
    { key: 'country', label: t.suppliers.country, value: supplier.country ? country : null },
  ].filter((fact) => fact.value);
  return (
    <li className={className}>
      <Tile asChild size="sm" interactive className="h-full gap-3 p-6">
        <Link to="/lieferanten/$id" params={{ id: supplier.relationshipId }}>
          <div className="flex flex-wrap items-center gap-2">
            <Monogram name={supplier.name} emphasis={Boolean(supplier.isFocus)} />
            <span className="grow" />
            {supplier.externalRef && (
              <dl className="whitespace-nowrap text-muted-foreground text-sm">
                <dt className="sr-only">{t.suppliers.externalRef}</dt>
                <dd>{supplier.externalRef}</dd>
              </dl>
            )}
            {supplier.isFocus && (
              <Badge variant="selected">
                <StarIcon aria-hidden />
                {t.portfolio.focusPage.badge}
              </Badge>
            )}
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
          <div className="flex flex-col gap-1">
            {facts.length > 0 && (
              <dl className="flex flex-wrap gap-x-1 font-semibold text-primary text-sm">
                {facts.map((fact, index) => (
                  <div key={fact.key} className="flex">
                    <dt className="sr-only">{fact.label}</dt>
                    <dd>
                      {index > 0 && <span aria-hidden>· </span>}
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <Heading className="text-balance font-bold text-lg leading-snug tracking-title">
              {supplier.name}
            </Heading>
          </div>
          <span className="grow" />
          <p className="flex flex-col-reverse">
            <span className="text-muted-foreground text-sm">
              {t.suppliers.annualSpend(spendYear)}
            </span>
            <span className="font-bold text-xl tabular-nums tracking-title">
              {supplier.spend ? format.money(supplier.spend, { wholeUnits: true }) : '–'}
            </span>
          </p>
        </Link>
      </Tile>
    </li>
  );
}
