import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  actions,
  type MeResponse,
  type PermissionsResponse,
  type UserLocale,
} from '@reziproq/shared';
import { AccountStore } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { buyerOnlyActions } from '../auth/buyer-only.js';
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
  async syncFromUserinfo(
    auth: AuthContext,
    {
      login = false,
      browserLocale = null,
    }: { login?: boolean; browserLocale?: UserLocale | null } = {},
  ): Promise<MeResponse> {
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
      tokenRoles: auth.tokenRoles,
      browserLocale: login ? browserLocale : null,
    });
    // Der Guard kannte nur den Stand vor dem Abgleich; die Betreiber-Ansicht bleibt beim Kunden.
    const membership = auth.supportOrganization
      ? null
      : await this.accounts.membershipOf(auth.userId);
    const organization = auth.supportOrganization ?? membership?.organization ?? null;
    const subject = {
      orgRole: auth.supportOrganization ? ('viewer' as const) : (membership?.orgRole ?? null),
      isControlling: membership?.isControlling ?? false,
      isOperator: auth.isOperator,
    };

    return {
      name: info.name,
      firstName: givenName || firstWord(info.name),
      email: info.email,
      organization: organization && { id: organization.id, name: organization.name },
      supportView: auth.supportOrganization !== undefined,
      orgRole: subject.orgRole,
      isControlling: subject.isControlling,
      isOperator: subject.isOperator,
      locale: await this.accounts.localeOf(auth.userId),
      permissions: {
        viewOrganizationSettings: organization !== null && can(subject, 'organisation.sehen'),
        viewBuyerAreas: organization?.buyer ?? false,
        // Lieferanten nur mit Käuferfunktionen und Rolle; so fragt die Oberfläche gar nicht erst an.
        viewSuppliers: (organization?.buyer ?? false) && can(subject, 'lieferanten.sehen'),
        switchCustomer: can(subject, 'kunden.wechseln'),
        // Lieferantenzugang (LIF-02): Organisationen ohne Käuferfunktionen arbeiten je Kunde.
        viewCustomers: organization !== null && !organization.buyer && can(subject, 'kunden.sehen'),
      },
    };
  }

  /** Eigene Sprache ändern (PLT-09); gilt sofort und bei jedem späteren Login. */
  async setLocale(auth: AuthContext, locale: UserLocale): Promise<void> {
    await this.accounts.setLocale(auth.userId, locale);
  }

  /**
   * Die Aktionen, die die Person gerade darf (GET /me/permissions). Die Oberfläche blendet danach
   * Knöpfe aus; entscheidend bleibt die Prüfung im Backend (PLT-05).
   */
  permissions(auth: AuthContext): PermissionsResponse {
    const buyer = auth.organization?.buyer ?? false;
    return {
      actions: actions.filter(
        (action) => can(auth, action) && (buyer || !buyerOnlyActions.includes(action)),
      ),
    };
  }
}

function firstWord(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
