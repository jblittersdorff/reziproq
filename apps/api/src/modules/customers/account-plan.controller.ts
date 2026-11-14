import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  type AccountPlan,
  type SaveAccountObjective,
  type SaveAccountSummary,
  type SaveAccountView,
  saveAccountObjectiveSchema,
  saveAccountSummarySchema,
  saveAccountViewSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { AccountPlanService } from './account-plan.service.js';

/** LIF-03: Eigene Sicht des Lieferanten auf einen Kunden; der Käufer erreicht sie nie. */
@Controller('kunden/:id/eigene-sicht')
export class AccountPlanController {
  constructor(@Inject(AccountPlanService) private readonly plans: AccountPlanService) {}

  @Get()
  @Requires('kunden.sehen')
  get(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AccountPlan> {
    return this.plans.get(auth, id);
  }

  @Put('zusammenfassung')
  @Requires('eigene_sicht.bearbeiten')
  summary(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(saveAccountSummarySchema)) body: SaveAccountSummary,
  ): Promise<AccountPlan> {
    return this.plans.saveSummary(auth, id, body);
  }

  @Put('sicht')
  @Requires('eigene_sicht.bearbeiten')
  view(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(saveAccountViewSchema)) body: SaveAccountView,
  ): Promise<AccountPlan> {
    return this.plans.saveView(auth, id, body);
  }

  @Post('ziele')
  @Requires('eigene_sicht.bearbeiten')
  addObjective(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(saveAccountObjectiveSchema)) body: SaveAccountObjective,
  ): Promise<AccountPlan> {
    return this.plans.saveObjective(auth, id, null, body);
  }

  @Put('ziele/:objectiveId')
  @Requires('eigene_sicht.bearbeiten')
  updateObjective(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('objectiveId', ParseUUIDPipe) objectiveId: string,
    @Body(new ZodValidationPipe(saveAccountObjectiveSchema)) body: SaveAccountObjective,
  ): Promise<AccountPlan> {
    return this.plans.saveObjective(auth, id, objectiveId, body);
  }

  @Delete('ziele/:objectiveId')
  @Requires('eigene_sicht.bearbeiten')
  removeObjective(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('objectiveId', ParseUUIDPipe) objectiveId: string,
  ): Promise<AccountPlan> {
    return this.plans.saveObjective(auth, id, objectiveId, null);
  }
}
