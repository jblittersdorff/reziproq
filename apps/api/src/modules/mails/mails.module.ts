import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module.js';
import { CalendarModule } from '../calendar/calendar.module.js';
import { IntegrationsModule } from '../integrations/integrations.module.js';
import { MailDraftsService } from './mail-drafts.service.js';
import {
  FiledMailsController,
  MailAddinController,
  MailDraftsController,
} from './mails.controller.js';
import { MailsService } from './mails.service.js';

/** IN-04 Mails ablegen: Outlook-Add-in, Weiterleitung, Anhänge in der Dateiablage */
@Module({
  imports: [AiGatewayModule, CalendarModule, IntegrationsModule],
  controllers: [MailAddinController, FiledMailsController, MailDraftsController],
  providers: [MailsService, MailDraftsService],
  exports: [MailsService],
})
export class MailsModule {}
