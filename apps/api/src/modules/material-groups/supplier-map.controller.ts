import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import type { SupplierMapUpdate } from '@reziproq/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { SupplierMapService } from './supplier-map.service.js';

// Die Felder prüft der Dienst (Zieljahr mit eigenem Fehlercode); hier nur ein Objekt.
const updateBody = new ZodValidationPipe(z.record(z.string(), z.unknown()));

/** WG-15 (Schritt 28): Supplier Map der Warengruppenstrategie */
@Controller('warengruppen')
export class SupplierMapController {
  constructor(@Inject(SupplierMapService) private readonly maps: SupplierMapService) {}

  @Get('strategien/:strategyId/supplier-map')
  @Requires('warengruppen.sehen')
  view(@CurrentUser() auth: AuthContext, @Param('strategyId', ParseUUIDPipe) strategyId: string) {
    return this.maps.map(auth, strategyId);
  }

  @Put('strategien/:strategyId/supplier-map/:relationshipId')
  @Requires('warengruppenstrategie.bearbeiten')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('strategyId', ParseUUIDPipe) strategyId: string,
    @Param('relationshipId', ParseUUIDPipe) relationshipId: string,
    @Body(updateBody) body: SupplierMapUpdate,
  ) {
    return this.maps.update(auth, strategyId, relationshipId, body);
  }
}
