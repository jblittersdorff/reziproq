import { Body, Controller, Get, Inject, Put } from '@nestjs/common';
import { cycleSettingsResponseSchema } from '@reziproq/shared';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { OverviewService } from './overview.service.js';

@Controller('cycle/settings')
export class CycleSettingsController {
  constructor(@Inject(OverviewService) private readonly overviews: OverviewService) {}

  @Get()
  @Requires('einstellungen.verwalten')
  async get(@CurrentUser() auth: AuthContext) {
    return cycleSettingsResponseSchema.parse(await this.overviews.cycleSettings(auth));
  }

  @Put()
  @Requires('einstellungen.verwalten')
  async update(@CurrentUser() auth: AuthContext, @Body() body: unknown) {
    return cycleSettingsResponseSchema.parse(await this.overviews.updateCycleSettings(auth, body));
  }
}
