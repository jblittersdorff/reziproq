import { type AreaKey, areas as sharedAreas } from '@reziproq/shared';
import type { LinkProps } from '@tanstack/react-router';
import {
  ActivityIcon,
  FactoryIcon,
  GoalIcon,
  HandshakeIcon,
  ListChecksIcon,
  type LucideIcon,
  ReceiptEuroIcon,
} from 'lucide-react';

export type { AreaKey };

export interface Area {
  key: AreaKey;
  to: NonNullable<LinkProps['to']>;
  icon: LucideIcon;
  /** Release, mit dem die Funktion kommt (PLT-11). */
  release: string;
}

const icons: Record<AreaKey, LucideIcon> = {
  suppliers: FactoryIcon,
  relationships: HandshakeIcon,
  pulse: ActivityIcon,
  jointBusinessPlans: GoalIcon,
  qbrs: ListChecksIcon,
  pnlImpact: ReceiptEuroIcon,
};

/**
 * Die sechs Bereiche aus @reziproq/shared, ergänzt um ein Symbol. Seitenleiste, Kacheln und
 * Bereichsseiten lesen von hier; die API nutzt dieselbe Liste für das Prompt-Fenster (PLT-12).
 * Dass jeder Pfad eine Route hat, prüfen die Tests in plt-11.test.tsx.
 */
export const areas: readonly Area[] = sharedAreas.map((area) => ({
  key: area.key,
  to: area.path,
  icon: icons[area.key],
  release: area.release,
}));

export function areaByKey(key: AreaKey): Area {
  const area = areas.find((candidate) => candidate.key === key);
  if (!area) throw new Error(`Unbekannter Bereich: ${key}`);
  return area;
}
