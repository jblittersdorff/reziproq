import { Module } from '@nestjs/common';
import { ActionsModule } from '../actions/actions.module.js';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module.js';
import { ActionsLiveSource } from '../actions/action-sources.js';
import { AiDraftsModule } from '../ai-drafts/ai-drafts.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import {
  CommitmentsLiveSource,
  InitiativesLiveSource,
  ScorecardLiveSource,
} from '../jbp/jbp-sources.js';
import { JbpModule } from '../jbp/jbp.module.js';
import { PrintModule } from '../print/print.module.js';
import { MEETING_LIVE_SOURCES } from './live-sections.js';
import { BriefSettingsController, MeetingBriefController } from './meeting-brief.controller.js';
import { MeetingBriefService } from './meeting-brief.service.js';
import { MeetingCaptureController } from './meeting-capture.controller.js';
import { MeetingCaptureService } from './meeting-capture.service.js';
import { BuyerMeetingsController, SupplierMeetingsController } from './meetings.controller.js';
import { MeetingsService } from './meetings.service.js';
import { BuyerPreReadController, SupplierPreReadController } from './pre-read.controller.js';
import { PreReadDraftService } from './pre-read-draft.service.js';

@Module({
  imports: [
    AiDraftsModule,
    AiGatewayModule,
    ActionsModule,
    CustomersModule,
    JbpModule,
    PrintModule,
  ],
  controllers: [
    MeetingBriefController,
    MeetingCaptureController,
    BriefSettingsController,
    BuyerMeetingsController,
    SupplierMeetingsController,
    BuyerPreReadController,
    SupplierPreReadController,
  ],
  // Live-Quellen melden sich hier an, sobald ihr Modul gebaut ist.
  providers: [
    MeetingsService,
    PreReadDraftService,
    MeetingBriefService,
    MeetingCaptureService,
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
  exports: [MeetingsService, PreReadDraftService, MeetingBriefService, MeetingCaptureService],
})
export class MeetingsModule {}
