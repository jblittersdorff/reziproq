import { Controller, Get, Inject, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import type { DataExportList } from '@reziproq/shared';
import type { Response } from 'express';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { DataExportService } from './data-export.service.js';
import { DataExportWorker } from './data-export.worker.js';

/** QS-03: Einstellungen › Datenexport; nur Admins, nur die eigene Organisation. */
@Controller('einstellungen/export')
export class DataExportController {
  constructor(
    @Inject(DataExportService) private readonly exports: DataExportService,
    @Inject(DataExportWorker) private readonly worker: DataExportWorker,
  ) {}

  @Get()
  @Requires('datenexport.anfordern')
  list(@CurrentUser() auth: AuthContext): Promise<DataExportList> {
    return this.exports.list(auth);
  }

  @Post()
  @Requires('datenexport.anfordern')
  async request(@CurrentUser() auth: AuthContext): Promise<DataExportList> {
    await this.worker.enqueue(await this.exports.request(auth));
    return this.exports.list(auth);
  }

  @Get(':exportId/datei')
  @Requires('datenexport.anfordern')
  async download(
    @CurrentUser() auth: AuthContext,
    @Param('exportId', ParseUUIDPipe) exportId: string,
    @Res() response: Response,
  ) {
    const file = await this.exports.download(auth, exportId);
    response
      .type('application/zip')
      .setHeader('Cache-Control', 'no-store')
      .setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`)
      .send(file.buffer);
  }
}
