import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import {
  type FreezeBaseline,
  freezeBaselineSchema,
  type ImpactDetail,
  type ImpactList,
  type PnlLines,
  type RaiseMaturity,
  raiseMaturitySchema,
  type SavePnlLine,
  type SetupImpact,
  savePnlLineSchema,
  setupImpactSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { ImpactService } from './impact.service.js';

/** GuV-Wirkung je Lieferant (PNL-01, PNL-03), nur beim Käufer. */
@Controller('suppliers/:id/wirkung')
export class ImpactController {
  constructor(@Inject(ImpactService) private readonly impact: ImpactService) {}

  @Get()
  @Requires('wirkung.sehen')
  list(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ImpactList> {
    return this.impact.run(auth, id, (scope) => this.impact.list(scope));
  }

  @Get('initiativen/:initiativeId')
  @Requires('wirkung.sehen')
  detail(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
  ): Promise<ImpactDetail> {
    return this.impact.run(auth, id, (scope) => this.impact.detail(scope, initiativeId));
  }

  @Put('initiativen/:initiativeId/einrichten')
  @Requires('wirkung.bearbeiten')
  setup(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(setupImpactSchema)) body: SetupImpact,
  ): Promise<ImpactDetail> {
    return this.impact.run(auth, id, (scope) => this.impact.setup(scope, initiativeId, body));
  }

  @Post('initiativen/:initiativeId/baseline')
  @Requires('wirkung.bearbeiten')
  freeze(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(freezeBaselineSchema)) body: FreezeBaseline,
  ): Promise<ImpactDetail> {
    return this.impact.run(auth, id, (scope) => this.impact.freeze(scope, initiativeId, body));
  }

  @Post('initiativen/:initiativeId/reifegrad')
  @Requires('wirkung.bearbeiten')
  raise(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(raiseMaturitySchema)) body: RaiseMaturity,
  ): Promise<ImpactDetail> {
    return this.impact.run(auth, id, (scope) => this.impact.raise(scope, initiativeId, body));
  }
}

/** GuV-Zeilen der Organisation (PNL-01, Einstellungen). */
@Controller('pnl-lines')
export class PnlLinesController {
  constructor(@Inject(ImpactService) private readonly impact: ImpactService) {}

  @Get()
  @Requires('wirkung.sehen')
  list(@CurrentUser() auth: AuthContext): Promise<PnlLines> {
    return this.impact.lines(auth);
  }

  @Post()
  @Requires('einstellungen.verwalten')
  create(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(savePnlLineSchema)) body: SavePnlLine,
  ): Promise<PnlLines> {
    return this.impact.saveLine(auth, null, body);
  }

  @Put(':key')
  @Requires('einstellungen.verwalten')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('key') key: string,
    @Body(new ZodValidationPipe(savePnlLineSchema)) body: SavePnlLine,
  ): Promise<PnlLines> {
    return this.impact.saveLine(auth, key, body);
  }
}
