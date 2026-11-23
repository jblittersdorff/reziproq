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
} from '@nestjs/common';
import {
  type HoldReview,
  holdReviewSchema,
  type InitiativeProgress,
  type InitiativeRequest,
  initiativeProgressSchema,
} from '@reziproq/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { ScorecardService } from './scorecard.service.js';

// Die Felder prüft der Dienst (Ziel und Hebel mit eigenem Fehlercode); hier nur ein Objekt.
const initiativeBody = new ZodValidationPipe(z.record(z.string(), z.unknown()));

/** WG-12 (Schritt 27): Scorecard der Warengruppe und Quartals-Review */
@Controller('warengruppen')
export class ScorecardController {
  constructor(@Inject(ScorecardService) private readonly scorecard: ScorecardService) {}

  @Get('strategien/:strategyId/scorecard')
  @Requires('warengruppen.sehen')
  view(@CurrentUser() auth: AuthContext, @Param('strategyId', ParseUUIDPipe) strategyId: string) {
    return this.scorecard.scorecard(auth, strategyId);
  }

  @Post('strategien/:strategyId/initiativen')
  @Requires('warengruppenstrategie.bearbeiten')
  create(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Body(initiativeBody) body: InitiativeRequest,
  ) {
    return this.scorecard.create(auth, strategyId, body);
  }

  @Patch('strategien/:strategyId/initiativen/:id')
  @Requires('warengruppenstrategie.bearbeiten')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(initiativeBody) body: InitiativeRequest,
  ) {
    return this.scorecard.update(auth, strategyId, id, body);
  }

  @Delete('strategien/:strategyId/initiativen/:id')
  @Requires('warengruppenstrategie.bearbeiten')
  remove(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scorecard.remove(auth, strategyId, id);
  }

  /** Fortschritt melden: auch die verantwortliche Person ohne Bearbeitungsrecht an der Strategie */
  @Post('strategien/:strategyId/initiativen/:id/fortschritt')
  @Requires('warengruppen.sehen')
  progress(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(initiativeProgressSchema)) body: InitiativeProgress,
  ) {
    return this.scorecard.progress(auth, strategyId, id, body);
  }

  @Get('reviews/:reviewId')
  @Requires('warengruppen.sehen')
  review(@CurrentUser() auth: AuthContext, @Param('reviewId', ParseUUIDPipe) reviewId: string) {
    return this.scorecard.review(auth, reviewId);
  }

  @Post('reviews/:reviewId/abschliessen')
  @Requires('warengruppenstrategie.bearbeiten')
  hold(
    @CurrentUser() auth: AuthContext,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body(new ZodValidationPipe(holdReviewSchema)) body: HoldReview,
  ) {
    return this.scorecard.hold(auth, reviewId, body);
  }
}
