import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { type SaveMarketForce, saveMarketForceSchema } from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { MarketService } from './market.service.js';

/** WG-09: Marktanalyse in Schritt 5 */
@Controller('warengruppen/strategien/:strategyId/markt')
export class MarketController {
  constructor(@Inject(MarketService) private readonly market: MarketService) {}

  @Get()
  @Requires('warengruppen.sehen')
  get(@CurrentUser() auth: AuthContext, @Param('strategyId', ParseUUIDPipe) strategyId: string) {
    return this.market.get(auth, strategyId);
  }

  @Post('entwurf')
  @Requires('warengruppenstrategie.bearbeiten')
  draft(@CurrentUser() auth: AuthContext, @Param('strategyId', ParseUUIDPipe) strategyId: string) {
    return this.market.draft(auth, strategyId);
  }

  @Post('zusammenschau/:draftId/:decision')
  @Requires('warengruppenstrategie.bearbeiten')
  synthesis(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('draftId', ParseUUIDPipe) draftId: string,
    @Param('decision') decision: string,
  ) {
    return this.market.decideSynthesis(
      auth,
      strategyId,
      draftId,
      decision === 'uebernehmen' ? 'accepted' : 'discarded',
    );
  }

  @Put(':force')
  @Requires('warengruppenstrategie.bearbeiten')
  save(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('force') force: string,
    @Body(new ZodValidationPipe(saveMarketForceSchema)) body: SaveMarketForce,
  ) {
    return this.market.save(auth, strategyId, force, body);
  }

  @Post(':force/bestaetigen')
  @Requires('warengruppenstrategie.bearbeiten')
  confirm(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('force') force: string,
  ) {
    return this.market.confirm(auth, strategyId, force);
  }

  @Post(':force/vorschlag/:decision')
  @Requires('warengruppenstrategie.bearbeiten')
  proposal(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('force') force: string,
    @Param('decision') decision: string,
  ) {
    return this.market.decideProposal(
      auth,
      strategyId,
      force,
      decision === 'uebernehmen' ? 'adopt' : 'dismiss',
    );
  }
}
