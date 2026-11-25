import { withDemoClock } from '@reziproq/db';
import type { AccountStore } from './database.module.js';

/**
 * DM-01 (K1-b.4): Ein Job, der über Mandanten läuft, rechnet je Mandant mit dessen Uhr. Im
 * Demo-Mandanten ist das die Demo-Uhr, sonst die Echtzeit. Gilt auch für Code außerhalb einer
 * Mandanten-Transaktion (in ihr ist die Uhr des Mandanten ohnehin gesetzt).
 */
export async function inOrgClock<T>(
  accounts: Pick<AccountStore, 'demoNowOf'>,
  orgId: string,
  work: () => Promise<T>,
): Promise<T> {
  return withDemoClock(await accounts.demoNowOf(orgId), work);
}
