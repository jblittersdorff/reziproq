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
  Query,
} from '@nestjs/common';
import {
  type RuleSetProposal,
  type RuleSetResponse,
  type RuleSetSharePreview,
  type SaveRuleSet,
  saveRuleSetSchema,
} from '@reziproq/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { RuleSetsService } from './rule-sets.service.js';

/** Spielregeln einer Beziehung (PLB-03); sehen alle mit Zugriff, ändern Admin und SRO. */
const basisQuery = new ZodValidationPipe(z.enum(['soll', 'aktuell']).default('soll'));

@Controller('suppliers/:id/spielregeln')
export class RuleSetsController {
  constructor(@Inject(RuleSetsService) private readonly ruleSets: RuleSetsService) {}

  @Get()
  @Requires('lieferanten.sehen')
  get(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RuleSetResponse> {
    return this.ruleSets.get(auth, id);
  }

  @Get('vorschlag')
  @Requires('lieferanten.sehen')
  proposal(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('basis', basisQuery) basis: 'soll' | 'aktuell',
  ): Promise<RuleSetProposal> {
    return this.ruleSets.proposal(auth, id, basis);
  }

  @Post()
  @Requires('spielregeln.festlegen')
  adopt(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RuleSetResponse> {
    return this.ruleSets.adoptProposal(auth, id);
  }

  @Put()
  @Requires('spielregeln.festlegen')
  save(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(saveRuleSetSchema)) body: SaveRuleSet,
  ): Promise<RuleSetResponse> {
    return this.ruleSets.save(auth, id, body);
  }

  @Get('teilen')
  @Requires('spielregeln.festlegen')
  sharePreview(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RuleSetSharePreview> {
    return this.ruleSets.sharePreview(auth, id);
  }

  /** Mit dem Lieferanten teilen (SEG-10). */
  @Post('teilen')
  @HttpCode(200)
  @Requires('spielregeln.festlegen')
  share(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RuleSetResponse> {
    return this.ruleSets.share(auth, id);
  }

  @Post('freigabe')
  @HttpCode(200)
  @Requires('spielregeln.festlegen')
  approve(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RuleSetResponse> {
    return this.ruleSets.approve(auth, id);
  }
}
