import {
  IconActivityHeartbeat,
  IconBuildingFactory2,
  IconChecklist,
  IconHeartHandshake,
  IconReportMoney,
  IconTargetArrow,
} from '@tabler/icons-react';
import type { LinkProps } from '@tanstack/react-router';
import type { Messages } from '@/locales/de';

export type AreaKey = keyof Messages['areas'];

export interface Area {
  key: AreaKey;
  to: NonNullable<LinkProps['to']>;
  icon: typeof IconChecklist;
  /** Release, mit dem die Funktion kommt (PLT-11). */
  release: string;
}

/**
 * Die sechs Bereiche von Reziproq in fester Reihenfolge. Seitenleiste, Kacheln auf der Übersicht
 * und Bereichsseiten lesen von hier, später auch das Prompt-Fenster (PLT-12).
 */
export const areas: readonly Area[] = [
  { key: 'suppliers', to: '/lieferanten', icon: IconBuildingFactory2, release: '0.1' },
  { key: 'relationships', to: '/beziehungen', icon: IconHeartHandshake, release: '0.2' },
  { key: 'pulse', to: '/puls', icon: IconActivityHeartbeat, release: '0.2' },
  { key: 'jointBusinessPlans', to: '/jbp', icon: IconTargetArrow, release: '0.3' },
  { key: 'qbrs', to: '/qbr', icon: IconChecklist, release: '0.3' },
  { key: 'pnlImpact', to: '/pnl', icon: IconReportMoney, release: '1.0' },
];

export function areaByKey(key: AreaKey): Area {
  const area = areas.find((candidate) => candidate.key === key);
  if (!area) throw new Error(`Unbekannter Bereich: ${key}`);
  return area;
}
