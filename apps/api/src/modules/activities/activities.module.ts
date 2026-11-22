import { Module } from '@nestjs/common';
import { ActivitiesController } from './activities.controller.js';
import { ActivitiesService } from './activities.service.js';

/** NAV-10: Aktivitäten und Notizen eines Lieferanten */
@Module({
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
})
export class ActivitiesModule {}
