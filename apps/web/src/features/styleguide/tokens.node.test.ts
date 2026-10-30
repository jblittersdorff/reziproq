import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { colorGroups } from './tokens.js';

const css = readFileSync(new URL('../../styles/tokens.css', import.meta.url), 'utf8');

describe('Styleguide (PLT-10)', () => {
  it('zeigt jedes Farb-Token aus tokens.css genau einmal', () => {
    const root = css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? '';
    const colorTokens = [...root.matchAll(/--([\w-]+):\s*#[0-9a-fA-F]{6,8};/g)].map((m) => m[1]);
    const shown = Object.values(colorGroups).flat();
    expect([...shown].sort()).toEqual([...colorTokens].sort());
  });
});
