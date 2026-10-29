import { Module } from '@nestjs/common';
import { MeController } from './me.controller.js';
import { MeService } from './me.service.js';
import { UserinfoClient } from './userinfo.client.js';

@Module({
  controllers: [MeController],
  providers: [UserinfoClient, MeService],
})
export class MeModule {}
