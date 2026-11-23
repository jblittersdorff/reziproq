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
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  type ConnectRequest,
  connectRequestSchema,
  type Integrations,
  type MyConnections,
  updatePartsSchema,
} from '@reziproq/shared';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { IntegrationsService, signatureHeader } from './integrations.service.js';

/** IN-01 Einstellungen › Anbindungen: nur Admins, nur beim Käufer. */
@Controller('einstellungen/anbindungen')
export class IntegrationsController {
  constructor(@Inject(IntegrationsService) private readonly integrations: IntegrationsService) {}

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
