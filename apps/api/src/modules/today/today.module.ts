import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module.js';
import { HintsModule } from '../hints/hints.module.js';
import { StartModule } from '../start/start.module.js';
import { TodayController } from './today.controller.js';
import { TriageService } from './triage.service.js';
import { TriageWorker } from './triage.worker.js';

/** Heute (HE-01): Triage, Fokus-Themen und „Als Nächstes“ */
@Module({
  imports: [StartModule, HintsModule, CalendarModule],
  controllers: [TodayController],
  providers: [TriageService, TriageWorker],
  exports: [TriageService, TriageWorker],
})
export class TodayModule {}
