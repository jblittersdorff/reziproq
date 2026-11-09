import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import {
  type CreateJbp,
  createJbpSchema,
  type JbpPreparation,
  type SaveBusinessUpdate,
  saveBusinessUpdateSchema,
} from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { JbpService } from './jbp.service.js';

/** Gemeinsamer Plan beim Käufer (JBP-01). */
@Controller('suppliers/:id/jbp')
export class BuyerJbpController {
  constructor(@Inject(JbpService) private readonly jbp: JbpService) {}

  @Get()
  @Requires('jbp.sehen')
  preparation(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<JbpPreparation> {
    return this.jbp.buyer(auth, id, (scope) => this.jbp.preparation(scope));
  }

  @Post()
  @Requires('jbp.anlegen')
  create(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createJbpSchema)) body: CreateJbp,
  ): Promise<JbpPreparation> {
    return this.jbp.buyer(auth, id, (scope) => this.jbp.create(scope, body));
  }

  @Put('geschaeftsupdate')
  @Requires('jbp.bearbeiten')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(saveBusinessUpdateSchema)) body: SaveBusinessUpdate,
  ): Promise<JbpPreparation> {
    return this.jbp.buyer(auth, id, (scope) => this.jbp.saveUpdate(scope, body.text));
  }
}

/** Gemeinsamer Plan beim Lieferanten im Kontext des Kunden (JBP-01). */
@Controller('kunden/:id/jbp')
export class SupplierJbpController {
  constructor(@Inject(JbpService) private readonly jbp: JbpService) {}

  @Get()
  @Requires('jbp.sehen')
  preparation(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<JbpPreparation> {
    return this.jbp.supplier(auth, id, (scope) => this.jbp.preparation(scope));
  }

  @Put('geschaeftsupdate')
  @Requires('jbp.bearbeiten')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(saveBusinessUpdateSchema)) body: SaveBusinessUpdate,
  ): Promise<JbpPreparation> {
    return this.jbp.supplier(auth, id, (scope) => this.jbp.saveUpdate(scope, body.text));
  }
}
