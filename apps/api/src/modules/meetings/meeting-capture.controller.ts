import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  acceptCaptureSchema,
  type DismissAiDraft,
  dismissAiDraftSchema,
  type EditCaptureItem,
  editCaptureItemSchema,
  type MeetingCapture,
  type SaveCapture,
  saveCaptureSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { MeetingCaptureService } from './meeting-capture.service.js';

/** KI-17 Ergebnisse nach dem Termin; nur im Käuferpfad, der Lieferant hat keinen Zugang. */
@Controller('suppliers/:id/termine/:meetingId/ergebnisse')
export class MeetingCaptureController {
  constructor(@Inject(MeetingCaptureService) private readonly capture: MeetingCaptureService) {}

  @Get()
  @Requires('termine.sehen')
  get(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
  ): Promise<MeetingCapture> {
    return this.capture.get(auth, id, meetingId);
  }

  @Post('auswerten')
  @HttpCode(200)
  @Requires('termine.sehen')
  evaluate(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body(new ZodValidationPipe(saveCaptureSchema)) body: SaveCapture,
  ): Promise<MeetingCapture> {
    return this.capture.evaluate(auth, id, meetingId, body);
  }

  @Post('uebernehmen')
  @HttpCode(200)
  @Requires('termine.bearbeiten')
  accept(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body(new ZodValidationPipe(acceptCaptureSchema)) body: { ids: string[] },
  ): Promise<MeetingCapture> {
    return this.capture.accept(auth, id, meetingId, body.ids);
  }

  @Put(':draftId')
  @Requires('termine.sehen')
  edit(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Param('draftId', ParseUUIDPipe) draftId: string,
    @Body(new ZodValidationPipe(editCaptureItemSchema)) body: EditCaptureItem,
  ): Promise<MeetingCapture> {
    return this.capture.edit(auth, id, meetingId, draftId, body);
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
  ): Promise<MeetingCapture> {
    return this.capture.discard(auth, id, meetingId, draftId, body?.reason ?? null);
  }

  @Post('protokoll-teilen')
  @HttpCode(200)
  @Requires('termine.bearbeiten')
  share(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
  ): Promise<MeetingCapture> {
    return this.capture.shareProtocol(auth, id, meetingId);
  }
}
