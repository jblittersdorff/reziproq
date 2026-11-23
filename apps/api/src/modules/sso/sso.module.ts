import { Module } from '@nestjs/common';
import { env } from '../../config/env.js';
import { SsoGate } from './sso-gate.js';
import { SSO_PROVISIONER, ssoProvisionerFor } from './sso-provisioner.js';
import { SsoController, SsoHintController } from './sso.controller.js';
import { SsoService } from './sso.service.js';

/** IN-02 Anmeldung über Microsoft und Google (über Zitadel, Entscheidung F10). */
@Module({
  controllers: [SsoController, SsoHintController],
  providers: [
    SsoService,
    SsoGate,
    { provide: SSO_PROVISIONER, useFactory: () => ssoProvisionerFor(env) },
  ],
  exports: [SsoGate, SSO_PROVISIONER],
})
export class SsoModule {}
