/** PO-01, E-K2-5 (K2-d.2): Ab dieser Konfidenz ordnet Reziproq eine Mail selbst zu. */
export const autoAssignThreshold = 0.9;

const domainOf = (email: string) => email.split('@')[1]?.toLowerCase() ?? '';

/**
 * Konfidenz, dass eine Mail zu genau diesem Lieferanten gehört, nach festen Regeln (KI-15: Absender
 * und Domains, wie bei Terminen in IN-03):
 * - 0,98: Die Absenderin ist Ansprechpartnerin dieses Lieferanten.
 * - 0,92: Die Domain der Absenderin gehört zu diesem Lieferanten.
 * - 0,75: Nur Empfänger gehören zu ihm, etwa bei einer eigenen Mail an den Lieferanten.
 * Betrifft eine Mail mehrere Lieferanten, ordnet Reziproq nie selbst zu (E-K7-4); das entscheidet
 * der Aufrufer.
 */
export function assignConfidence(input: {
  senderEmail: string;
  /** Domains, über die der Lieferant gefunden wurde */
  domains: string[];
  /** Ist die Absenderin Ansprechpartnerin dieses Lieferanten? */
  senderIsContact: boolean;
}): number {
  if (input.senderIsContact) return 0.98;
  if (input.domains.includes(domainOf(input.senderEmail))) return 0.92;
  return 0.75;
}
