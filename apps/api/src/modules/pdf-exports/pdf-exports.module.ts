import { Module } from '@nestjs/common';
import { FeedbackModule } from '../feedback/feedback.module.js';
import { JbpModule } from '../jbp/jbp.module.js';
import { PrintModule } from '../print/print.module.js';
import { SupplierPlansModule } from '../supplier-plans/supplier-plans.module.js';
import { SuppliersModule } from '../suppliers/suppliers.module.js';
import {
  BuyerPdfController,
  SupplierPdfController,
  SupplierPlanPdfController,
} from './pdf-exports.controller.js';

/** PDFs für Gremien und Account Planning (QS-03, SPL-08, LIF-06), auf dem Baustein aus QBR-06. */
@Module({
  imports: [PrintModule, JbpModule, FeedbackModule, SupplierPlansModule, SuppliersModule],
  controllers: [SupplierPlanPdfController, BuyerPdfController, SupplierPdfController],
})
export class PdfExportsModule {}
