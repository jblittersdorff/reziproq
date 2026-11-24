export interface GoalMetric {
  label: string;
  actual: number;
  target: number | null;
  /** Formatiert Zahl, Ziel und Einheit gemeinsam in der Sprache der Seite. */
  format: (actual: number, target: number | null) => string;
}

function hasTarget(metric: GoalMetric) {
  return (
    Number.isFinite(metric.actual) &&
    metric.target !== null &&
    Number.isFinite(metric.target) &&
    metric.target > 0
  );
}

function Ring({
  metric,
  radius,
  center,
  width,
  inner = false,
}: {
  metric: GoalMetric;
  radius: number;
  center: number;
  width: number;
  inner?: boolean;
}) {
  if (!hasTarget(metric) || metric.target === null) return null;
  const fraction = Math.max(0, Math.min(1, metric.actual / metric.target));
  return (
    <g fill="none" strokeWidth={width}>
      <circle cx={center} cy={center} r={radius} className="stroke-track" />
      {fraction > 0 && (
        <circle
          cx={center}
          cy={center}
          r={radius}
          pathLength={1}
          transform={`rotate(-90 ${center} ${center})`}
          strokeDasharray={`${fraction} 1`}
          strokeLinecap="round"
          className={inner ? 'stroke-mint' : 'stroke-petrol'}
        />
      )}
    </g>
  );
}

/** Außen das Ergebnis, innen die Beziehung. Ohne Bezugsgröße bleibt die Zahl sichtbar. */
export function GoalRings({
  result,
  relationships,
  compact = false,
}: {
  result: GoalMetric;
  relationships?: GoalMetric;
  /** Für schmale Spalten (Lieferanten-Überblick rechts): kleinerer Ring, Zahlen wie Kennzahlen */
  compact?: boolean;
}) {
  const metrics = relationships ? [result, relationships] : [result];
  return (
    <div
      data-slot="goal-rings"
      className={
        relationships
          ? 'grid items-center gap-5 sm:flex sm:flex-wrap sm:gap-8'
          : 'flex items-center gap-4'
      }
    >
      {metrics.some(hasTarget) && (
        <svg
          role="img"
          aria-label={metrics
            .map((metric) => `${metric.label}: ${metric.format(metric.actual, metric.target)}`)
            .join(', ')}
          focusable="false"
          viewBox={relationships ? '0 0 240 240' : '0 0 56 56'}
          className={
            relationships
              ? compact
                ? 'size-36 max-w-full shrink-0'
                : 'size-55 max-w-full shrink-0 sm:size-60'
              : 'size-14 shrink-0'
          }
        >
          {relationships ? (
            <>
              <Ring metric={result} radius={104} center={120} width={22} />
              <Ring metric={relationships} radius={74} center={120} width={22} inner />
            </>
          ) : (
            <Ring metric={result} radius={24} center={28} width={7} />
          )}
        </svg>
      )}
      {/* Mit Grundbreite: in schmalen Karten rutschen die Zahlen unter das Ringpaar statt neben
          ihm zu schrumpfen und über den Rand zu laufen. */}
      <dl className="flex min-w-0 flex-1 basis-56 flex-col gap-5">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <dt className="font-semibold text-muted-strong text-sm">{metric.label}</dt>
            <dd
              className={
                relationships && !compact
                  ? 'font-display font-semibold text-figure tabular-nums tracking-section sm:text-evidence'
                  : relationships
                    ? 'font-display font-semibold text-section tabular-nums tracking-section'
                    : 'font-display font-semibold text-section tabular-nums'
              }
            >
              {metric.format(metric.actual, hasTarget(metric) ? metric.target : null)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
