import { Controller, Get, Inject } from '@nestjs/common';
import type { OrganizationResponse } from '@reziproq/shared';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { OrganizationService } from './organization.service.js';

@Controller('organisation')
export class OrganizationsController {
  constructor(@Inject(OrganizationService) private readonly organizations: OrganizationService) {}

  /** Name, Land und Mitglieder der eigenen Organisation (PLT-02). Ohne Organisation 403 (Guard). */
  @Get()
  get(@CurrentUser() auth: AuthContext): Promise<OrganizationResponse> {
    return this.organizations.withMembers(auth);
  }
}
