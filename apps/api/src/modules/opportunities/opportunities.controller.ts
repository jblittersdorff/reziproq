import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import {
  type AdoptOpportunity,
  adoptOpportunitySchema,
  type ChangeAssumptions,
  changeAssumptionsSchema,
  dismissOpportunitySchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { OpportunitiesService } from './opportunities.service.js';

/** KI-11: Wertpotenziale eines Lieferanten; sehen alle Käufer mit Zugriff, entscheiden SRO und Admin. */
@Controller('suppliers/:id/wertpotenziale')
export class OpportunitiesController {
  constructor(@Inject(OpportunitiesService) private readonly opportunities: OpportunitiesService) {}

  @Get()
  @Requires('wirkung.sehen')
  list(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.opportunities.list(auth, id);
  }

  @Post('lauf')
  @Requires('wirkung.sehen')
  run(@CurrentUser() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.opportunities.run(auth, id);
  }

  @Put(':opportunityId/annahmen')
  @Requires('wirkung.sehen')
  change(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('opportunityId', ParseUUIDPipe) opportunityId: string,
    @Body(new ZodValidationPipe(changeAssumptionsSchema)) body: ChangeAssumptions,
  ) {
    return this.opportunities.changeAssumptions(auth, id, opportunityId, body);
  }

  @Post(':opportunityId/verwerfen')
  @Requires('wirkung.sehen')
  dismiss(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('opportunityId', ParseUUIDPipe) opportunityId: string,
    @Body(new ZodValidationPipe(dismissOpportunitySchema)) body: { reason: string },
  ) {
    return this.opportunities.dismiss(auth, id, opportunityId, body.reason);
  }

  @Get(':opportunityId/vorschlag')
  @Requires('wirkung.sehen')
  proposal(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('opportunityId', ParseUUIDPipe) opportunityId: string,
  ) {
    return this.opportunities.proposal(auth, id, opportunityId);
  }

  @Post(':opportunityId/uebernehmen')
  @Requires('wirkung.sehen')
  adopt(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('opportunityId', ParseUUIDPipe) opportunityId: string,
    @Body(new ZodValidationPipe(adoptOpportunitySchema)) body: AdoptOpportunity,
  ) {
    return this.opportunities.adopt(auth, id, opportunityId, body);
  }
}
