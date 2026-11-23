import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  type DismissAiDraft,
  dismissAiDraftSchema,
  prepAgendaSchema,
  type QbrPrep,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { QbrPrepService } from './qbr-prep.service.js';

/** KI-07: interne QBR-Vorbereitung je Termin; nur im Käuferpfad, der Lieferant hat keinen Zugang. */
@Controller('suppliers/:id/termine/:meetingId/vorbereitung')
export class QbrPrepController {
  constructor(@Inject(QbrPrepService) private readonly prep: QbrPrepService) {}

  @Get()
  @Requires('termine.sehen')
  get(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
  ): Promise<QbrPrep> {
    return this.prep.get(auth, id, meetingId);
  }

  @Post(':draftId/uebernehmen')
  @HttpCode(200)
  @Requires('termine.sehen')
  accept(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Param('draftId', ParseUUIDPipe) draftId: string,
  ): Promise<QbrPrep> {
    return this.prep.decide(auth, id, meetingId, draftId, { status: 'accepted' });
  }

  @Post(':draftId/verwerfen')
  @HttpCode(200)
  @Requires('termine.sehen')
  discard(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Param('draftId', ParseUUIDPipe) draftId: string,
    @Body(new ZodValidationPipe(dismissAiDraftSchema.optional())) body: DismissAiDraft | undefined,
  ): Promise<QbrPrep> {
    return this.prep.decide(auth, id, meetingId, draftId, {
      status: 'discarded',
      reason: body?.reason ?? null,
    });
  }

  @Post(':draftId/agenda')
  @HttpCode(200)
  @Requires('termine.bearbeiten')
  agenda(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Param('draftId', ParseUUIDPipe) draftId: string,
    @Body(new ZodValidationPipe(prepAgendaSchema)) body: { claimKey: string },
  ): Promise<QbrPrep> {
    return this.prep.addToAgenda(auth, id, meetingId, draftId, body.claimKey);
  }
}
