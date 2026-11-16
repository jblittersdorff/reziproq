import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service.js';

/** PDF-Baustein für alle Exporte (QBR-06, später QS-03). */
@Module({ providers: [PdfService], exports: [PdfService] })
export class PrintModule {}
