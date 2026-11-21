import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  type DecideCategorySegment,
  decideCategorySegmentSchema,
  type StartCategoryRound,
  startCategoryRoundSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { CategorySegmentationService } from './segmentation.service.js';

/** WG-18: Segmentierung je Warengruppe. Rolle in der Warengruppe prüft der Dienst. */
@Controller('warengruppen/:id')
export class CategorySegmentationController {
  constructor(
    @Inject(CategorySegmentationService) private readonly segments: CategorySegmentationService,
  ) {}

  @Get('segmentierung')
  @Requires('warengruppen.sehen')
  overview(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.segments.overview(auth, id);
  }

  @Post('runden')
  @Requires('warengruppen.segmentieren')
  start(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(startCategoryRoundSchema)) body: StartCategoryRound,
  ) {
    return this.segments.start(auth, id, body);
  }

  @Post('segmente/:relationshipId')
  @Requires('warengruppen.segmentieren')
  decide(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('relationshipId', ParseUUIDPipe) relationshipId: string,
    @Body(new ZodValidationPipe(decideCategorySegmentSchema)) body: DecideCategorySegment,
  ) {
    return this.segments.decide(auth, id, relationshipId, body);
  }
}
