import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module.js';
import { RoundsController } from './rounds.controller.js';
import { RoundsService } from './rounds.service.js';

@Module({
  imports: [EmailModule],
  controllers: [RoundsController],
  providers: [RoundsService],
  exports: [RoundsService],
})
export class RoundsModule {}
