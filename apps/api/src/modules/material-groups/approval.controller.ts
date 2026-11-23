import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import {
  type ApprovalSettings,
  approvalSettingsSchema,
  type RelevanceOverride,
  type SummaryRequest,
} from '@reziproq/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { ApprovalService } from './approval.service.js';

// Die Felder prüft der Dienst (mit eigenem Fehlercode); hier nur ein Objekt.
const body = new ZodValidationPipe(z.record(z.string(), z.unknown()));

/** WG-16 (Schritt 30): Freigabe, Relevanz, Zusammenfassung, Unterschriften und Versionen */
@Controller('warengruppen')
export class ApprovalController {
  constructor(@Inject(ApprovalService) private readonly approvals: ApprovalService) {}

  @Get('freigabeweg')
  @Requires('warengruppen.sehen')
  settings(@CurrentUser() auth: AuthContext) {
    return this.approvals.settings(auth);
  }

  @Put('freigabeweg')
  @Requires('stammdaten.verwalten')
  saveSettings(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(approvalSettingsSchema)) input: ApprovalSettings,
  ) {
    return this.approvals.saveSettings(auth, input);
  }

  @Get('strategien/:strategyId/freigabe')
  @Requires('warengruppen.sehen')
  view(@CurrentUser() auth: AuthContext, @Param('strategyId', ParseUUIDPipe) strategyId: string) {
    return this.approvals.view(auth, strategyId);
  }

  @Put('strategien/:strategyId/relevanz')
  @Requires('warengruppenstrategie.bearbeiten')
  relevance(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Body(body) input: Record<string, unknown>,
  ) {
    return this.approvals.saveRelevance(auth, strategyId, input);
  }

  @Put('strategien/:strategyId/relevanz/uebersteuern')
  @Requires('stammdaten.verwalten')
  override(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Body(body) input: RelevanceOverride,
  ) {
    return this.approvals.overrideRelevance(auth, strategyId, input);
  }

  @Put('strategien/:strategyId/zusammenfassung')
  @Requires('warengruppenstrategie.bearbeiten')
  summary(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Body(body) input: SummaryRequest,
  ) {
    return this.approvals.saveSummary(auth, strategyId, input);
  }

  @Post('strategien/:strategyId/zusammenfassung/bestaetigen')
  @Requires('warengruppenstrategie.bearbeiten')
  confirm(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
  ) {
    return this.approvals.confirmSummary(auth, strategyId);
  }

  @Post('strategien/:strategyId/vorlegen')
  @Requires('warengruppenstrategie.bearbeiten')
  submit(@CurrentUser() auth: AuthContext, @Param('strategyId', ParseUUIDPipe) strategyId: string) {
    return this.approvals.submit(auth, strategyId);
  }

  @Post('strategien/:strategyId/neue-version')
  @Requires('warengruppenstrategie.bearbeiten')
  newVersion(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
  ) {
    return this.approvals.newVersion(auth, strategyId);
  }

  // Unterschreiben und Zurückgeben dürfen Freigebende auch ohne Recht an der Strategie
  @Post('freigaben/:approvalId/unterschreiben')
  @Requires('warengruppen.sehen')
  sign(@CurrentUser() auth: AuthContext, @Param('approvalId', ParseUUIDPipe) approvalId: string) {
    return this.approvals.sign(auth, approvalId);
  }

  @Post('freigaben/:approvalId/zurueckgeben')
  @Requires('warengruppen.sehen')
  giveBack(
    @CurrentUser() auth: AuthContext,
    @Param('approvalId', ParseUUIDPipe) approvalId: string,
    @Body(body) input: Record<string, unknown>,
  ) {
    return this.approvals.returnStrategy(auth, approvalId, input);
  }
}
