import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import type { SupplierCycle, SupplierOverview } from '@reziproq/shared';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { OverviewService } from './overview.service.js';

@Controller('suppliers')
export class OverviewController {
  constructor(@Inject(OverviewService) private readonly overviews: OverviewService) {}

  /** Kopf und Kennzahlen des Arbeitsbereichs (NAV-06) */
  @Get(':id/overview')
  @Requires('lieferanten.sehen')
  overview(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SupplierOverview> {
    return this.overviews.overview(auth, id);
  }

  /** Startet den Zyklus eines Fokuslieferanten (ZYK-01). */
  @Post(':id/cycle')
  @Requires('zyklus.starten')
  startCycle(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SupplierCycle> {
    return this.overviews.startCycle(auth, id);
  }

  /** Setzt oder verschiebt den JBP-Termin (ZYK-02). */
  @Put(':id/cycle/jbp-date')
  @Requires('zyklus.starten')
  setJbpDate(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<SupplierCycle> {
    return this.overviews.setJbpDate(auth, id, body);
  }
}
