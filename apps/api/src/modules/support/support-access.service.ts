import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type AccountOrganization, AccountStore } from '../../common/database.module.js';

/**
 * Betreiber-Zugang (PLT-13): prüft den gewählten Kunden und protokolliert jeden Zugriff.
 * Läuft vor der Mandanten-Session, weil er erst bestimmt, für welchen Kunden sie gilt.
 */
@Injectable()
export class SupportAccessService {
  constructor(@Inject(AccountStore) private readonly accounts: AccountStore) {}

  /** Wechselt für eine Anfrage in einen Kunden mit Käuferfunktionen; 404, wenn es ihn nicht gibt. */
  async enter(
    userId: string,
    organizationId: string,
    action: string,
  ): Promise<AccountOrganization> {
    const customer = (await this.accounts.customers()).find((c) => c.id === organizationId);
    if (!customer) throw new NotFoundException('Diesen Kunden gibt es nicht.');
    await this.accounts.recordSupportAccess(userId, customer.id, action);
    return { ...customer, buyer: true };
  }

  /** Alle Organisationen mit Käuferfunktionen, für die Auswahl „Kunde wechseln“. */
  async customers(userId: string, action: string) {
    await this.accounts.recordSupportAccess(userId, null, action);
    return this.accounts.customers();
  }
}
