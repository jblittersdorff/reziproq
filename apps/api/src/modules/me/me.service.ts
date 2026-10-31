import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { MeResponse } from '@reziproq/shared';
import { AccountStore } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { UserinfoClient } from './userinfo.client.js';

@Injectable()
export class MeService {
  constructor(
    @Inject(UserinfoClient) private readonly userinfo: UserinfoClient,
    @Inject(AccountStore) private readonly accounts: AccountStore,
  ) {}

  /**
   * Holt Name, Vorname, E-Mail und Zitadel-Organisation von Zitadel und speichert sie in app_user.
   * Die Organisation folgt immer Zitadel: Ist die Zitadel-Organisation nicht verknüpft, bleibt sie
   * leer (PLT-02). Mit login wird zusätzlich last_login_at gesetzt (PLT-01).
   */
  async syncFromUserinfo(auth: AuthContext, { login = false } = {}): Promise<MeResponse> {
    const info = await this.userinfo.fetch(auth.accessToken);
    // Userinfo muss zur selben Person gehören wie das Token (OpenID Connect Core 5.3.2).
    if (info.sub !== auth.userId) throw new UnauthorizedException();

    const givenName = info.given_name || null;
    await this.accounts.syncUser({
      userId: auth.userId,
      name: info.name,
      givenName,
      email: info.email,
      zitadelOrgId: info['urn:zitadel:iam:user:resourceowner:id'] ?? null,
      login,
    });
    // Der Guard kannte nur den Stand vor dem Abgleich; die Betreiber-Ansicht bleibt beim Kunden.
    const organization =
      auth.supportOrganization ?? (await this.accounts.organizationOf(auth.userId));

    return {
      name: info.name,
      firstName: givenName || firstWord(info.name),
      email: info.email,
      organization: organization && { id: organization.id, name: organization.name },
      supportView: auth.supportOrganization !== undefined,
      roles: [...auth.roles],
      permissions: {
        viewOrganizationSettings: organization !== null,
        viewBuyerAreas: organization?.buyer ?? false,
        // Lieferanten nur mit Käuferfunktionen und Rolle; so fragt die Oberfläche gar nicht erst an.
        viewSuppliers: (organization?.buyer ?? false) && can(auth, 'lieferanten.sehen'),
        switchCustomer: can(auth, 'kunden.wechseln'),
        manageSettings: organization !== null && can(auth, 'einstellungen.verwalten'),
      },
    };
  }
}

function firstWord(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
