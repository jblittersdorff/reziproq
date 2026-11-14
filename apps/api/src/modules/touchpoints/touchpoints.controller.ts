import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  type SaveTouchpoint,
  saveTouchpointSchema,
  type Touchpoint,
  type TouchpointList,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { TouchpointsService } from './touchpoints.service.js';

/** PLB-06: Kontaktpunkte beim Käufer. */
@Controller('suppliers/:id/kontaktpunkte')
export class BuyerTouchpointsController {
  constructor(@Inject(TouchpointsService) private readonly touchpoints: TouchpointsService) {}

  @Get()
  @Requires('kontaktpunkte.sehen')
  list(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TouchpointList> {
    return this.touchpoints.buyer(auth, id, (scope) => this.touchpoints.list(scope));
  }

  @Post()
  @Requires('kontaktpunkte.bearbeiten')
  create(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(saveTouchpointSchema)) body: SaveTouchpoint,
  ): Promise<Touchpoint> {
    return this.touchpoints.buyer(auth, id, (scope) => this.touchpoints.create(scope, body));
  }

  @Post('geprueft')
  @HttpCode(200)
  @Requires('kontaktpunkte.bearbeiten')
  review(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TouchpointList> {
    return this.touchpoints.buyer(auth, id, (scope) => this.touchpoints.review(scope));
  }

  @Get(':touchpointId')
  @Requires('kontaktpunkte.sehen')
  get(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('touchpointId', ParseUUIDPipe) touchpointId: string,
  ): Promise<Touchpoint> {
    return this.touchpoints.buyer(auth, id, (scope) => this.touchpoints.get(scope, touchpointId));
  }

  @Put(':touchpointId')
  @Requires('kontaktpunkte.bearbeiten')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('touchpointId', ParseUUIDPipe) touchpointId: string,
    @Body(new ZodValidationPipe(saveTouchpointSchema)) body: SaveTouchpoint,
  ): Promise<Touchpoint> {
    return this.touchpoints.buyer(auth, id, (scope) =>
      this.touchpoints.update(scope, touchpointId, body),
    );
  }

  @Post(':touchpointId/teilen')
  @HttpCode(200)
  @Requires('kontaktpunkte.bearbeiten')
  share(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('touchpointId', ParseUUIDPipe) touchpointId: string,
  ): Promise<Touchpoint> {
    return this.touchpoints.buyer(auth, id, (scope) => this.touchpoints.share(scope, touchpointId));
  }

  @Delete(':touchpointId')
  @Requires('kontaktpunkte.bearbeiten')
  remove(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('touchpointId', ParseUUIDPipe) touchpointId: string,
  ): Promise<TouchpointList> {
    return this.touchpoints.buyer(auth, id, (scope) =>
      this.touchpoints.remove(scope, touchpointId),
    );
  }
}

/** PLB-06: Kontaktpunkte beim Lieferanten im Kontext des Kunden, nur geteilte (RLS), nur lesen. */
@Controller('kunden/:id/kontaktpunkte')
export class SupplierTouchpointsController {
  constructor(@Inject(TouchpointsService) private readonly touchpoints: TouchpointsService) {}

  @Get()
  @Requires('kontaktpunkte.sehen')
  list(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TouchpointList> {
    return this.touchpoints.supplier(auth, id, (scope) => this.touchpoints.list(scope));
  }
}
