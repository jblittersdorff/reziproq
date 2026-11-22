import { Module } from '@nestjs/common';
import { ActionsLiveSource } from '../actions/action-sources.js';
import { AiDraftsModule } from '../ai-drafts/ai-drafts.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import {
  CommitmentsLiveSource,
  InitiativesLiveSource,
  ScorecardLiveSource,
} from '../jbp/jbp-sources.js';
import { PrintModule } from '../print/print.module.js';
import { MEETING_LIVE_SOURCES } from './live-sections.js';
import { BuyerMeetingsController, SupplierMeetingsController } from './meetings.controller.js';
import { MeetingsService } from './meetings.service.js';
import { BuyerPreReadController, SupplierPreReadController } from './pre-read.controller.js';
import { PreReadDraftService } from './pre-read-draft.service.js';

@Module({
  imports: [AiDraftsModule, CustomersModule, PrintModule],
  controllers: [
    BuyerMeetingsController,
    SupplierMeetingsController,
    BuyerPreReadController,
    SupplierPreReadController,
  ],
  // Live-Quellen melden sich hier an, sobald ihr Modul gebaut ist.
  providers: [
    MeetingsService,
    PreReadDraftService,
    {
      provide: MEETING_LIVE_SOURCES,
      useValue: [
        new ActionsLiveSource(),
        new CommitmentsLiveSource(),
        new InitiativesLiveSource(),
        new ScorecardLiveSource(),
      ],
    },
  ],
  exports: [MeetingsService, PreReadDraftService],
})
export class MeetingsModule {}
