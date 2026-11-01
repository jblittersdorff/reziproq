import { Body, Controller, Get, HttpCode, Inject, Post, Put } from '@nestjs/common';
import {
  type LocaleRequest,
  type LoginRequest,
  localeRequestSchema,
  loginRequestSchema,
  type MeResponse,
  type PermissionsResponse,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
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

  /**
   * Die App meldet hier jede abgeschlossene Anmeldung; legt app_user an und setzt last_login_at.
   * Die Browsersprache gilt nur, solange keine Sprache gespeichert ist (PLT-09).
   */
  @Post('anmeldung')
  @HttpCode(200)
  login(
    @CurrentUser() auth: AuthContext,
    // Ältere Clients schicken keinen Body; dann gilt Deutsch.
    @Body(new ZodValidationPipe(loginRequestSchema.optional())) body: LoginRequest | undefined,
  ): Promise<MeResponse> {
    return this.me.syncFromUserinfo(auth, {
      login: true,
      browserLocale: body?.browserLocale ?? 'de',
    });
  }

  /** Eigene Sprache wählen (PLT-09); jede angemeldete Person darf das, auch ohne Organisation. */
  @Put('sprache')
  @HttpCode(204)
  async setLocale(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(localeRequestSchema)) body: LocaleRequest,
  ): Promise<void> {
    await this.me.setLocale(auth, body.locale);
  }
}
