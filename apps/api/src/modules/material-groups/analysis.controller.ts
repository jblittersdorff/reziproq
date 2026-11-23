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
  type AnalysisViewKey,
  type AssignView,
  analysisViewKeys,
  assignViewSchema,
  type CandidateRequest,
  type CommentView,
  candidateRequestSchema,
  commentViewSchema,
  saveAnalysisSchema,
} from '@reziproq/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { AnalysisService } from './analysis.service.js';

const viewPipe = new ZodValidationPipe(z.enum(analysisViewKeys));

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

  /** WG-07 (Schritt 24): Sicht Personen mit Funktion im Team zuweisen (Lead, CM, Admin) */
  @Put('analysen/:view/zuweisung')
  @Requires('warengruppen.sehen')
  assign(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('view', viewPipe) view: AnalysisViewKey,
    @Body(new ZodValidationPipe(assignViewSchema)) body: AssignView,
  ) {
    return this.analyses.assign(auth, strategyId, view, body);
  }

  /** WG-07 (Schritt 24): Kommentar zu einer Sicht; die Funktion nur zu zugewiesenen Sichten */
  @Post('analysen/:view/kommentare')
  @Requires('warengruppen.sehen')
  comment(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('view', viewPipe) view: AnalysisViewKey,
    @Body(new ZodValidationPipe(commentViewSchema)) body: CommentView,
  ) {
    return this.analyses.comment(auth, strategyId, view, body);
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
