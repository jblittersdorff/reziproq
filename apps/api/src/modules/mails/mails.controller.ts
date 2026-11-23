import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import {
  type FileMailRequest,
  fileMailRequestSchema,
  type MailDetectRequest,
  mailDetectRequestSchema,
} from '@reziproq/shared';
import type { Response } from 'express';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { MailsService } from './mails.service.js';

/** Inhalte, die der Browser anzeigen darf; alles andere nur als Download (z. B. HTML aus Mails) */
const safeTypes =
  /^(application\/pdf|image\/(png|jpeg|gif|webp)|text\/plain|text\/csv|application\/(vnd\.openxmlformats-officedocument\.[\w.]+|vnd\.ms-excel|msword|zip))$/;

/** IN-04: Outlook-Add-in in einer gelesenen Mail */
@Controller('mails/addin')
export class MailAddinController {
  constructor(@Inject(MailsService) private readonly mails: MailsService) {}

  @Post('erkennen')
  @HttpCode(200)
  @Requires('aktivitaeten.sehen')
  detect(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(mailDetectRequestSchema)) body: MailDetectRequest,
  ) {
    return this.mails.detect(auth, body);
  }

  @Post('ablegen')
  @HttpCode(200)
  @Requires('notizen.schreiben')
  file(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(fileMailRequestSchema)) body: FileMailRequest,
  ) {
    return this.mails.fileFromAddin(auth, body);
  }
}

/** IN-04: abgelegte Mails eines Lieferanten: Text aufklappen, Anhang laden, löschen */
@Controller('suppliers/:id/mails')
export class FiledMailsController {
  constructor(@Inject(MailsService) private readonly mails: MailsService) {}

  @Get(':mailId')
  @Requires('aktivitaeten.sehen')
  body(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mailId', ParseUUIDPipe) mailId: string,
  ) {
    return this.mails.body(auth, id, mailId);
  }

  @Get(':mailId/anhaenge/:attachmentId')
  @Requires('aktivitaeten.sehen')
  async attachment(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mailId', ParseUUIDPipe) mailId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Res() response: Response,
  ) {
    const file = await this.mails.attachment(auth, id, mailId, attachmentId);
    response
      .type(safeTypes.test(file.mime) ? file.mime : 'application/octet-stream')
      .setHeader('Cache-Control', 'no-store')
      .setHeader('X-Content-Type-Options', 'nosniff')
      .setHeader(
        'Content-Disposition',
        `attachment; filename="${file.fileName.replace(/[^\x20-\x7e]|"/g, '_')}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      )
      .send(file.bytes);
  }

  @Delete(':mailId')
  @HttpCode(204)
  @Requires('notizen.schreiben')
  async remove(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mailId', ParseUUIDPipe) mailId: string,
  ) {
    await this.mails.remove(auth, id, mailId);
  }
}
