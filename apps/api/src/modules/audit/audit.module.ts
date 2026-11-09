import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module.js';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';

@Module({
  imports: [CustomersModule],
  controllers: [AuditController],
  providers: [AuditService],
})
export class AuditModule {}
