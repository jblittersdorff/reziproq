import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  type CycleArchive,
  type NextCyclePreview,
  type StartNextCycle,
  type SupplierCycle,
  startNextCycleSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { NextCycleService } from './next-cycle.service.js';

/** ZYK-05: nächster Zyklus und frühere Zyklen, beim Käufer. */
@Controller('suppliers/:id/cycle')
export class NextCycleController {
  constructor(@Inject(NextCycleService) private readonly cycles: NextCycleService) {}

  @Get('next')
  @Requires('lieferanten.sehen')
  preview(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NextCyclePreview> {
    return this.cycles.preview(auth, id);
  }

  @Post('next')
  @Requires('zyklus.starten')
  start(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(startNextCycleSchema)) body: StartNextCycle,
  ): Promise<SupplierCycle> {
    return this.cycles.start(auth, id, body);
  }

  @Get('archive')
  @Requires('lieferanten.sehen')
  archive(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CycleArchive> {
    return this.cycles.archive(auth, id);
  }
}
