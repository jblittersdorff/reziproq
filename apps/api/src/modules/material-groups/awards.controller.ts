import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { type AwardEligibility, type AwardRequest, awardEligibilitySchema } from '@reziproq/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { AwardsService } from './awards.service.js';

// Die Felder prüft der Dienst (Name und Lieferanten mit eigenem Fehlercode); hier nur ein Objekt.
const awardBody = new ZodValidationPipe(z.record(z.string(), z.unknown()));

/** WG-14 (Schritt 29): Vergabeplan der Warengruppenstrategie */
@Controller('warengruppen')
export class AwardsController {
  constructor(@Inject(AwardsService) private readonly awards: AwardsService) {}

  @Get('vergabefaehigkeit')
  @Requires('warengruppen.sehen')
  eligibility(@CurrentUser() auth: AuthContext) {
    return this.awards.eligibility(auth);
  }

  @Put('vergabefaehigkeit')
  @Requires('stammdaten.verwalten')
  saveEligibility(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(awardEligibilitySchema)) body: AwardEligibility,
  ) {
    return this.awards.saveEligibility(auth, body);
  }

  @Get('strategien/:strategyId/vergaben')
  @Requires('warengruppen.sehen')
  plan(@CurrentUser() auth: AuthContext, @Param('strategyId', ParseUUIDPipe) strategyId: string) {
    return this.awards.plan(auth, strategyId);
  }

  @Post('strategien/:strategyId/vergaben')
  @Requires('warengruppenstrategie.bearbeiten')
  create(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Body(awardBody) body: AwardRequest,
  ) {
    return this.awards.create(auth, strategyId, body);
  }

  @Patch('strategien/:strategyId/vergaben/:id')
  @Requires('warengruppenstrategie.bearbeiten')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(awardBody) body: AwardRequest,
  ) {
    return this.awards.update(auth, strategyId, id, body);
  }

  @Delete('strategien/:strategyId/vergaben/:id')
  @Requires('warengruppenstrategie.bearbeiten')
  remove(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.awards.remove(auth, strategyId, id);
  }
}
