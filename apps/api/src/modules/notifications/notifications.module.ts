import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module.js';
import { EmailModule } from '../email/email.module.js';
import { JbpModule } from '../jbp/jbp.module.js';
import { MeetingsModule } from '../meetings/meetings.module.js';
import {
  NotificationActionsController,
  NotificationPrefsController,
} from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsWorker } from './notifications.worker.js';
import { FakeTeamsClient, TEAMS_CLIENT } from './teams-client.js';

/** IN-06 Benachrichtigungen in Teams und per Mail */
@Module({
  imports: [CalendarModule, EmailModule, JbpModule, MeetingsModule],
  controllers: [NotificationPrefsController, NotificationActionsController],
  providers: [
    NotificationsService,
    NotificationsWorker,
    FakeTeamsClient,
    // Der echte Bot kommt mit der Bot-Registrierung (Durchstich, Block C)
    { provide: TEAMS_CLIENT, useExisting: FakeTeamsClient },
  ],
  exports: [NotificationsService, FakeTeamsClient],
})
export class NotificationsModule {}
