import { describe, expect, it } from 'vitest';
import { dayTime } from './greeting';

const at = (hour: number, minute = 0) => new Date(2026, 9, 29, hour, minute);

describe('dayTime', () => {
  it.each([
    [at(5), 'morning'],
    [at(10, 59), 'morning'],
    [at(11), 'day'],
    [at(17, 59), 'day'],
    [at(18), 'evening'],
    [at(23, 30), 'evening'],
    [at(0), 'evening'],
    [at(4, 59), 'evening'],
  ] as const)('%s ist %s', (date, expected) => {
    expect(dayTime(date)).toBe(expected);
  });
});
