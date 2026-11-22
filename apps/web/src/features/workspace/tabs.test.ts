import { describe, expect, it } from 'vitest';
import { areaPages, builtPages } from './areas';
import { supplierTabs, tabOf, tabPages } from './tabs';

// NAV-10: Jede bisherige Seite eines Lieferanten gehört genau einem Reiter oder dem Profil.
describe('NAV-10 Reiter der Lieferantenleiste', () => {
  it('jede gebaute Seite ist genau einem Reiter oder dem Profil zugeordnet', () => {
    const segments = {
      strategy: 'strategie',
      relationship: 'beziehung',
      plan: 'plan',
      execution: 'umsetzung',
      impact: 'wirkung',
    } as const;
    const all = (Object.keys(areaPages) as (keyof typeof areaPages)[]).flatMap((area) =>
      builtPages(area).map((page) => `${segments[area]}/${page.segment}`),
    );
    const assigned = [...supplierTabs, 'profile' as const].flatMap((tab) =>
      tabPages[tab].map((page) => page.path),
    );
    for (const path of all) {
      expect(
        assigned.filter((entry) => entry === path),
        path,
      ).toHaveLength(1);
    }
  });

  it('jede Adresse findet ihren Reiter, auch Unterseiten und Zyklus', () => {
    const id = '0190a0a0-0000-7000-8000-000000000001';
    expect(tabOf(`/lieferanten/${id}`).tab).toBe('overview');
    expect(tabOf(`/lieferanten/${id}/aktivitaeten`).tab).toBe('activities');
    expect(tabOf(`/lieferanten/${id}/umsetzung/termine/abc`).tab).toBe('activities');
    expect(tabOf(`/lieferanten/${id}/umsetzung/massnahmen`).tab).toBe('plan');
    expect(tabOf(`/lieferanten/${id}/plan/versionen`).tab).toBe('plan');
    expect(tabOf(`/lieferanten/${id}/beziehung/feedback`).tab).toBe('results');
    expect(tabOf(`/lieferanten/${id}/beziehung/team/bearbeiten`).tab).toBe('profile');
    expect(tabOf(`/lieferanten/${id}/zyklus/neu`).tab).toBe('overview');
  });
});
