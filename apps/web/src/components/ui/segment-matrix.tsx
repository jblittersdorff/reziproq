import { cn } from '@/lib/utils';
import { defaultRenderLink, type RenderLink } from './nav-link';

export interface SegmentMatrixName {
  key: string;
  label: string;
  /** Segment strittig: gelber Rand und das Wort aus `disputedLabel` (Status immer als Text) */
  disputed?: boolean | undefined;
}

export interface SegmentMatrixField {
  key: string;
  /** Name des Segments, z. B. „Strategisch“ */
  name: string;
  count: number;
  /** Spend als Text, z. B. „18,4 Mio. €“ */
  value?: string | undefined;
  /** Lage für Screenreader, z. B. „Versorgungsrisiko hoch, Wertbeitrag hoch“ */
  position?: string | undefined;
  /** Das Feld mit beiden höchsten Stufen: Fläche Mint */
  top?: boolean | undefined;
  names: SegmentMatrixName[];
  /** z. B. „und 5 weitere“; ohne Angabe nichts */
  rest?: string | undefined;
  /** Ziel des Felds, z. B. die Liste mit Filter Segment */
  href?: string | undefined;
}

/**
 * Segment-Matrix (Vorlage K2-Segmente; Designsprache, Diagramme: „Wo stehen die Lieferanten?“):
 * die Felder des Segmentmodells, 2 × 2 oder 3 × 3, in der Folge der Zeilen (höchster Impact oben)
 * und Spalten (höchste Qualität rechts). Je Feld Name und Zahl in Outfit, Spend grau, Namen als
 * weiße Pillen und „und N weitere“; ein strittiges Segment trägt den gelben Rand und das Wort
 * dazu (auf dem Telefon nur für Screenreader). Das Feld mit beiden höchsten Stufen ist Mint, die
 * übrigen `paper`. Ein Feld mit Ziel ist als Ganzes ein Link. Bei 3 × 3 zeigt das Telefon nur Name,
 * Zahl und Spend, damit nichts seitwärts schiebt.
 */
function SegmentMatrix({
  size,
  fields,
  label,
  disputedLabel,
  renderLink = defaultRenderLink,
  className,
}: {
  size: 2 | 3;
  /** In Lesefolge: Zeile für Zeile von oben, in der Zeile von links */
  fields: SegmentMatrixField[];
  /** Name der Matrix für Screenreader */
  label: string;
  /** z. B. „strittig“ */
  disputedLabel: string;
  renderLink?: RenderLink;
  className?: string;
}) {
  return (
    <ul
      aria-label={label}
      data-slot="segment-matrix"
      className={cn('grid gap-2.5', size === 2 ? 'grid-cols-2' : 'grid-cols-3', className)}
    >
      {fields.map((field) => {
        const body = (
          <>
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <b className="font-display font-semibold text-flow text-ink">
                {field.name} · {field.count}
              </b>
              {field.value && (
                <span className="text-detail text-muted-foreground tabular-nums">
                  {field.value}
                </span>
              )}
              {field.position && <span className="sr-only">{field.position}</span>}
            </span>
            {(field.names.length > 0 || field.rest) && (
              <span className={cn('flex flex-wrap gap-1.5', size === 3 && 'hidden shell:flex')}>
                {field.names.map((name) => (
                  <span
                    key={name.key}
                    data-disputed={name.disputed ? 'true' : undefined}
                    className={cn(
                      'inline-flex max-w-full items-center gap-1 rounded-full bg-card px-2 py-1 text-foreground text-sm shell:px-2.5',
                      name.disputed && 'ring-2 ring-signal-amber ring-inset',
                    )}
                  >
                    <span className="truncate">{name.label}</span>
                    {name.disputed && (
                      // Bewusst abweichend auf dem Telefon: Dort trägt der gelbe Rand mit der Legende
                      // unter der Matrix den Status, das Wort hören nur Screenreader; sonst bliebe vom
                      // Namen im schmalen Feld nur „Kessler …“. Das Leerzeichen vorn ist für Screenreader.
                      <span className="sr-only shrink-0 text-muted-foreground shell:not-sr-only">
                        {` · ${disputedLabel}`}
                      </span>
                    )}
                  </span>
                ))}
                {field.rest && (
                  <span className="inline-flex max-w-full items-center rounded-full bg-card px-2 py-1 text-muted-strong text-sm shell:px-2.5">
                    <span className="truncate">{field.rest}</span>
                  </span>
                )}
              </span>
            )}
          </>
        );
        const area = cn(
          'flex h-full min-h-36 min-w-0 flex-col gap-2 rounded-md p-2.5 shell:p-3.5',
          field.top ? 'bg-mint-soft' : 'bg-paper',
        );
        return (
          <li key={field.key} className="min-w-0">
            {field.href ? (
              renderLink({
                href: field.href,
                className: cn(
                  area,
                  'no-underline transition-shadow hover:ring-2 hover:ring-line hover:ring-inset focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                ),
                children: body,
              })
            ) : (
              <div className={area}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export { SegmentMatrix };
