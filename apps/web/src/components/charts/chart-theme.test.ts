import { describe, expect, it } from 'vitest';
import { type ChartTheme, colorTokens, echartsBase } from './chart-theme';

describe('Diagramm-Theme (PLT-10)', () => {
  it('Die Diagramm-Beispiele nutzen nur Diagramm-Tokens', () => {
    for (const token of Object.values(colorTokens)) {
      expect(token).toMatch(/^--chart-/);
    }
  });

  it('Bei „Bewegung reduzieren“ laufen keine Animationen', () => {
    const theme = {
      colors: {},
      sequential: [],
      fontFamily: 'system-ui',
      fontSize: { sm: 13, base: 15 },
    } as unknown as ChartTheme;
    expect(echartsBase({ ...theme, reducedMotion: true }).animation).toBe(false);
    expect(echartsBase({ ...theme, reducedMotion: false }).animation).toBe(true);
  });
});
