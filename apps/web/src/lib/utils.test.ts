import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('führt Tailwind-Klassen zusammen und löst Konflikte auf', () => {
    expect(cn('px-2 py-1', false && 'hidden', 'px-4')).toBe('py-1 px-4');
  });
});
