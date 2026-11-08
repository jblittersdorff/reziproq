import type { TenantTransaction } from '@reziproq/db';
import type { LiveSection } from '@reziproq/shared';

/**
 * Live-Abschnitte eines Termins (QBR-01b): Jedes Modul, das im Termin mitläuft (Maßnahmen QBR-03,
 * später Scorecard, Initiativen und Zusagen), meldet hier seinen aktuellen Stand. Gelesen wird aus
 * dem Ort der Sache, nie kopiert; beim Abschließen friert meeting_snapshot den Stand ein.
 */
export interface MeetingLiveSource {
  readonly key: string;
  /** Stand für diese Beziehung; null, wenn das Modul nichts zu zeigen hat. */
  read(tx: TenantTransaction, relationshipId: string): Promise<LiveSection | null>;
}

export const MEETING_LIVE_SOURCES = Symbol('MEETING_LIVE_SOURCES');
