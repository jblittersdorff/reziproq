import { type ChartEmptyText, ChartFrame } from './chart-frame';
import { useChartTheme } from './chart-theme';

export interface TimelineRow {
  label: string;
  /** Monat als „JJJJ-MM“ */
  start: string;
  end: string;
  milestones?: { month: string; label: string }[];
}

const width = 800;
const labelWidth = 220;
const rowHeight = 44;
const axisHeight = 32;

function monthIndex(month: string): number {
  const [year = '0', mon = '1'] = month.split('-');
  return Number(year) * 12 + Number(mon) - 1;
}

/**
 * Zeitachse über mehrere Jahre (PLT-10), z. B. die Roadmap der Initiativen (JBP-03):
 * je Zeile ein Balken, Meilensteine als Rauten, Jahre als Gitter. Farben nur aus Diagramm-Tokens.
 */
export function Timeline({
  title,
  description,
  rows,
  fromYear,
  toYear,
  empty,
}: {
  title: string;
  description?: string;
  rows: TimelineRow[];
  fromYear: number;
  toYear: number;
  empty: ChartEmptyText;
}) {
  const theme = useChartTheme();
  const firstMonth = fromYear * 12;
  const months = (toYear - fromYear + 1) * 12;
  const plotWidth = width - labelWidth;
  const x = (month: string) => labelWidth + ((monthIndex(month) - firstMonth) / months) * plotWidth;
  const height = axisHeight + rows.length * rowHeight;
  const years = Array.from({ length: toYear - fromYear + 1 }, (_, i) => fromYear + i);

  return (
    <ChartFrame title={title} description={description} isEmpty={rows.length === 0} empty={empty}>
      <div role="img" aria-label={title} className="w-full">
        {theme && (
          <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden>
            {years.map((year) => {
              const left = labelWidth + ((year * 12 - firstMonth) / months) * plotWidth;
              return (
                <g key={year}>
                  <line
                    x1={left}
                    x2={left}
                    y1={axisHeight - 8}
                    y2={height}
                    stroke={theme.colors.grid}
                  />
                  <text
                    x={left + 6}
                    y={axisHeight - 14}
                    fill={theme.colors.axis}
                    fontFamily={theme.fontFamily}
                    fontSize={theme.fontSize.sm}
                  >
                    {year}
                  </text>
                </g>
              );
            })}
            {rows.map((row, index) => {
              const top = axisHeight + index * rowHeight;
              const center = top + rowHeight / 2;
              const left = x(row.start);
              const right = x(row.end) + plotWidth / months;
              return (
                <g key={row.label}>
                  <text
                    x={0}
                    y={center + theme.fontSize.sm / 3}
                    fill={theme.colors.label}
                    fontFamily={theme.fontFamily}
                    fontSize={theme.fontSize.sm}
                  >
                    {row.label}
                  </text>
                  <rect
                    x={left}
                    y={center - 8}
                    width={Math.max(right - left, 4)}
                    height={16}
                    rx={8}
                    fill={theme.colors.accent}
                  />
                  {row.milestones?.map((milestone) => {
                    const mx = x(milestone.month) + plotWidth / months / 2;
                    return (
                      <polygon
                        key={milestone.label}
                        points={`${mx},${center - 10} ${mx + 10},${center} ${mx},${center + 10} ${mx - 10},${center}`}
                        fill={theme.colors.strong}
                        stroke={theme.colors.surface}
                        strokeWidth={2}
                      >
                        <title>{milestone.label}</title>
                      </polygon>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </ChartFrame>
  );
}
