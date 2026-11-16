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
  type ConsolidateRequest,
  consolidateRequestSchema,
  type SaveRating,
  saveRatingSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { ConsolidationService } from './consolidation.service.js';
import { DeviationExplanationsService } from './deviation-explanations.service.js';
import { RatingsService } from './ratings.service.js';

@Controller('ratings')
export class RatingsController {
  constructor(
    @Inject(RatingsService) private readonly ratings: RatingsService,
    @Inject(ConsolidationService) private readonly consolidation: ConsolidationService,
    @Inject(DeviationExplanationsService)
    private readonly explanations: DeviationExplanationsService,
  ) {}

  @Get('mine')
  @Requires('bewertungen.sehen')
  mine(@CurrentUser() auth: AuthContext) {
    return this.ratings.mine(auth);
  }

  @Get('relationship/:relationshipId')
  @Requires('bewertungen.sehen')
  forRelationship(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', ParseUUIDPipe) relationshipId: string,
  ) {
    return this.ratings.forRelationship(auth, relationshipId);
  }

  @Get('relationship/:relationshipId/segmentation')
  @Requires('bewertungen.sehen')
  segmentation(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', ParseUUIDPipe) relationshipId: string,
  ) {
    return this.ratings.segmentation(auth, relationshipId);
  }

  // SEG-11: KI erklärt die größten Abweichungen; übernommene Erklärungen sieht, wer die
  // Segmentierung sieht, Entwürfe nur SRO und Admin.
  @Get('relationship/:relationshipId/segmentation/explanations')
  @Requires('bewertungen.sehen')
  deviationExplanations(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', ParseUUIDPipe) relationshipId: string,
  ) {
    return this.explanations.list(auth, relationshipId);
  }

  @Post('relationship/:relationshipId/segmentation/explanations')
  @HttpCode(200)
  @Requires('segmentierung.konsolidieren')
  explainDeviations(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', ParseUUIDPipe) relationshipId: string,
  ) {
    return this.explanations.explain(auth, relationshipId);
  }

  @Post('relationship/:relationshipId/segmentation/explanations/:draftId/accept')
  @HttpCode(200)
  @Requires('segmentierung.konsolidieren')
  acceptExplanation(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', ParseUUIDPipe) relationshipId: string,
    @Param('draftId', ParseUUIDPipe) draftId: string,
  ) {
    return this.explanations.decide(auth, relationshipId, draftId, 'accepted');
  }

  @Post('relationship/:relationshipId/segmentation/explanations/:draftId/discard')
  @HttpCode(200)
  @Requires('segmentierung.konsolidieren')
  discardExplanation(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', ParseUUIDPipe) relationshipId: string,
    @Param('draftId', ParseUUIDPipe) draftId: string,
  ) {
    return this.explanations.decide(auth, relationshipId, draftId, 'discarded');
  }

  @Get('relationship/:relationshipId/decisions')
  @Requires('bewertungen.sehen')
  decisions(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', ParseUUIDPipe) relationshipId: string,
  ) {
    return this.consolidation.history(auth, relationshipId);
  }

  @Post('relationship/:relationshipId/decisions')
  @HttpCode(200)
  @Requires('segmentierung.konsolidieren')
  consolidate(
    @CurrentUser() auth: AuthContext,
    @Param('relationshipId', ParseUUIDPipe) relationshipId: string,
    @Body(new ZodValidationPipe(consolidateRequestSchema)) body: ConsolidateRequest,
  ) {
    return this.consolidation.consolidate(auth, relationshipId, body);
  }

  @Get(':id')
  @Requires('bewertungen.sehen')
  get(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.ratings.get(auth, id);
  }

  @Put(':id')
  @Requires('bewertungen.abgeben')
  save(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(saveRatingSchema)) body: SaveRating,
  ) {
    return this.ratings.save(auth, id, body);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @Requires('bewertungen.abgeben')
  submit(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.ratings.submit(auth, id);
  }
}
