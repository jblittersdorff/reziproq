import { Module } from '@nestjs/common';
import { SurveyController } from './feedback.controller.js';
import { SurveyService } from './survey.service.js';

/** Feedback (PUL-01 ff.): Fragebogen, später Wellen und Auswertung. */
@Module({
  controllers: [SurveyController],
  providers: [SurveyService],
  exports: [SurveyService],
})
export class FeedbackModule {}
