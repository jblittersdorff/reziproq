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
  Query,
} from '@nestjs/common';
import {
  type EbitGoalRequest,
  ebitGoalRequestSchema,
  type SupplierTargetRequest,
  supplierTargetRequestSchema,
} from '@reziproq/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { InsightsService } from './insights.service.js';

const yearQuery = new ZodValidationPipe(z.coerce.number().int().min(2000).max(2100).optional());
const yearBody = new ZodValidationPipe(z.object({ year: z.number().int().min(2000).max(2100) }));

/** AW-01, NAV-10: Beleg der Übersicht (Ringpaar, Zeilen) und Jahresziel. */
@Controller('uebersicht')
export class OverviewInsightController {
  constructor(@Inject(InsightsService) private readonly insights: InsightsService) {}

  @Get()
  @Requires('wirkung.sehen')
  get(@CurrentUser() auth: AuthContext, @Query('jahr', yearQuery) year: number | undefined) {
    return this.insights.overview(auth, year);
  }

  @Put('ziel')
  @HttpCode(204)
  @Requires('wirkung.sehen')
  setGoal(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(ebitGoalRequestSchema)) body: EbitGoalRequest,
  ) {
    return this.insights.setGoal(auth, body);
  }
}

/** AW-01: Ringpaar des Lieferanten und sein EBIT-Ziel. */
@Controller('suppliers/:id/ergebnisse')
export class SupplierRingsController {
  constructor(@Inject(InsightsService) private readonly insights: InsightsService) {}

  @Get('ringe')
  @Requires('wirkung.sehen')
  rings(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('jahr', yearQuery) year: number | undefined,
  ) {
    return this.insights.supplierRings(auth, id, year);
  }

  @Get('gesichert')
  @Requires('wirkung.sehen')
  secured(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('jahr', yearQuery) year: number | undefined,
  ) {
    return this.insights.supplierSecured(auth, id, year);
  }

  @Put('ziel')
  @HttpCode(204)
  @Requires('wirkung.sehen')
  propose(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(supplierTargetRequestSchema)) body: SupplierTargetRequest,
  ) {
    return this.insights.proposeTarget(auth, id, body);
  }

  @Post('ziel/freigeben')
  @HttpCode(204)
  @Requires('wirkung.sehen')
  approve(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(yearBody) body: { year: number },
  ) {
    return this.insights.approveTarget(auth, id, body.year);
  }
}
