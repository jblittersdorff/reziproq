import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('führt Tailwind-Klassen zusammen und löst Konflikte auf', () => {
    expect(cn('px-2 py-1', false && 'hidden', 'px-4')).toBe('py-1 px-4');
  });
});

describe('cn mit den Stufen der Designsprache', () => {
  it('behält Schriftgröße und Farbe nebeneinander', () => {
    expect(cn('text-chip', 'text-muted-foreground')).toBe('text-chip text-muted-foreground');
    expect(cn('text-section', 'text-petrol-dark')).toBe('text-section text-petrol-dark');
  });
  it('löst Konflikte zwischen zwei Größen und zwei Schatten', () => {
    expect(cn('text-chip', 'text-title')).toBe('text-title');
    expect(cn('shadow-card', 'shadow-ask')).toBe('shadow-ask');
  });
});
