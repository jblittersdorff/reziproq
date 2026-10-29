import { describe, expect, it } from 'vitest';
import { sequentialStep } from './sequential-scale';

describe('sequentialStep', () => {
  it('verteilt Werte gleichmäßig auf die Stufen', () => {
    expect([1, 1.7, 2.9, 3.5, 4.4, 5].map((v) => sequentialStep(v, 1, 5, 5))).toEqual([
      0, 0, 2, 3, 4, 4,
    ]);
  });

  it('begrenzt Werte außerhalb des Bereichs', () => {
    expect(sequentialStep(-3, 1, 5, 5)).toBe(0);
    expect(sequentialStep(9, 1, 5, 5)).toBe(4);
    expect(sequentialStep(3, 2, 2, 5)).toBe(0);
  });
});
