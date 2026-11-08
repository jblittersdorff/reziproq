import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module.js';
import { MEETING_LIVE_SOURCES } from './live-sections.js';
import { BuyerMeetingsController, SupplierMeetingsController } from './meetings.controller.js';
import { MeetingsService } from './meetings.service.js';

@Module({
  imports: [CustomersModule],
  controllers: [BuyerMeetingsController, SupplierMeetingsController],
  // Live-Quellen melden sich hier an, sobald ihr Modul gebaut ist (QBR-03: Maßnahmen).
  providers: [MeetingsService, { provide: MEETING_LIVE_SOURCES, useValue: [] }],
  exports: [MeetingsService],
})
export class MeetingsModule {}
