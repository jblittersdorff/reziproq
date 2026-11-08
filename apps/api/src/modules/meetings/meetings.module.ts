import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module.js';
import { BuyerMeetingsController, SupplierMeetingsController } from './meetings.controller.js';
import { MeetingsService } from './meetings.service.js';

@Module({
  imports: [CustomersModule],
  controllers: [BuyerMeetingsController, SupplierMeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
