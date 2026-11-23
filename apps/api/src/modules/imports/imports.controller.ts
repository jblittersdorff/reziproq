import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  type DecideImportRows,
  decideImportRowsSchema,
  type ImportBatchKind,
  importBatchKinds,
  saveColumnMapSchema,
} from '@reziproq/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { ImportsService } from './imports.service.js';

const kindQuery = new ZodValidationPipe(z.enum(importBatchKinds));
const maxUploadBytes = 10 * 1024 * 1024;

/**
 * KI-15 Import und Zuordnung (Einstellungen › Daten › Import). Anlegen, Spalten, Übernehmen und
 * Rückgängig nur Admins; Prüfen auch Commodity Manager für ihre Warengruppen. Nur beim Käufer.
 */
@Controller('einstellungen/importe')
export class ImportsController {
  constructor(@Inject(ImportsService) private readonly imports: ImportsService) {}

  @Get()
  @Requires('lieferanten.sehen')
  list(@CurrentUser() auth: AuthContext) {
    return this.imports.list(auth);
  }

  @Post()
  @Requires('einstellungen.verwalten')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: maxUploadBytes } }))
  upload(
    @CurrentUser() auth: AuthContext,
    @Query('art', kindQuery) kind: ImportBatchKind,
    @UploadedFile() file: { originalname: string; buffer: Buffer } | undefined,
  ) {
    if (!file) throw new BadRequestException({ statusCode: 400, code: 'file_required' });
    return this.imports.upload(auth, kind, file.originalname, file.buffer);
  }

  @Get(':id')
  @Requires('lieferanten.sehen')
  get(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.imports.get(auth, id);
  }

  @Get(':id/fehler.csv')
  @Requires('lieferanten.sehen')
  async errors(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ) {
    const body = await this.imports.errorsCsv(auth, id);
    response.type('text/csv; charset=utf-8').attachment(`reziproq-import-fehler.csv`).send(body);
  }

  @Put(':id/spalten')
  @Requires('einstellungen.verwalten')
  saveMap(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(saveColumnMapSchema)) body: {
      columnMap: Record<string, string | null>;
    },
  ) {
    return this.imports.saveMap(auth, id, body.columnMap);
  }

  @Post(':id/verarbeiten')
  @HttpCode(200)
  @Requires('einstellungen.verwalten')
  process(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.imports.process(auth, id);
  }

  @Post(':id/entscheiden')
  @HttpCode(200)
  @Requires('lieferanten.sehen')
  decide(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(decideImportRowsSchema)) body: DecideImportRows,
  ) {
    return this.imports.decide(auth, id, body);
  }

  @Post(':id/uebernehmen')
  @HttpCode(200)
  @Requires('einstellungen.verwalten')
  commit(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.imports.commit(auth, id);
  }

  @Post(':id/rueckgaengig')
  @HttpCode(200)
  @Requires('einstellungen.verwalten')
  revert(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.imports.revert(auth, id);
  }

  @Post(':id/verwerfen')
  @HttpCode(200)
  @Requires('einstellungen.verwalten')
  discard(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.imports.discard(auth, id);
  }
}
