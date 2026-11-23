import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { type AccountSync, AccountStore } from '../../common/database.module.js';
import type { Userinfo } from '../me/userinfo.client.js';

const rejected = (code: string, provider?: string) =>
  new ForbiddenException({ statusCode: 403, code, ...(provider ? { provider } : {}) });

/**
 * IN-02: Prüft jede Anmeldung, bevor die Person angelegt oder abgeglichen wird.
 * - Über Microsoft oder Google: Anbieter der Organisation aktiv, Entra-Mandant bzw. Google-hd passen,
 *   Mail aus einer bestätigten Domain, Anbieter + Subject gehören zu keiner anderen Person.
 * - Mit Passkey oder Passwort: nicht für Mails einer Domain, deren Organisation nur noch SSO erlaubt.
 * Neue Personen bekommen die Standardrolle und warten auf Freigabe (Entscheidung F10).
 */
@Injectable()
export class SsoGate {
  constructor(@Inject(AccountStore) private readonly accounts: AccountStore) {}

  async check(userId: string, info: Userinfo): Promise<AccountSync['sso']> {
    const domain = info.email.split('@')[1]?.toLowerCase() ?? '';
    const idp = info['urn:reziproq:idp'];
    if (!idp) {
      const rules = await this.accounts.ssoOfDomain(domain);
      const only = rules.find((rule) => !rule.passwordLoginAllowed);
      if (only) throw rejected('nur_sso', only.provider);
      return null;
    }
    const zitadelOrgId = info['urn:zitadel:iam:user:resourceowner:id'];
    const settings = zitadelOrgId ? await this.accounts.ssoOfOrganization(zitadelOrgId) : [];
    const sso = settings.find((entry) => entry.provider === idp.provider);
    if (!sso) throw rejected('sso_nicht_eingerichtet');
    if (sso.provider === 'entra' && idp.tenant !== sso.tenantId) throw rejected('falscher_mandant');
    if (sso.provider === 'google' && idp.hd?.toLowerCase() !== sso.hostedDomain?.toLowerCase()) {
      throw rejected('falsche_domain');
    }
    if (!sso.domains.includes(domain)) throw rejected('domain_nicht_bestaetigt');
    const owner = await this.accounts.identityOwner(idp.provider, idp.subject);
    if (owner && owner !== userId) throw rejected('identitaet_vergeben');
    return {
      defaultRole: sso.defaultRole,
      pending: true,
      identity: { provider: idp.provider, subject: idp.subject },
    };
  }
}
