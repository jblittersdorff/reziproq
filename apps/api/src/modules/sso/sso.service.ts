import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, schema, type TenantTransaction } from '@reziproq/db';
import {
  type SaveSso,
  type SsoHint,
  type SsoOverview,
  type SsoProvider,
  type SsoSettings,
  saveSsoSchema,
} from '@reziproq/shared';
import { AccountStore, TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { SSO_PROVISIONER, type SsoProvisioner } from './sso-provisioner.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

type Row = typeof schema.orgSso.$inferSelect;
type SsoDomain = Row['domains'][number];

/**
 * IN-02 Einstellungen › Anbindungen › Microsoft 365 bzw. Google Workspace › Anmeldung: Mandant oder
 * Domain, Domains mit DNS-Bestätigung, Standardrolle, „Nur noch über … anmelden“. Nur Admins beim
 * Käufer. Aktiv wird die Anmeldung, sobald eine Domain bestätigt ist.
 */
@Injectable()
export class SsoService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(AccountStore) private readonly accounts: AccountStore,
    @Inject(SSO_PROVISIONER) private readonly provisioner: SsoProvisioner,
  ) {}

  private session(auth: AuthContext) {
    const organization = auth.organization;
    if (!organization?.buyer || !can(auth, 'einstellungen.verwalten')) throw forbidden();
    return { userId: auth.userId, organizationId: organization.id };
  }

  private view(row: Row | undefined): SsoSettings | null {
    if (!row) return null;
    return {
      provider: row.provider,
      tenantId: row.tenantId,
      hostedDomain: row.hostedDomain,
      domains: row.domains,
      defaultRole: row.defaultRole,
      passwordLoginAllowed: row.passwordLoginAllowed,
      status: row.status,
    };
  }

  private async overviewIn(tx: TenantTransaction, orgId: string): Promise<SsoOverview> {
    const rows = await tx.select().from(schema.orgSso).where(eq(schema.orgSso.orgId, orgId));
    return {
      entra: this.view(rows.find((row) => row.provider === 'entra')),
      google: this.view(rows.find((row) => row.provider === 'google')),
    };
  }

  overview(auth: AuthContext): Promise<SsoOverview> {
    const session = this.session(auth);
    return this.tenant.run(session, (tx) => this.overviewIn(tx, session.organizationId), {
      readOnly: true,
    });
  }

  private async zitadelOrgOf(tx: TenantTransaction, orgId: string) {
    const [row] = await tx
      .select({ zitadelOrgId: schema.organization.zitadelOrgId })
      .from(schema.organization)
      .where(eq(schema.organization.id, orgId));
    return row?.zitadelOrgId ?? null;
  }

  async save(auth: AuthContext, provider: SsoProvider, input: SaveSso): Promise<SsoOverview> {
    const session = this.session(auth);
    const data = saveSsoSchema.parse(input);
    if (provider === 'entra' && !data.tenantId) {
      throw new BadRequestException({ statusCode: 400, code: 'mandant_fehlt' });
    }
    if (provider === 'google' && !data.hostedDomain) {
      throw new BadRequestException({ statusCode: 400, code: 'domain_fehlt' });
    }
    return this.tenant.run(session, async (tx) => {
      const orgId = session.organizationId;
      const zitadelOrgId = await this.zitadelOrgOf(tx, orgId);
      const [existing] = await tx
        .select()
        .from(schema.orgSso)
        .where(and(eq(schema.orgSso.orgId, orgId), eq(schema.orgSso.provider, provider)));
      const domains: SsoDomain[] = [];
      for (const domain of [...new Set(data.domains)]) {
        const known = existing?.domains.find((entry) => entry.domain === domain);
        domains.push(
          known ?? {
            domain,
            ...(await this.provisioner.startDomain({ zitadelOrgId, domain })),
            verifiedAt: null,
          },
        );
      }
      const row = await this.store(tx, existing, {
        orgId,
        provider,
        tenantId: provider === 'entra' ? data.tenantId : null,
        hostedDomain: provider === 'google' ? data.hostedDomain : null,
        domains,
        defaultRole: data.defaultRole,
        passwordLoginAllowed: data.passwordLoginAllowed,
        updatedBy: auth.userId,
      });
      await this.activate(tx, row, zitadelOrgId);
      return this.overviewIn(tx, orgId);
    });
  }

  /** Domain bestätigen: prüft den DNS-Eintrag; mit der ersten bestätigten Domain wird SSO aktiv. */
  async verify(auth: AuthContext, provider: SsoProvider, domain: string): Promise<SsoOverview> {
    const session = this.session(auth);
    return this.tenant.run(session, async (tx) => {
      const orgId = session.organizationId;
      const [row] = await tx
        .select()
        .from(schema.orgSso)
        .where(and(eq(schema.orgSso.orgId, orgId), eq(schema.orgSso.provider, provider)));
      const entry = row?.domains.find((item) => item.domain === domain);
      if (!row || !entry) throw notFound();
      const zitadelOrgId = await this.zitadelOrgOf(tx, orgId);
      if (!entry.verifiedAt && (await this.provisioner.confirmDomain({ zitadelOrgId, domain }))) {
        const domains = row.domains.map((item) =>
          item.domain === domain ? { ...item, verifiedAt: new Date().toISOString() } : item,
        );
        const updated = await this.store(tx, row, { ...row, domains, updatedBy: auth.userId });
        await this.activate(tx, updated, zitadelOrgId);
      }
      return this.overviewIn(tx, orgId);
    });
  }

  private async store(
    tx: TenantTransaction,
    existing: Row | undefined,
    values: Omit<typeof schema.orgSso.$inferInsert, 'id'>,
  ): Promise<Row> {
    const { orgId, provider, ...rest } = values;
    const [row] = existing
      ? await tx
          .update(schema.orgSso)
          .set({ ...rest, updatedAt: new Date() })
          .where(eq(schema.orgSso.id, existing.id))
          .returning()
      : await tx.insert(schema.orgSso).values(values).returning();
    if (!row) throw notFound();
    return row;
  }

  /** Mit einer bestätigten Domain: Anbieter und Passwort-Regel in Zitadel, Stand aktiv */
  private async activate(tx: TenantTransaction, row: Row, zitadelOrgId: string | null) {
    if (!row.domains.some((entry) => entry.verifiedAt)) {
      if (row.status !== 'draft') {
        await tx.update(schema.orgSso).set({ status: 'draft' }).where(eq(schema.orgSso.id, row.id));
      }
      return;
    }
    const idpRef = await this.provisioner.configure({
      zitadelOrgId,
      provider: row.provider,
      tenantId: row.tenantId,
      hostedDomain: row.hostedDomain,
      passwordLoginAllowed: row.passwordLoginAllowed,
      idpRef: row.idpRef,
    });
    await tx
      .update(schema.orgSso)
      .set({ status: 'active', idpRef })
      .where(eq(schema.orgSso.id, row.id));
  }

  /**
   * Anmeldeseite: Gehört die Mail zu einer bestätigten Domain mit SSO, führt Weiter direkt zum
   * Anbieter (Zitadel-Scope für den Anbieter). Nennt nur den Anbieter, keine Organisation.
   */
  async hint(email: string): Promise<SsoHint> {
    const domain = email.split('@')[1]?.toLowerCase() ?? '';
    const [rule] = await this.accounts.ssoOfDomain(domain);
    return {
      provider: rule?.provider ?? null,
      scope: rule?.idpRef ? `urn:zitadel:iam:org:idp:id:${rule.idpRef}` : null,
    };
  }
}
