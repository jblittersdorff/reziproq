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
  Post,
  Put,
} from '@nestjs/common';
import {
  type CandidateRequest,
  candidateRequestSchema,
  saveAnalysisSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { AnalysisService } from './analysis.service.js';

/** WG-07: Analysen der Schritte 3 und 4 und weitere verfügbare Lieferanten. */
@Controller('warengruppen/strategien/:strategyId')
export class AnalysisController {
  constructor(@Inject(AnalysisService) private readonly analyses: AnalysisService) {}

  @Get('schritte/:step/analysen')
  @Requires('warengruppen.sehen')
  step(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('step') step: string,
  ) {
    const n = Number(step);
    if (n !== 3 && n !== 4) throw new BadRequestException({ code: 'invalid_step' });
    return this.analyses.step(auth, strategyId, n);
  }

  @Put('analysen/:view')
  @Requires('warengruppenstrategie.bearbeiten')
  save(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('view') view: string,
    @Body(new ZodValidationPipe(saveAnalysisSchema)) body: { data: unknown },
  ) {
    return this.analyses.save(auth, strategyId, view, body.data);
  }

  @Post('kandidaten')
  @Requires('warengruppenstrategie.bearbeiten')
  addCandidate(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Body(new ZodValidationPipe(candidateRequestSchema)) body: CandidateRequest,
  ) {
    return this.analyses.addCandidate(auth, strategyId, body);
  }

  @Delete('kandidaten/:id')
  @Requires('warengruppenstrategie.bearbeiten')
  removeCandidate(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.analyses.removeCandidate(auth, strategyId, id);
  }

  @Post('kandidaten/:id/lieferant')
  @HttpCode(201)
  @Requires('warengruppenstrategie.bearbeiten')
  toSupplier(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.analyses.candidateToSupplier(auth, strategyId, id);
  }
}
