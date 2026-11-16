import { Controller, Get, Inject, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { PdfService } from '../print/pdf.service.js';
import { MeetingsService } from './meetings.service.js';
import { type PrintLocale, preReadFileName, preReadHtml } from './pre-read.js';

const localeQuery = new ZodValidationPipe(z.enum(['de', 'en']).default('de'));

/**
 * QBR-06: Pre-Read als PDF, bei abgeschlossenen Terminen das Protokoll aus dem eingefrorenen
 * Stand. Inhalt genau wie die Termin-Seite der erzeugenden Seite; die Datei wird nicht gespeichert.
 */
abstract class PreReadEndpoints {
  constructor(
    private readonly meetings: MeetingsService,
    private readonly pdf: PdfService,
    private readonly side: 'buyer' | 'supplier',
  ) {}

  @Get(':meetingId/pre-read')
  @Requires('termine.sehen')
  async preRead(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Query('sprache', localeQuery) locale: PrintLocale,
    @Res() response: Response,
  ) {
    const detail =
      this.side === 'buyer'
        ? await this.meetings.buyer(auth, id, (scope) => this.meetings.detail(scope, meetingId))
        : await this.meetings.supplier(auth, id, (scope) => this.meetings.detail(scope, meetingId));
    const buffer = await this.pdf.render(preReadHtml(detail, locale));
    const fileName = preReadFileName(detail, locale);
    response
      .type('application/pdf')
      .setHeader('Cache-Control', 'no-store')
      .setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      )
      .send(buffer);
  }
}

@Controller('suppliers/:id/termine')
export class BuyerPreReadController extends PreReadEndpoints {
  constructor(
    @Inject(MeetingsService) meetings: MeetingsService,
    @Inject(PdfService) pdf: PdfService,
  ) {
    super(meetings, pdf, 'buyer');
  }
}

@Controller('kunden/:id/termine')
export class SupplierPreReadController extends PreReadEndpoints {
  constructor(
    @Inject(MeetingsService) meetings: MeetingsService,
    @Inject(PdfService) pdf: PdfService,
  ) {
    super(meetings, pdf, 'supplier');
  }
}
