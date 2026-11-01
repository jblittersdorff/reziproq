import { Controller, Get, Inject, Req } from '@nestjs/common';
import type { CustomersResponse } from '@reziproq/shared';
import type { Request } from 'express';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { WithoutOrganization } from '../auth/without-organization.decorator.js';
import { SupportAccessService } from './support-access.service.js';

@Controller('betreiber')
export class SupportController {
  constructor(@Inject(SupportAccessService) private readonly support: SupportAccessService) {}

  /** Kunden, in die ein Betreiber wechseln kann (PLT-13). Betreiber haben oft keine eigene. */
  @WithoutOrganization()
  @Get('kunden')
  @Requires('kunden.wechseln')
  async customers(
    @CurrentUser() auth: AuthContext,
    @Req() request: Request,
  ): Promise<CustomersResponse> {
    return { customers: await this.support.customers(auth.userId, `GET ${request.originalUrl}`) };
  }
}
