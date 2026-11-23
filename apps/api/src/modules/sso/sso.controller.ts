import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put } from '@nestjs/common';
import {
  type SaveSso,
  type SsoHint,
  type SsoOverview,
  type SsoProvider,
  saveSsoSchema,
  ssoHintRequestSchema,
  ssoProviders,
} from '@reziproq/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { SsoService } from './sso.service.js';

const providerPipe = new ZodValidationPipe(z.enum(ssoProviders));

/** IN-02 Einstellungen › Anbindungen › Anmeldung über Microsoft oder Google (nur Admins). */
@Controller('einstellungen/anbindungen/anmeldung')
export class SsoController {
  constructor(@Inject(SsoService) private readonly sso: SsoService) {}

  @Get()
  @Requires('einstellungen.verwalten')
  overview(@CurrentUser() auth: AuthContext): Promise<SsoOverview> {
    return this.sso.overview(auth);
  }

  @Put(':provider')
  @Requires('einstellungen.verwalten')
  save(
    @CurrentUser() auth: AuthContext,
    @Param('provider', providerPipe) provider: SsoProvider,
    @Body(new ZodValidationPipe(saveSsoSchema)) body: SaveSso,
  ): Promise<SsoOverview> {
    return this.sso.save(auth, provider, body);
  }

  @Post(':provider/domains/:domain/bestaetigen')
  @HttpCode(200)
  @Requires('einstellungen.verwalten')
  verify(
    @CurrentUser() auth: AuthContext,
    @Param('provider', providerPipe) provider: SsoProvider,
    @Param('domain') domain: string,
  ): Promise<SsoOverview> {
    return this.sso.verify(auth, provider, domain.toLowerCase().slice(0, 253));
  }
}

/** IN-02 Anmeldeseite: führt eine Mail direkt zu Microsoft oder Google? Ohne Login. */
@Controller('anmeldung')
@Public()
export class SsoHintController {
  constructor(@Inject(SsoService) private readonly sso: SsoService) {}

  @Post('sso')
  @HttpCode(200)
  hint(@Body(new ZodValidationPipe(ssoHintRequestSchema)) body: { email: string }): Promise<SsoHint> {
    return this.sso.hint(body.email);
  }
}
