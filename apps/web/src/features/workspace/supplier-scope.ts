import { workspaceAreas } from '@reziproq/shared';
import { createContext, useContext } from 'react';

/**
 * NAV-10 1.1: Auf den Seiten eines Lieferanten steht oben der Lieferantenkopf mit „‹ Lieferanten“,
 * Bereichen und Unterseiten. Der Pfad einer Seite nennt darunter nur noch die Ebene über ihr, die
 * der Kopf nicht schon zeigt (z. B. „‹ Themen“ über einem Thema).
 */
export const SupplierScope = createContext<{ relationshipId: string } | null>(null);

export const useSupplierScope = () => useContext(SupplierScope);

/** Ebenen, die der Lieferantenkopf schon zeigt: Liste, Lieferant und die alten Bereiche */
export function shownByHeader(relationshipId: string, href: string) {
  const base = `/lieferanten/${relationshipId}`;
  const path = href.split(/[?#]/)[0]?.replace(/\/$/, '') ?? '';
  return (
    path === '/beziehungen' ||
    path === '/lieferanten' ||
    path === base ||
    workspaceAreas.some((area) => path === `${base}/${area.segment}`)
  );
}
