import { Controller, Get, Inject, Param, ParseUUIDPipe } from '@nestjs/common';
import type { SupplierOverview } from '@reziproq/shared';
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
}
