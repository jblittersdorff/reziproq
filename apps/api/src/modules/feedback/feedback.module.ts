import { Module } from '@nestjs/common';
import { AiDraftsModule } from '../ai-drafts/ai-drafts.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import { EmailModule } from '../email/email.module.js';
import { AnswerService } from './answer.service.js';
import { FeedbackThemesService } from './feedback-themes.service.js';
import { SurveyController } from './feedback.controller.js';
import { SurveyService } from './survey.service.js';
import {
  BuyerWavesController,
  PublicSurveyController,
  SupplierWavesController,
} from './waves.controller.js';
import { WavesService } from './waves.service.js';

/** Feedback (PUL-01 ff.): Fragebogen, Wellen, später Antworten und Auswertung. */
@Module({
  imports: [AiDraftsModule, CustomersModule, EmailModule],
  controllers: [
    SurveyController,
    BuyerWavesController,
    SupplierWavesController,
    PublicSurveyController,
  ],
  providers: [SurveyService, WavesService, AnswerService, FeedbackThemesService],
  exports: [SurveyService, WavesService],
})
export class FeedbackModule {}
