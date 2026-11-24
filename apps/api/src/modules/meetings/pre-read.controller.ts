import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { currentTime } from '@reziproq/db';
import {
  type AcceptPreRead,
  acceptPreReadSchema,
  type DismissAiDraft,
  dismissAiDraftSchema,
  type PreReadDraft,
} from '@reziproq/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { PdfService } from '../print/pdf.service.js';
import { MeetingsService } from './meetings.service.js';
import { type PrintLocale, preReadFileName, preReadHtml } from './pre-read.js';
import { PreReadDraftService } from './pre-read-draft.service.js';

const localeQuery = new ZodValidationPipe(z.enum(['de', 'en']).default('de'));

/**
 * QBR-06: Pre-Read als PDF, bei abgeschlossenen Terminen das Protokoll aus dem eingefrorenen
 * Stand. Inhalt genau wie die Termin-Seite der erzeugenden Seite; die Datei wird nicht gespeichert.
 */
abstract class PreReadEndpoints {
  constructor(
    private readonly meetings: MeetingsService,
    private readonly pdf: PdfService,
    private readonly drafts: PreReadDraftService,
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
    // QBR-07: Die übernommene Zusammenfassung kommt nur aus der eigenen Seite (org_private).
    const read = async (scope: Parameters<Parameters<MeetingsService['buyer']>[2]>[0]) => ({
      detail: await this.meetings.detail(scope, meetingId),
      summary: await this.drafts.acceptedIn(scope, meetingId),
    });
    const { detail, summary } =
      this.side === 'buyer'
        ? await this.meetings.buyer(auth, id, read)
        : await this.meetings.supplier(auth, id, read);
    const buffer = await this.pdf.render(preReadHtml(detail, locale, currentTime(), summary));
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

  // QBR-07: KI-Entwurf der Zusammenfassung im Pre-Read, nur für die eigene Seite.
  @Get(':meetingId/zusammenfassung')
  @Requires('termine.sehen')
  summaryDraft(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
  ): Promise<PreReadDraft> {
    return this.drafts.get(this.side, auth, id, meetingId);
  }

  @Post(':meetingId/zusammenfassung')
  @HttpCode(200)
  @Requires('termine.sehen')
  proposeSummary(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
  ): Promise<PreReadDraft> {
    return this.drafts.propose(this.side, auth, id, meetingId);
  }

  @Post(':meetingId/zusammenfassung/:draftId/uebernehmen')
  @HttpCode(200)
  @Requires('termine.sehen')
  acceptSummary(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Param('draftId', ParseUUIDPipe) draftId: string,
    @Body(new ZodValidationPipe(acceptPreReadSchema)) body: AcceptPreRead,
  ): Promise<PreReadDraft> {
    return this.drafts.decide(this.side, auth, id, meetingId, draftId, {
      status: 'accepted',
      input: body,
    });
  }

  @Post(':meetingId/zusammenfassung/:draftId/verwerfen')
  @HttpCode(200)
  @Requires('termine.sehen')
  discardSummary(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Param('draftId', ParseUUIDPipe) draftId: string,
    @Body(new ZodValidationPipe(dismissAiDraftSchema.optional())) body: DismissAiDraft | undefined,
  ): Promise<PreReadDraft> {
    return this.drafts.decide(this.side, auth, id, meetingId, draftId, {
      status: 'discarded',
      reason: body?.reason,
    });
  }
}

@Controller('suppliers/:id/termine')
export class BuyerPreReadController extends PreReadEndpoints {
  constructor(
    @Inject(MeetingsService) meetings: MeetingsService,
    @Inject(PdfService) pdf: PdfService,
    @Inject(PreReadDraftService) drafts: PreReadDraftService,
  ) {
    super(meetings, pdf, drafts, 'buyer');
  }
}

@Controller('kunden/:id/termine')
export class SupplierPreReadController extends PreReadEndpoints {
  constructor(
    @Inject(MeetingsService) meetings: MeetingsService,
    @Inject(PdfService) pdf: PdfService,
    @Inject(PreReadDraftService) drafts: PreReadDraftService,
  ) {
    super(meetings, pdf, drafts, 'supplier');
  }
}
