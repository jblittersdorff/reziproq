import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  type ReviewDecision,
  type ReviewResult,
  type ReviewStack,
  reviewDecisionSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { ReviewService } from './review.service.js';

/** HE-01 Kurz prüfen (K1-e.2): der Stapel der Entwürfe und die Entscheidung je Entwurf */
@Controller('kurz-pruefen')
export class ReviewController {
  constructor(@Inject(ReviewService) private readonly review: ReviewService) {}

  @Get()
  @Requires('start.sehen')
  stack(
    @CurrentUser() auth: AuthContext,
    @Query('entwurf', new ParseUUIDPipe({ optional: true })) entwurf?: string,
  ): Promise<ReviewStack> {
    return this.review.stack(auth, entwurf);
  }

  /** Übernehmen (optional angepasst), Verwerfen mit Grund oder Später */
  @Post(':id')
  @HttpCode(200)
  @Requires('start.sehen')
  decide(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reviewDecisionSchema)) body: ReviewDecision,
  ): Promise<ReviewResult> {
    return this.review.decide(auth, id, body);
  }
}
