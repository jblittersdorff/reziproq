import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  createStrategySchema,
  type GoalRequest,
  type KpiRequest,
  kpiRequestSchema,
  type MilestoneRequest,
  milestoneRequestSchema,
  questionRequestSchema,
  type SaveNote,
  saveNoteSchema,
  strategyYearOf,
} from '@reziproq/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { StrategyService } from './strategy.service.js';

const yearQuery = new ZodValidationPipe(z.coerce.number().int().min(2000).max(2100).optional());
// WG-16: eine bestimmte Version lesen (ältere bleiben lesbar)
const versionQuery = new ZodValidationPipe(z.coerce.number().int().min(1).max(999).optional());

function stepOf(value: string) {
  const step = Number(value);
  if (!Number.isInteger(step) || step < 1 || step > 10) {
    throw new BadRequestException({ code: 'invalid_step' });
  }
  return step;
}

/** WG-04, WG-06: Strategie je Warengruppe und Jahr, Schritte, Ziele, Kennzahlen, Leitfragen. */
@Controller('warengruppen')
export class StrategyController {
  constructor(@Inject(StrategyService) private readonly strategies: StrategyService) {}

  @Get('strategien')
  @Requires('warengruppen.sehen')
  overview(@CurrentUser() auth: AuthContext, @Query('jahr', yearQuery) year: number | undefined) {
    return this.strategies.overview(auth, year ?? strategyYearOf(new Date()));
  }

  @Get('kennzahlen')
  @Requires('warengruppen.sehen')
  kpis(@CurrentUser() auth: AuthContext) {
    return this.strategies.kpis(auth);
  }

  @Post('kennzahlen')
  @Requires('stammdaten.verwalten')
  createKpi(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(kpiRequestSchema)) body: KpiRequest,
  ) {
    return this.strategies.saveKpi(auth, body);
  }

  @Patch('kennzahlen/:kpiId')
  @Requires('stammdaten.verwalten')
  updateKpi(
    @CurrentUser() auth: AuthContext,
    @Param('kpiId', ParseUUIDPipe) kpiId: string,
    @Body(new ZodValidationPipe(kpiRequestSchema)) body: KpiRequest,
  ) {
    return this.strategies.saveKpi(auth, body, kpiId);
  }

  @Get('leitfragen')
  @Requires('warengruppen.sehen')
  questions(@CurrentUser() auth: AuthContext) {
    return this.strategies.questions(auth);
  }

  @Patch('leitfragen/:questionId')
  @Requires('stammdaten.verwalten')
  updateQuestion(
    @CurrentUser() auth: AuthContext,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body(new ZodValidationPipe(questionRequestSchema)) body: { text: string },
  ) {
    return this.strategies.updateQuestion(auth, questionId, body.text);
  }

  @Get('strategien/:strategyId/schritte/:step')
  @Requires('warengruppen.sehen')
  step(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('step') step: string,
  ) {
    return this.strategies.step(auth, strategyId, stepOf(step));
  }

  @Put('strategien/:strategyId/schritte/:step/notiz')
  @Requires('warengruppenstrategie.bearbeiten')
  saveNote(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('step') step: string,
    @Body(new ZodValidationPipe(saveNoteSchema)) body: SaveNote,
  ) {
    return this.strategies.saveNote(auth, strategyId, stepOf(step), body);
  }

  @Post('strategien/:strategyId/meilensteine')
  @Requires('warengruppenstrategie.bearbeiten')
  addMilestone(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Body(new ZodValidationPipe(milestoneRequestSchema)) body: MilestoneRequest,
  ) {
    return this.strategies.addMilestone(auth, strategyId, body);
  }

  @Delete('strategien/:strategyId/meilensteine/:milestoneId')
  @Requires('warengruppenstrategie.bearbeiten')
  removeMilestone(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
  ) {
    return this.strategies.removeMilestone(auth, strategyId, milestoneId);
  }

  @Post('strategien/:strategyId/ziele')
  @Requires('warengruppenstrategie.bearbeiten')
  addGoal(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Body() body: GoalRequest,
  ) {
    return this.strategies.addGoal(auth, strategyId, body);
  }

  @Patch('strategien/:strategyId/ziele/:goalId')
  @Requires('warengruppenstrategie.bearbeiten')
  updateGoal(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('goalId', ParseUUIDPipe) goalId: string,
    @Body() body: GoalRequest,
  ) {
    return this.strategies.updateGoal(auth, strategyId, goalId, body);
  }

  @Delete('strategien/:strategyId/ziele/:goalId')
  @Requires('warengruppenstrategie.bearbeiten')
  removeGoal(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('goalId', ParseUUIDPipe) goalId: string,
  ) {
    return this.strategies.removeGoal(auth, strategyId, goalId);
  }

  @Get(':id/strategie')
  @Requires('warengruppen.sehen')
  context(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('jahr', yearQuery) year: number | undefined,
    @Query('version', versionQuery) version: number | undefined,
  ) {
    return this.strategies.context(auth, id, year ?? strategyYearOf(new Date()), version);
  }

  @Post(':id/strategie')
  @HttpCode(201)
  @Requires('warengruppenstrategie.bearbeiten')
  create(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createStrategySchema)) body: { year: number },
  ) {
    return this.strategies.create(auth, id, body.year);
  }
}
