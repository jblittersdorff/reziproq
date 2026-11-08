import { type CustomerArea, customerAreas } from '@reziproq/shared';

/** Adresse eines Bereichs beim Kunden; ohne Bereich der Überblick (LIF-02). */
export function customerPath(relationshipId: string, area?: CustomerArea): string {
  const segment = customerAreas.find((entry) => entry.key === area)?.segment;
  return segment ? `/kunden/${relationshipId}/${segment}` : `/kunden/${relationshipId}`;
}

/** Bereich zu einer Adresse unter /kunden/<beziehung>/…, sonst undefined (Überblick). */
export function customerAreaOf(pathname: string): CustomerArea | undefined {
  const segment = pathname.split('/')[3];
  return customerAreas.find((entry) => entry.segment === segment)?.key;
}

/** Bereich aus dem Suchparameter ?bereich= der Kundenliste, für den Kundenwechsel. */
export function customerAreaFromSegment(segment: unknown): CustomerArea | undefined {
  return customerAreas.find((entry) => entry.segment === segment)?.key;
}
