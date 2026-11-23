import { Module } from '@nestjs/common';
import { FILE_STORE, LocalFileStore } from '../../common/file-store.js';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module.js';
import { CalendarModule } from '../calendar/calendar.module.js';
import { IntegrationsModule } from '../integrations/integrations.module.js';
import { FiledMailsController, MailAddinController } from './mails.controller.js';
import { MailsService } from './mails.service.js';

/** IN-04 Mails ablegen: Outlook-Add-in, Weiterleitung, Anhänge in der Dateiablage */
@Module({
  imports: [AiGatewayModule, CalendarModule, IntegrationsModule],
  controllers: [MailAddinController, FiledMailsController],
  providers: [MailsService, { provide: FILE_STORE, useClass: LocalFileStore }],
  exports: [MailsService],
})
export class MailsModule {}
