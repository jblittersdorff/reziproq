import type {
  SurveyDimensionResult,
  SurveyFunction,
  SurveyResults,
  SurveySide,
} from '@reziproq/shared';
import { useState } from 'react';
import { Tile, TileMetric, TileText, TileTitle } from '@/components/ui/tile';
import { useLocale, useT } from '@/lib/i18n';

// PUL-03: Auswertung einer aufgedeckten Welle. Beide Seiten sehen dieselben Zahlen; Formen und
// Zahlen statt nur Farbe: Käufer gefüllter Punkt, Lieferant Ring, Soll als Strich darüber/darunter.

const position = (value: number) => `${((value - 1) / 4) * 100}%`;

function useNumber() {
  const { locale } = useLocale();
  const format = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
  return (value: number | null) => (value === null ? '–' : format.format(value));
}

function Dumbbell({
  rows,
  labels,
  caption,
}: {
  rows: SurveyDimensionResult[];
  labels: Record<string, string>;
  caption: string;
}) {
  const text = useT();
  const number = useNumber();
  const dimensions = text.settings.survey.dimensions;
  return (
    <figure className="m-0 flex flex-col gap-3">
      <figcaption className="sr-only">{caption}</figcaption>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground text-sm" aria-hidden>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full" style={{ background: 'var(--chart-buyer)' }} />
          {labels.buyer}
        </span>
        <span className="flex items-center gap-2">
          <span
            className="size-3 rounded-full border-2 bg-card"
            style={{ borderColor: 'var(--chart-supplier)' }}
          />
          {labels.supplier}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-0.5 bg-foreground" />
          {text.feedback.target}
        </span>
      </div>
      <ul className="flex flex-col">
        {rows.map((row) => {
          const { buyer, supplier } = row;
          const low = Math.min(buyer.ist ?? 0, supplier.ist ?? 0);
          const high = Math.max(buyer.ist ?? 0, supplier.ist ?? 0);
          return (
            <li
              key={row.dimension}
              data-dimension={row.dimension}
              className="grid grid-cols-1 items-center gap-x-4 gap-y-1 border-border border-t py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,5fr)_minmax(0,2.5fr)]"
            >
              <span className="font-medium">{dimensions[row.dimension]}</span>
              <span className="relative block h-10" aria-hidden>
                <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
                {[1, 2, 3, 4, 5].map((step) => (
                  <span
                    key={step}
                    className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-border"
                    style={{ left: position(step) }}
                  />
                ))}
                {buyer.ist !== null && supplier.ist !== null && (
                  <span
                    className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
                    style={{
                      left: position(low),
                      width: `${((high - low) / 4) * 100}%`,
                      background: 'var(--chart-context)',
                    }}
                  />
                )}
                {buyer.soll !== null && (
                  <span
                    className="absolute top-0 h-3 w-0.5 -translate-x-1/2 bg-foreground"
                    style={{ left: position(buyer.soll) }}
                  />
                )}
                {supplier.soll !== null && (
                  <span
                    className="absolute bottom-0 h-3 w-0.5 -translate-x-1/2 bg-foreground"
                    style={{ left: position(supplier.soll) }}
                  />
                )}
                {supplier.ist !== null && (
                  <span
                    className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-card"
                    style={{ left: position(supplier.ist), borderColor: 'var(--chart-supplier)' }}
                  />
                )}
                {buyer.ist !== null && (
                  <span
                    className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ left: position(buyer.ist), background: 'var(--chart-buyer)' }}
                  />
                )}
              </span>
              <span className="text-sm tabular-nums">
                {text.feedback.pairLine(
                  labels.buyer ?? '',
                  number(buyer.ist),
                  labels.supplier ?? '',
                  number(supplier.ist),
                )}
                {row.delta !== null && (
                  <span className="block text-muted-foreground">
                    {text.feedback.gapLine(number(Math.abs(row.delta)))}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

export function ResultsSection({ results, side }: { results: SurveyResults; side: SurveySide }) {
  const t = useT();
  const text = t.feedback;
  const { locale } = useLocale();
  const number = useNumber();
  const labels = side === 'buyer' ? text.sides : text.sidesSupplier;
  const other = side === 'buyer' ? labels.supplier : labels.buyer;
  const [selected, setSelected] = useState<SurveyFunction | 'all'>('all');
  const group = results.functions.find((entry) => entry.function === selected);
  const rows = selected === 'all' || !group ? results.dimensions : group.dimensions;
  const dimensions = t.settings.survey.dimensions;
  return (
    <section aria-labelledby="ergebnis" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 id="ergebnis" className="font-bold text-xl tracking-title">
          {text.resultsTitle}
        </h2>
        <p className="text-muted-foreground text-sm">
          {text.resultsPurpose(results.responses.buyer, results.responses.supplier)}
        </p>
      </div>

      {results.topGaps.length > 0 && (
        <div data-slot="top-gaps" className="grid gap-4 sm:grid-cols-3">
          {results.topGaps.map((delta, index) => (
            <Tile key={delta.dimension} data-delta={delta.dimension}>
              <TileText className="text-sm">{text.topGap(index + 1)}</TileText>
              <TileTitle>{dimensions[delta.dimension]}</TileTitle>
              <TileMetric
                value={number(Math.abs(delta.delta ?? 0))}
                label={text.pairLine(
                  labels.buyer ?? '',
                  number(delta.buyer.ist),
                  labels.supplier ?? '',
                  number(delta.supplier.ist),
                )}
              />
            </Tile>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl bg-card p-5">
        <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
          <legend className="sr-only">{text.byFunction}</legend>
          {[
            { key: 'all' as const, label: text.overall },
            ...results.functions.map((entry) => ({
              key: entry.function,
              label: text.functions[entry.function] ?? entry.function,
            })),
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={selected === option.key}
              onClick={() => setSelected(option.key)}
              className="inline-flex min-h-11 items-center rounded-full border border-border px-4 font-medium text-sm aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
            >
              {option.label}
            </button>
          ))}
        </fieldset>
        {group && (
          <p className="text-muted-foreground text-sm">
            {text.groupNote(group.buyer ? group.buyer.n : 0, group.supplier ? group.supplier.n : 0)}
          </p>
        )}
        <Dumbbell rows={rows} labels={labels} caption={text.chartCaption} />
        <p className="text-muted-foreground text-sm">{text.minGroup}</p>
      </div>

      <details className="rounded-xl bg-card p-5">
        <summary className="min-h-11 cursor-pointer font-semibold">{text.byQuestion}</summary>
        <ul className="mt-2 flex flex-col">
          {results.questions.map((question) => (
            <li
              key={question.key}
              className="flex flex-wrap justify-between gap-3 border-border border-t py-3 text-sm"
            >
              <span className="min-w-0 flex-1">
                {locale === 'en' ? question.labelEn : question.labelDe}
              </span>
              <span className="tabular-nums">
                {text.pairLine(
                  labels.buyer ?? '',
                  number(question.buyer.ist),
                  labels.supplier ?? '',
                  number(question.supplier.ist),
                )}
              </span>
            </li>
          ))}
        </ul>
      </details>

      <section aria-labelledby="freitexte" className="flex flex-col gap-3">
        <h3 id="freitexte" className="font-semibold text-lg">
          {text.freeTexts(other ?? '')}
        </h3>
        {results.freeTexts.length === 0 ? (
          <p className="text-muted-foreground">{text.noFreeTexts}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {results.freeTexts.map((entry) => (
              <li key={entry} className="rounded-xl bg-card px-5 py-4">
                {entry}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
