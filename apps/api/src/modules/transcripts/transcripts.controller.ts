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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  type ConfirmWorksAgreement,
  confirmWorksAgreementSchema,
  maxTranscriptUploadBytes,
  type SaveTranscriptSettings,
  saveTranscriptSettingsSchema,
  transcriptOptInSchema,
  transcriptReleaseSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { TranscriptsService } from './transcripts.service.js';

type Upload = { originalname: string; buffer: Buffer } | undefined;

/** IN-05: Einstellungen › Anbindungen › Transkripte (Admin) */
@Controller('einstellungen/transkripte')
export class TranscriptSettingsController {
  constructor(@Inject(TranscriptsService) private readonly transcripts: TranscriptsService) {}

  @Get()
  @Requires('einstellungen.verwalten')
  settings(@CurrentUser() auth: AuthContext) {
    return this.transcripts.settings(auth);
  }

  @Put()
  @Requires('einstellungen.verwalten')
  save(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(saveTranscriptSettingsSchema)) body: SaveTranscriptSettings,
  ) {
    return this.transcripts.saveSettings(auth, body);
  }

  /** Betriebsvereinbarung bestätigen; die Datei ist optional (Formularfeld file) */
  @Post('betriebsvereinbarung')
  @HttpCode(200)
  @Requires('einstellungen.verwalten')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  confirm(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(confirmWorksAgreementSchema)) body: ConfirmWorksAgreement,
    @UploadedFile() file: Upload,
  ) {
    return this.transcripts.confirmAgreement(auth, body, file);
  }
}

/** IN-05: Transkript eines Termins, nur beim Käufer */
@Controller('suppliers/:id/termine/:meetingId/transkript')
export class MeetingTranscriptController {
  constructor(@Inject(TranscriptsService) private readonly transcripts: TranscriptsService) {}

  @Get()
  @Requires('termine.sehen')
  state(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
  ) {
    return this.transcripts.state(auth, id, meetingId);
  }

  @Put('opt-in')
  @Requires('termine.bearbeiten')
  optIn(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body(new ZodValidationPipe(transcriptOptInSchema)) body: { optIn: boolean },
  ) {
    return this.transcripts.setOptIn(auth, id, meetingId, body.optIn);
  }

  @Put('freigabe')
  @Requires('termine.bearbeiten')
  release(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body(new ZodValidationPipe(transcriptReleaseSchema)) body: { released: boolean },
  ) {
    return this.transcripts.release(auth, id, meetingId, body.released);
  }

  @Get('text')
  @Requires('termine.sehen')
  text(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
  ) {
    return this.transcripts.text(auth, id, meetingId);
  }

  @Post('upload')
  @HttpCode(200)
  @Requires('termine.bearbeiten')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: maxTranscriptUploadBytes } }))
  upload(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @UploadedFile() file: Upload,
  ) {
    return this.transcripts.upload(auth, id, meetingId, file);
  }
}
