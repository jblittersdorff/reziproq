import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  type ApiKeys,
  type ConnectRequest,
  type CreateApiKey,
  type CreatedApiKey,
  connectRequestSchema,
  createApiKeySchema,
  type InboundMailSettings,
  inboundMailSettingsSchema,
  type Integrations,
  type MyConnections,
  updatePartsSchema,
} from '@reziproq/shared';
import type { Request, Response } from 'express';
import { env } from '../../config/env.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { ApiKeysService } from './api-keys.service.js';
import { IntegrationsService, signatureHeader } from './integrations.service.js';

/** IN-01 Einstellungen › Anbindungen: nur Admins, nur beim Käufer. */
@Controller('einstellungen/anbindungen')
export class IntegrationsController {
  constructor(
    @Inject(IntegrationsService) private readonly integrations: IntegrationsService,
    @Inject(ApiKeysService) private readonly keys: ApiKeysService,
  ) {}

  /** IN-07: Schlüssel der Import-API */
  @Get('schluessel')
  @Requires('einstellungen.verwalten')
  apiKeys(@CurrentUser() auth: AuthContext): Promise<ApiKeys> {
    return this.keys.list(auth);
  }

  @Post('schluessel')
  @Requires('einstellungen.verwalten')
  createKey(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodValidationPipe(createApiKeySchema)) body: CreateApiKey,
  ): Promise<CreatedApiKey> {
    return this.keys.create(auth, body);
  }

  @Post('schluessel/:id/widerrufen')
  @HttpCode(200)
  @Requires('einstellungen.verwalten')
  revokeKey(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiKeys> {
    return this.keys.revoke(auth, id);
  }

  @Get()
  @Requires('einstellungen.verwalten')
  overview(@CurrentUser() auth: AuthContext): Promise<Integrations> {
    return this.integrations.overview(auth);
  }

  @Post(':key/verbinden')
  @HttpCode(200)
  @Requires('einstellungen.verwalten')
  async connect(
    @CurrentUser() auth: AuthContext,
    @Param('key') key: string,
    @Body(new ZodValidationPipe(connectRequestSchema)) body: ConnectRequest,
  ): Promise<Integrations> {
    await this.integrations.connect(auth, key, { scope: 'org', parts: body.parts });
    return this.integrations.overview(auth);
  }

  @Put(':id/teile')
  @Requires('einstellungen.verwalten')
  async parts(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePartsSchema)) body: { parts: string[] },
  ): Promise<Integrations> {
    await this.integrations.updateParts(auth, id, body.parts);
    return this.integrations.overview(auth);
  }

  /** IN-03: zugelassene Absender-Domains der Eingangsadresse */
  @Put(':id/einstellungen')
  @Requires('einstellungen.verwalten')
  async settings(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(inboundMailSettingsSchema)) body: InboundMailSettings,
  ): Promise<Integrations> {
    await this.integrations.updateInboundSettings(auth, id, body.allowedDomains);
    return this.integrations.overview(auth);
  }

  @Post(':id/abgleichen')
  @HttpCode(202)
  @Requires('einstellungen.verwalten')
  async sync(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Integrations> {
    await this.integrations.sync(auth, id);
    return this.integrations.overview(auth);
  }

  @Post(':id/trennen')
  @HttpCode(200)
  @Requires('einstellungen.verwalten')
  async disconnect(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Integrations> {
    await this.integrations.disconnect(auth, id);
    return this.integrations.overview(auth);
  }
}

/** IN-01 Profil › Meine Verbindungen: jede Person beim Käufer, nur die eigenen. */
@Controller('profil/verbindungen')
export class MyConnectionsController {
  constructor(@Inject(IntegrationsService) private readonly integrations: IntegrationsService) {}

  @Get()
  @Requires('lieferanten.sehen')
  mine(@CurrentUser() auth: AuthContext): Promise<MyConnections> {
    return this.integrations.mine(auth);
  }

  @Post(':key/verbinden')
  @HttpCode(200)
  @Requires('lieferanten.sehen')
  async connect(
    @CurrentUser() auth: AuthContext,
    @Param('key') key: string,
  ): Promise<MyConnections> {
    // Durchstich: Mit Microsoft echt geht es erst zur Anmeldung bei Microsoft
    const redirectUrl = this.integrations.startUserAuthorization(auth, key);
    if (redirectUrl) return { ...(await this.integrations.mine(auth)), redirectUrl };
    await this.integrations.connect(auth, key, { scope: 'user' });
    return this.integrations.mine(auth);
  }

  @Post(':id/trennen')
  @HttpCode(200)
  @Requires('lieferanten.sehen')
  async disconnect(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MyConnections> {
    await this.integrations.disconnect(auth, id);
    return this.integrations.mine(auth);
  }
}

/**
 * IN-01: Eingehende Webhooks ohne Login. Das Pfad-Token nennt die Verbindung, die Signatur über
 * den Rohinhalt beweist den Absender. Antwort sofort, Verarbeitung im Job.
 */
@Controller('anbindungen/eingang')
@Public()
export class InboundHookController {
  constructor(@Inject(IntegrationsService) private readonly integrations: IntegrationsService) {}

  @Post(':token')
  @HttpCode(202)
  async receive(
    @Param('token') token: string,
    @Headers(signatureHeader) signature: string | undefined,
    @Req() request: Request & { rawBody?: Buffer },
  ): Promise<{ accepted: true }> {
    const accepted = await this.integrations.receive(
      token.slice(0, 100),
      signature,
      request.rawBody ?? Buffer.alloc(0),
    );
    // Dieselbe Antwort für unbekannte Adresse und falsche Signatur
    if (!accepted) throw new UnauthorizedException({ statusCode: 401, code: 'abgelehnt' });
    return { accepted: true };
  }
}

/**
 * Durchstich: Rückkehr von der Anmeldung bei Microsoft (OAuth). Ohne Login der App; der signierte
 * state nennt Person und Organisation und gilt zehn Minuten. Danach zurück ins Profil.
 */
@Controller('anbindungen/oauth/microsoft')
@Public()
export class MicrosoftCallbackController {
  constructor(@Inject(IntegrationsService) private readonly integrations: IntegrationsService) {}

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() response: Response,
  ) {
    const ok =
      typeof code === 'string' &&
      typeof state === 'string' &&
      (await this.integrations.completeUserAuthorization(code.slice(0, 4000), state.slice(0, 2000)));
    response.redirect(`${env.WEB_APP_URL}/profil?verbindung=${ok ? 'ok' : 'fehler'}#verbindungen`);
  }
}
