// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { GoalRings } from './goal-rings';
import { InsightHeading, RankedBars } from './insight';

afterEach(cleanup);

const result = {
  label: 'EBIT',
  actual: 40,
  target: 80,
  format: (actual: number, target: number | null) =>
    target === null ? `${actual} €` : `${actual} von ${target} €`,
};

it('zeigt ohne Ziel nur den Wert und lässt einen unabhängigen Innenring stehen', () => {
  const metric = { ...result, target: null };
  const { container, rerender } = render(<GoalRings result={metric} />);
  expect(container.querySelector('svg')).toBeNull();
  expect(screen.getByText('40 €')).toBeTruthy();
  rerender(<GoalRings result={metric} relationships={{ ...result, label: 'Beziehungen' }} />);
  expect(container.querySelectorAll('circle')).toHaveLength(2);
  expect(container.querySelector('.stroke-mint')).not.toBeNull();
  expect(container.querySelector('.stroke-petrol')).toBeNull();
});

it('zeichnet bei null Fortschritt nur die Spur und begrenzt Übererfüllung allein im Ring', () => {
  const { container, rerender } = render(<GoalRings result={{ ...result, actual: 0 }} />);
  expect(container.querySelectorAll('circle')).toHaveLength(1);
  rerender(<GoalRings result={{ ...result, actual: 90 }} />);
  expect(container.querySelector('[stroke-dasharray]')?.getAttribute('stroke-dasharray')).toBe(
    '1 1',
  );
  expect(screen.getByText('90 von 80 €')).toBeTruthy();
  rerender(<GoalRings result={{ ...result, target: 0 }} />);
  expect(container.querySelector('svg')).toBeNull();
});

it('blendet eine Aussage ohne Quellen oder ohne geprüfte Überschrift aus', () => {
  const props = { attribution: 'Reziproq', explanation: 'Text', headline: 'Ergebnis', sources: [] };
  const { container, rerender } = render(<InsightHeading {...props} />);
  expect(container.firstChild).toBeNull();
  rerender(<InsightHeading {...props} headline={null} sources={[{ key: 'a', label: 'Quelle' }]} />);
  expect(container.firstChild).toBeNull();
});

it('sortiert die Balken numerisch und beschriftet auch Nullwerte', () => {
  render(
    <RankedBars
      rows={[
        { label: 'B', value: 0 },
        { label: 'A', value: 40 },
      ]}
      format={(result) => String(result)}
    />,
  );
  expect(screen.getAllByRole('listitem').map((row) => row.textContent)).toEqual(['A40', 'B0']);
});
