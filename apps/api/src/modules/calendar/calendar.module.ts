import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module.js';
import { MeetingsModule } from '../meetings/meetings.module.js';
import { AddinController, InboxController } from './calendar.controller.js';
import { CalendarIntakeService } from './calendar.service.js';

/** IN-03 Termine aus Outlook und Google: Eingangsadresse, Kalenderabgleich, Outlook-Add-in. */
@Module({
  imports: [IntegrationsModule, MeetingsModule],
  controllers: [InboxController, AddinController],
  providers: [CalendarIntakeService],
  exports: [CalendarIntakeService],
})
export class CalendarModule {}
