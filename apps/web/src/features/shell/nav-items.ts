import {
  IconActivityHeartbeat,
  IconBuildingFactory2,
  IconChecklist,
  IconHeartHandshake,
  IconLayoutDashboard,
  IconReportMoney,
  IconSettings,
  IconTargetArrow,
} from '@tabler/icons-react';
import type { LinkProps } from '@tanstack/react-router';
import type { Messages } from '@/locales/de';

export interface NavItem {
  to: NonNullable<LinkProps['to']>;
  label: keyof Messages['nav'];
  icon: typeof IconSettings;
}

/** Hauptnavigation in der Reihenfolge der Seitenleiste. */
export const mainNavItems: NavItem[] = [
  { to: '/', label: 'overview', icon: IconLayoutDashboard },
  { to: '/lieferanten', label: 'suppliers', icon: IconBuildingFactory2 },
  { to: '/beziehungen', label: 'relationships', icon: IconHeartHandshake },
  { to: '/beziehungspuls', label: 'pulse', icon: IconActivityHeartbeat },
  { to: '/joint-business-plans', label: 'jointBusinessPlans', icon: IconTargetArrow },
  { to: '/qbrs', label: 'qbrs', icon: IconChecklist },
  { to: '/pnl-impact', label: 'pnlImpact', icon: IconReportMoney },
];

/** Steht wie in macOS-Apps abgesetzt unten in der Seitenleiste. */
export const settingsNavItem: NavItem = {
  to: '/einstellungen',
  label: 'settings',
  icon: IconSettings,
};
