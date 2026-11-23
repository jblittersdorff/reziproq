import { Module } from '@nestjs/common';
import { SsoModule } from '../sso/sso.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { MeController } from './me.controller.js';
import { MeService } from './me.service.js';
import { UserinfoClient } from './userinfo.client.js';

@Module({
  imports: [SsoModule, OrganizationsModule],
  controllers: [MeController],
  providers: [UserinfoClient, MeService],
})
export class MeModule {}
