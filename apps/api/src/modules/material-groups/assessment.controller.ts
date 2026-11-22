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
  type CustomLeverRequest,
  customLeverRequestSchema,
  type LeverChoiceRequest,
  leverChoiceRequestSchema,
  type StrategyLeverUpdate,
  type SwotRequest,
  strategyLeverUpdateSchema,
  swotRequestSchema,
} from '@reziproq/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { AssessmentService } from './assessment.service.js';

const itemChange = z.object({
  text: z.string().max(300).optional(),
  confirm: z.boolean().optional(),
});

/** WG-10: Bewertung und Hebel in Schritt 6, Hebelkatalog des Kunden. */
@Controller('warengruppen')
export class AssessmentController {
  constructor(@Inject(AssessmentService) private readonly assessment: AssessmentService) {}

  @Get('hebel')
  @Requires('warengruppen.sehen')
  levers(@CurrentUser() auth: AuthContext) {
    return this.assessment.levers(auth);
  }

  @Post('hebel')
  @Requires('warengruppenstrategie.bearbeiten')
  addLever(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(customLeverRequestSchema)) body: CustomLeverRequest,
  ) {
    return this.assessment.addCustomLever(auth, body);
  }

  @Patch('hebel/:id')
  @Requires('stammdaten.verwalten')
  updateLever(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(strategyLeverUpdateSchema)) body: StrategyLeverUpdate,
  ) {
    return this.assessment.updateLever(auth, id, body);
  }

  @Get('strategien/:strategyId/bewertung')
  @Requires('warengruppen.sehen')
  get(@CurrentUser() auth: AuthContext, @Param('strategyId', ParseUUIDPipe) strategyId: string) {
    return this.assessment.get(auth, strategyId);
  }

  @Post('strategien/:strategyId/profil')
  @Requires('warengruppenstrategie.bearbeiten')
  addItem(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Body(new ZodValidationPipe(swotRequestSchema)) body: SwotRequest,
  ) {
    return this.assessment.addItem(auth, strategyId, body);
  }

  @Patch('strategien/:strategyId/profil/:itemId')
  @Requires('warengruppenstrategie.bearbeiten')
  updateItem(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body(new ZodValidationPipe(itemChange)) body: z.infer<typeof itemChange>,
  ) {
    return this.assessment.updateItem(auth, strategyId, itemId, body);
  }

  @Delete('strategien/:strategyId/profil/:itemId')
  @Requires('warengruppenstrategie.bearbeiten')
  removeItem(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.assessment.removeItem(auth, strategyId, itemId);
  }

  @Post('strategien/:strategyId/paarungen')
  @Requires('warengruppenstrategie.bearbeiten')
  addChoice(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Body(new ZodValidationPipe(leverChoiceRequestSchema)) body: LeverChoiceRequest,
  ) {
    return this.assessment.addChoice(auth, strategyId, body);
  }

  @Patch('strategien/:strategyId/paarungen/:choiceId')
  @Requires('warengruppenstrategie.bearbeiten')
  updateChoice(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('choiceId', ParseUUIDPipe) choiceId: string,
    @Body(new ZodValidationPipe(leverChoiceRequestSchema)) body: LeverChoiceRequest,
  ) {
    return this.assessment.updateChoice(auth, strategyId, choiceId, body);
  }

  @Delete('strategien/:strategyId/paarungen/:choiceId')
  @Requires('warengruppenstrategie.bearbeiten')
  removeChoice(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('choiceId', ParseUUIDPipe) choiceId: string,
  ) {
    return this.assessment.removeChoice(auth, strategyId, choiceId);
  }
}
