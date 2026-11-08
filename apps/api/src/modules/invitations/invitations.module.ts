import { Module } from '@nestjs/common';
import { type Env, env } from '../../config/env.js';
import { EmailModule } from '../email/email.module.js';
import {
  FakeIdentityProvisioner,
  IDENTITY_PROVISIONER,
  type IdentityProvisioner,
  UnavailableIdentityProvisioner,
} from './identity-provisioner.js';
import {
  PublicInvitationsController,
  SupplierInvitationsController,
} from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';
import { ZitadelIdentityProvisioner } from './zitadel-provisioner.js';

/**
 * zitadel: Verwaltungsschnittstelle (LIF-01b). Der Nachbau läuft nie im Betrieb; dort ist Annehmen
 * ohne Zitadel aus, statt Personen anzulegen, die sich nicht anmelden können.
 */
export function identityProvisionerFor(
  config: Pick<Env, 'NODE_ENV' | 'IDENTITY_PROVIDER' | 'ZITADEL_ISSUER' | 'ZITADEL_SERVICE_TOKEN'>,
): IdentityProvisioner {
  if (config.IDENTITY_PROVIDER === 'zitadel' && config.ZITADEL_SERVICE_TOKEN) {
    return new ZitadelIdentityProvisioner(config.ZITADEL_ISSUER, config.ZITADEL_SERVICE_TOKEN);
  }
  return config.NODE_ENV === 'production'
    ? new UnavailableIdentityProvisioner()
    : new FakeIdentityProvisioner();
}

@Module({
  imports: [EmailModule],
  controllers: [SupplierInvitationsController, PublicInvitationsController],
  providers: [
    InvitationsService,
    {
      provide: IDENTITY_PROVISIONER,
      useFactory: () => identityProvisionerFor(env),
    },
  ],
})
export class InvitationsModule {}
