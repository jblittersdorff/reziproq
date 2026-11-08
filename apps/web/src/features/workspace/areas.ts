import { type OverviewTile, type WorkspaceArea, workspaceAreas } from '@reziproq/shared';
import type { Messages } from '@/locales/de';

/** Wann ein noch fehlendes Modul kommt: im Kernpfad mit Release 1.0 oder in einem Block danach. */
export type Coming = 'core' | 'later';

export type PageKey = keyof Messages['workspace']['pages'];

/** Eine Unterseite eines Bereichs: entweder mit Adresse unter dem Bereich oder noch nicht gebaut. */
export type SubPage = { key: PageKey } & ({ segment: string } | { coming: Coming });

/**
 * Unterseiten je Bereich als Kacheln (NAV-06), höchstens sechs. Die Reihenfolge folgt der Arbeit:
 * erst bewerten und planen, dann die Daten. Kommt ein Modul dazu, bekommt es hier seine Adresse.
 */
export const areaPages: Record<WorkspaceArea, SubPage[]> = {
  strategy: [
    { key: 'segmentation', segment: 'segmentierung' },
    { key: 'supplierPlan', segment: 'lieferantenplan' },
    { key: 'spend', segment: 'spend' },
    { key: 'profile', segment: 'profil' },
  ],
  relationship: [
    { key: 'team', segment: 'team' },
    { key: 'rules', coming: 'core' },
    { key: 'feedback', coming: 'later' },
    { key: 'touchpoints', coming: 'later' },
  ],
  plan: [
    { key: 'preparation', coming: 'later' },
    { key: 'topics', coming: 'later' },
    { key: 'initiatives', coming: 'later' },
    { key: 'commitments', coming: 'later' },
    { key: 'scorecard', coming: 'later' },
  ],
  execution: [
    { key: 'meetings', coming: 'core' },
    { key: 'actions', coming: 'core' },
  ],
  impact: [
    { key: 'initiativeImpact', coming: 'later' },
    { key: 'monthly', coming: 'later' },
    { key: 'bridge', coming: 'later' },
  ],
};

/**
 * Kacheln des Überblicks ohne eigenes Modul zeigen den Release-Hinweis statt einer Kennzahl.
 * Strategie und Beziehung melden ihre Kennzahl über die API.
 */
export const overviewComing: Record<OverviewTile, Coming | null> = {
  strategy: null,
  relationship: null,
  plan: 'later',
  execution: 'core',
  impact: 'later',
  hints: 'later',
};

export const workspacePath = (relationshipId: string, area?: WorkspaceArea) => {
  const segment = workspaceAreas.find((entry) => entry.key === area)?.segment;
  return segment ? `/lieferanten/${relationshipId}/${segment}` : `/lieferanten/${relationshipId}`;
};

/** Bereich zu einer Adresse; undefined auf dem Überblick. */
export function areaOf(pathname: string): WorkspaceArea | undefined {
  const segment = pathname.split('/')[3];
  return workspaceAreas.find((entry) => entry.segment === segment)?.key;
}
