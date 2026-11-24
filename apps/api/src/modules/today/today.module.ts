import { Module } from '@nestjs/common';
import { HintsModule } from '../hints/hints.module.js';
import { StartModule } from '../start/start.module.js';
import { TodayController } from './today.controller.js';
import { TriageService } from './triage.service.js';
import { TriageWorker } from './triage.worker.js';

/** Heute (HE-01): Triage, Fokus-Themen und „Als Nächstes“ */
@Module({
  imports: [StartModule, HintsModule],
  controllers: [TodayController],
  providers: [TriageService, TriageWorker],
  exports: [TriageService, TriageWorker],
})
export class TodayModule {}
