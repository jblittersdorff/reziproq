import { Module } from '@nestjs/common';
import { env } from '../../config/env.js';
import { EmailModule } from '../email/email.module.js';
import {
  FakeIdentityProvisioner,
  IDENTITY_PROVISIONER,
  UnavailableIdentityProvisioner,
} from './identity-provisioner.js';
import {
  PublicInvitationsController,
  SupplierInvitationsController,
} from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';

@Module({
  imports: [EmailModule],
  controllers: [SupplierInvitationsController, PublicInvitationsController],
  providers: [
    InvitationsService,
    {
      // Bis LIF-01b gibt es nur das nachgebaute Zitadel; im Betrieb ist Annehmen deshalb aus.
      provide: IDENTITY_PROVISIONER,
      useFactory: () =>
        env.NODE_ENV === 'production'
          ? new UnavailableIdentityProvisioner()
          : new FakeIdentityProvisioner(),
    },
  ],
})
export class InvitationsModule {}
