import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module.js';
import { EmailService } from '../email/email.service.js';
import { DataExportController } from './data-export.controller.js';
import { DataExportService } from './data-export.service.js';
import { DataExportWorker } from './data-export.worker.js';

/** Gesamtexport der Organisation (QS-03). */
@Module({
  imports: [CustomersModule],
  controllers: [DataExportController],
  providers: [DataExportService, DataExportWorker, EmailService],
})
export class DataExportModule {}
