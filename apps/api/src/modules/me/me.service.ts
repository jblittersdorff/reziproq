import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { and, eq, schema } from '@reziproq/db';
import {
  actions,
  defaultCategoryLabel,
  defaultOrgModules,
  type MeResponse,
  type PermissionsResponse,
  resolveOrgModules,
  type StartPageRequest,
  type UserLocale,
} from '@reziproq/shared';
import { AccountStore, TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { buyerOnlyActions } from '../auth/buyer-only.js';
import { can } from '../auth/can.js';
import { readCategoryLabel } from '../material-groups/category-label.js';
import { SsoGate } from '../sso/sso-gate.js';
import { type Userinfo, UserinfoClient } from './userinfo.client.js';

@Injectable()
export class MeService {
  constructor(
    @Inject(UserinfoClient) private readonly userinfo: UserinfoClient,
    @Inject(AccountStore) private readonly accounts: AccountStore,
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(SsoGate) private readonly sso: SsoGate,
  ) {}

  /** E-K0-05: Name und E-Mail einer Demo-Person aus dem Demo-Mandanten statt von Zitadel */
  private async demoProfile(auth: AuthContext): Promise<Userinfo> {
    const organization = auth.organization;
    if (!organization) throw new UnauthorizedException();
    const [person] = await this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      (tx) =>
        tx
          .select({
            name: schema.appUser.name,
            givenName: schema.appUser.givenName,
            email: schema.appUser.email,
          })
          .from(schema.appUser)
          .where(eq(schema.appUser.id, auth.userId)),
      { readOnly: true },
    );
    if (!person) throw new UnauthorizedException();
    return {
      sub: auth.userId,
      name: person.name,
      email: person.email,
      ...(person.givenName ? { given_name: person.givenName } : {}),
    };
  }

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
    // E-K0-05: Eine Demo-Sitzung kommt ohne Zitadel aus; die Person steht schon im Demo-Mandanten
    // und wird nicht abgeglichen.
    const info = auth.demoSession
      ? await this.demoProfile(auth)
      : await this.userinfo.fetch(auth.accessToken);
    // Userinfo muss zur selben Person gehören wie das Token (OpenID Connect Core 5.3.2).
    if (info.sub !== auth.userId) throw new UnauthorizedException();

    const givenName = info.given_name || null;
    if (!auth.demoSession) {
      // IN-02: Anmeldung über Microsoft oder Google prüfen, bevor die Person angelegt wird
      const sso = await this.sso.check(auth.userId, info);
      await this.accounts.syncUser({
        userId: auth.userId,
        name: info.name,
        givenName,
        email: info.email,
        zitadelOrgId: info['urn:zitadel:iam:user:resourceowner:id'] ?? null,
        login,
        tokenRoles: auth.tokenRoles,
        browserLocale: login ? browserLocale : null,
        sso,
      });
    }
    // Der Guard kannte nur den Stand vor dem Abgleich; die Betreiber-Ansicht bleibt beim Kunden.
    const membership = auth.supportOrganization
      ? null
      : await this.accounts.membershipOf(auth.userId);
    const organization = auth.supportOrganization ?? membership?.organization ?? null;
    // IN-02: Wer auf Freigabe wartet, hat noch keine Rolle und sieht nichts
    const pendingApproval = !auth.supportOrganization && (membership?.approvalPending ?? false);
    const subject = {
      orgRole: auth.supportOrganization
        ? ('viewer' as const)
        : pendingApproval
          ? null
          : (membership?.orgRole ?? null),
      isControlling: membership?.isControlling ?? false,
      isOperator: auth.isOperator,
    };

    const buyerSettings =
      organization?.buyer && !pendingApproval
        ? await this.tenant.run(
            { userId: auth.userId, organizationId: organization.id },
            async (tx) => {
              const [setting] = await tx
                .select()
                .from(schema.userSetting)
                .where(
                  and(
                    eq(schema.userSetting.userId, auth.userId),
                    eq(schema.userSetting.orgId, organization.id),
                  ),
                );
              const [lead] = await tx
                .select({ id: schema.materialGroup.id })
                .from(schema.materialGroup)
                .where(
                  and(
                    eq(schema.materialGroup.orgId, organization.id),
                    eq(schema.materialGroup.active, true),
                    eq(schema.materialGroup.leadUserId, auth.userId),
                  ),
                )
                .limit(1);
              return {
                categoryLabel: await readCategoryLabel(tx, organization.id),
                // UX-20: Module der Organisation, ohne Zeile der Standard
                modules: resolveOrgModules(
                  await tx
                    .select({ module: schema.orgModule.module, enabled: schema.orgModule.enabled })
                    .from(schema.orgModule)
                    .where(eq(schema.orgModule.orgId, organization.id)),
                ),
                startPage: setting?.startPage ?? null,
                defaultOverview: subject.orgRole === 'admin' || Boolean(lead),
              };
            },
            { readOnly: true },
          )
        : { categoryLabel: defaultCategoryLabel, modules: defaultOrgModules };

    return {
      name: info.name,
      firstName: givenName || firstWord(info.name),
      email: info.email,
      organization: organization && { id: organization.id, name: organization.name },
      supportView: auth.supportOrganization !== undefined,
      orgRole: subject.orgRole,
      isControlling: subject.isControlling,
      isOperator: subject.isOperator,
      pendingApproval,
      locale: await this.accounts.localeOf(auth.userId),
      ...buyerSettings,
      permissions: {
        viewOrganizationSettings: organization !== null && can(subject, 'organisation.sehen'),
        viewBuyerAreas: (organization?.buyer ?? false) && !pendingApproval,
        // Lieferanten nur mit Käuferfunktionen und Rolle; so fragt die Oberfläche gar nicht erst an.
        viewSuppliers: (organization?.buyer ?? false) && can(subject, 'lieferanten.sehen'),
        switchCustomer: can(subject, 'kunden.wechseln'),
        // Lieferantenzugang (LIF-02): Organisationen ohne Käuferfunktionen arbeiten je Kunde.
        viewCustomers: organization !== null && !organization.buyer && can(subject, 'kunden.sehen'),
      },
    };
  }

  async setStartPage(auth: AuthContext, page: StartPageRequest['startPage']): Promise<void> {
    const org = auth.organization;
    if (!org?.buyer || !can(auth, 'start.sehen')) throw new ForbiddenException();
    await this.tenant.run({ userId: auth.userId, organizationId: org.id }, async (tx) => {
      if (page === null) {
        await tx
          .delete(schema.userSetting)
          .where(
            and(eq(schema.userSetting.orgId, org.id), eq(schema.userSetting.userId, auth.userId)),
          );
      } else {
        await tx
          .insert(schema.userSetting)
          .values({ orgId: org.id, userId: auth.userId, startPage: page })
          .onConflictDoUpdate({
            target: [schema.userSetting.orgId, schema.userSetting.userId],
            set: { startPage: page },
          });
      }
    });
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
