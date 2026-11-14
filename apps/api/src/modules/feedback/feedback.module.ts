import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module.js';
import { EmailModule } from '../email/email.module.js';
import { SurveyController } from './feedback.controller.js';
import { SurveyService } from './survey.service.js';
import { AnswerService } from './answer.service.js';
import {
  BuyerWavesController,
  PublicSurveyController,
  SupplierWavesController,
} from './waves.controller.js';
import { WavesService } from './waves.service.js';

/** Feedback (PUL-01 ff.): Fragebogen, Wellen, später Antworten und Auswertung. */
@Module({
  imports: [CustomersModule, EmailModule],
  controllers: [
    SurveyController,
    BuyerWavesController,
    SupplierWavesController,
    PublicSurveyController,
  ],
  providers: [SurveyService, WavesService, AnswerService],
  exports: [SurveyService, WavesService],
})
export class FeedbackModule {}
