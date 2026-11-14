import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module.js';
import { EmailModule } from '../email/email.module.js';
import { SurveyController } from './feedback.controller.js';
import { SurveyService } from './survey.service.js';
import { BuyerWavesController, SupplierWavesController } from './waves.controller.js';
import { WavesService } from './waves.service.js';

/** Feedback (PUL-01 ff.): Fragebogen, Wellen, später Antworten und Auswertung. */
@Module({
  imports: [CustomersModule, EmailModule],
  controllers: [SurveyController, BuyerWavesController, SupplierWavesController],
  providers: [SurveyService, WavesService],
  exports: [SurveyService, WavesService],
})
export class FeedbackModule {}
