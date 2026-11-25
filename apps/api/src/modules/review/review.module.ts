import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module.js';
import { CalendarModule } from '../calendar/calendar.module.js';
import { FeedbackModule } from '../feedback/feedback.module.js';
import { MeetingsModule } from '../meetings/meetings.module.js';
import { RatingsModule } from '../ratings/ratings.module.js';
import { SupplierPlansModule } from '../supplier-plans/supplier-plans.module.js';
import { TodayModule } from '../today/today.module.js';
import { ReviewController } from './review.controller.js';
import { ReviewService } from './review.service.js';

/** Kurz prüfen (HE-01, K1-e.2): Entscheidung über Entwürfe über die Dienste ihrer Module */
@Module({
  imports: [
    TodayModule,
    MeetingsModule,
    SupplierPlansModule,
    FeedbackModule,
    RatingsModule,
    AgentsModule,
    CalendarModule,
  ],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
