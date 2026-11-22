// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RangeBars } from './range-bars';

// AW-01: Spannen-Balken beginnen bei 0, Sicherheit niedrig ist grau, aria-label mit allen Werten.
afterEach(cleanup);

describe('Spannen-Balken', () => {
  const rows = [
    { key: 'a', label: 'Preisgleitklausel', text: 'Preisgleitklausel', low: 100, high: 200 },
    { key: 'b', label: 'Marktstandard', text: 'Marktstandard', low: 0, high: 400, muted: true },
  ];
  const format = (low: number, high: number) => `${low} bis ${high}`;

  it('nennt alle Werte im aria-label und markiert niedrige Sicherheit', () => {
    render(<RangeBars rows={rows} format={format} label="EBIT je Potenzial" />);
    const chart = screen.getByRole('img');
    expect(chart.getAttribute('aria-label')).toBe(
      'EBIT je Potenzial: Preisgleitklausel 100 bis 200, Marktstandard 0 bis 400',
    );
    expect(document.querySelectorAll('[data-muted]')).toHaveLength(1);
  });

  it('die Achse beginnt bei 0: eine Spanne ab 0 startet am linken Rand, die größte endet rechts', () => {
    render(<RangeBars rows={rows} format={format} label="EBIT" />);
    const bars = [...document.querySelectorAll<HTMLElement>('li .absolute')];
    expect(bars[0]?.style.left).toBe('25%');
    expect(bars[1]?.style.left).toBe('0%');
  });
});
