import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  type UpdateSegmentBoundaries,
  type UpdateSegmentCriterion,
  type UpdateSegmentType,
  type UpdateSegmentWeights,
  updateSegmentBoundariesSchema,
  updateSegmentCriterionSchema,
  updateSegmentTypeSchema,
  updateSegmentWeightsSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { SegmentModelService } from './segment-model.service.js';

@Controller('segment-model')
export class SegmentModelController {
  constructor(@Inject(SegmentModelService) private readonly segments: SegmentModelService) {}

  @Get()
  @Requires('segmentmodell.sehen')
  get(@CurrentUser() auth: AuthContext) {
    return this.segments.get(auth);
  }

  @Post('draft')
  @Requires('segmentmodell.verwalten')
  createDraft(@CurrentUser() auth: AuthContext) {
    return this.segments.createDraft(auth);
  }

  @Patch('draft/criteria/:key')
  @Requires('segmentmodell.verwalten')
  updateCriterion(
    @CurrentUser() auth: AuthContext,
    @Param('key') key: string,
    @Body(new ZodValidationPipe(updateSegmentCriterionSchema)) body: UpdateSegmentCriterion,
  ) {
    return this.segments.updateCriterion(auth, key, body);
  }

  @Put('draft/weights')
  @Requires('segmentmodell.verwalten')
  updateWeights(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(updateSegmentWeightsSchema)) body: UpdateSegmentWeights,
  ) {
    return this.segments.updateWeights(auth, body);
  }

  @Patch('draft/boundaries')
  @Requires('segmentmodell.verwalten')
  updateBoundaries(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(updateSegmentBoundariesSchema)) body: UpdateSegmentBoundaries,
  ) {
    return this.segments.updateBoundaries(auth, body);
  }

  @Patch('draft/types/:impact/:quality')
  @Requires('segmentmodell.verwalten')
  updateType(
    @CurrentUser() auth: AuthContext,
    @Param('impact', ParseIntPipe) impact: number,
    @Param('quality', ParseIntPipe) quality: number,
    @Body(new ZodValidationPipe(updateSegmentTypeSchema)) body: UpdateSegmentType,
  ) {
    return this.segments.updateType(auth, impact, quality, body);
  }

  @Post('draft/activate')
  @Requires('segmentmodell.verwalten')
  activateDraft(@CurrentUser() auth: AuthContext) {
    return this.segments.activateDraft(auth);
  }
}
