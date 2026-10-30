import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { MeController } from './me.controller.js';
import { MeService } from './me.service.js';
import { UserinfoClient } from './userinfo.client.js';

@Module({
  imports: [OrganizationsModule],
  controllers: [MeController],
  providers: [UserinfoClient, MeService],
})
export class MeModule {}
