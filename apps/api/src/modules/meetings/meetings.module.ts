import { Module } from '@nestjs/common';
import { ActionsLiveSource } from '../actions/action-sources.js';
import { CustomersModule } from '../customers/customers.module.js';
import { CommitmentsLiveSource, ScorecardLiveSource } from '../jbp/jbp-sources.js';
import { MEETING_LIVE_SOURCES } from './live-sections.js';
import { BuyerMeetingsController, SupplierMeetingsController } from './meetings.controller.js';
import { MeetingsService } from './meetings.service.js';

@Module({
  imports: [CustomersModule],
  controllers: [BuyerMeetingsController, SupplierMeetingsController],
  // Live-Quellen melden sich hier an, sobald ihr Modul gebaut ist.
  providers: [
    MeetingsService,
    {
      provide: MEETING_LIVE_SOURCES,
      useValue: [new ActionsLiveSource(), new CommitmentsLiveSource(), new ScorecardLiveSource()],
    },
  ],
  exports: [MeetingsService],
})
export class MeetingsModule {}
