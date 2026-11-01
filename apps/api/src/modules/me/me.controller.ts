import { Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import type { MeResponse, PermissionsResponse } from '@reziproq/shared';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { WithoutOrganization } from '../auth/without-organization.decorator.js';
import { MeService } from './me.service.js';

// /me gilt auch ohne Organisation: Die Oberfläche zeigt dann den Hinweis (PLT-02).
@WithoutOrganization()
@Controller('me')
export class MeController {
  constructor(@Inject(MeService) private readonly me: MeService) {}

  @Get()
  get(@CurrentUser() auth: AuthContext): Promise<MeResponse> {
    return this.me.syncFromUserinfo(auth);
  }

  /** Was die Person darf, als Liste von Aktionen aus can() (PLT-05). */
  @Get('permissions')
  permissions(@CurrentUser() auth: AuthContext): PermissionsResponse {
    return this.me.permissions(auth);
  }

  /** Die App meldet hier jede abgeschlossene Anmeldung; legt app_user an und setzt last_login_at. */
  @Post('anmeldung')
  @HttpCode(200)
  login(@CurrentUser() auth: AuthContext): Promise<MeResponse> {
    return this.me.syncFromUserinfo(auth, { login: true });
  }
}
