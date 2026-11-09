import { type WorkspaceArea, workspaceAreas } from '@reziproq/shared';
import type { Messages } from '@/locales/de';

/** Wann ein noch fehlendes Modul kommt: im Kernpfad mit Release 1.0 oder in einem Block danach. */
export type Coming = 'core' | 'later';

export type PageKey = keyof Messages['workspace']['pages'];

/** Eine Unterseite eines Bereichs: entweder mit Adresse unter dem Bereich oder noch nicht gebaut. */
export type SubPage = { key: PageKey } & ({ segment: string } | { coming: Coming });

/**
 * Unterseiten je Bereich (NAV-06, UMB-05). Die Reihenfolge folgt der Arbeit: erst bewerten und
 * planen, dann die Daten. Kommt ein Modul dazu, bekommt es hier seine Adresse und erscheint dann
 * erst auf dem Überblick und in der lokalen Leiste.
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
    { key: 'rules', segment: 'spielregeln' },
    { key: 'feedback', coming: 'later' },
    { key: 'touchpoints', coming: 'later' },
  ],
  plan: [
    { key: 'preparation', segment: 'vorbereitung' },
    { key: 'topics', segment: 'themen' },
    { key: 'initiatives', segment: 'initiativen' },
    { key: 'commitments', coming: 'later' },
    { key: 'scorecard', coming: 'later' },
  ],
  execution: [
    { key: 'meetings', segment: 'termine' },
    { key: 'actions', segment: 'massnahmen' },
  ],
  impact: [
    { key: 'initiativeImpact', coming: 'later' },
    { key: 'monthly', coming: 'later' },
    { key: 'bridge', coming: 'later' },
  ],
};

/** Gebaute Unterseiten eines Bereichs (UMB-05: nur Gebautes erscheint). */
export function builtPages(area: WorkspaceArea): { key: PageKey; segment: string }[] {
  return areaPages[area].filter(
    (page): page is { key: PageKey; segment: string } => 'segment' in page,
  );
}

/** Bereiche mit mindestens einer gebauten Unterseite, in der Reihenfolge der lokalen Leiste. */
export const builtAreas: WorkspaceArea[] = workspaceAreas
  .map((entry) => entry.key)
  .filter((area) => builtPages(area).length > 0);

/** Abschnitt eines Bereichs auf dem Überblick, z. B. /lieferanten/<id>#strategie. */
export const sectionHref = (relationshipId: string, area: WorkspaceArea) =>
  `/lieferanten/${relationshipId}#${workspaceAreas.find((entry) => entry.key === area)?.segment}`;

export const workspacePath = (relationshipId: string, area?: WorkspaceArea) => {
  const segment = workspaceAreas.find((entry) => entry.key === area)?.segment;
  return segment ? `/lieferanten/${relationshipId}/${segment}` : `/lieferanten/${relationshipId}`;
};

/** Bereich zu einer Adresse; undefined auf dem Überblick. */
export function areaOf(pathname: string): WorkspaceArea | undefined {
  const segment = pathname.split('/')[3];
  return workspaceAreas.find((entry) => entry.segment === segment)?.key;
}
